import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { deleteCall, setContactId } from '../../call-store'
import { handleMessageIfToolCall } from '../../tools'
import {
  closeOpenAiSipWebSocketForCall,
  connectOpenAiSipRealtimeWebSocket,
  onConversationTimeout,
} from '../connect-to-call'
import { noteDisconnectResponseDone } from '../disconnect-hangup-scheduler'
import { noteTransferResponseDone } from '../transfer-hangup-scheduler'

jest.mock('ws')
jest.mock('../../tools', () => ({
  handleMessageIfToolCall: jest.fn().mockResolvedValue(false),
}))
jest.mock('../disconnect-hangup-scheduler', () => ({
  clearDisconnectHangupSchedule: jest.fn(),
  noteDisconnectResponseDone: jest.fn(),
}))
jest.mock('../transfer-hangup-scheduler', () => ({
  clearTransferHangupSchedule: jest.fn(),
  noteTransferResponseDone: jest.fn(),
}))

type FakeSocket = EventEmitter & { close: jest.Mock; send: jest.Mock }

const createSocket = (): FakeSocket => {
  const socket = new EventEmitter() as FakeSocket
  socket.close = jest.fn()
  socket.send = jest.fn()
  return socket
}

describe('OpenAI SIP Realtime WebSocket', () => {
  const originalApiKey = process.env.OPENAI_API_KEY
  let socket: FakeSocket

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    socket = createSocket()
    jest
      .mocked(WebSocket)
      .mockImplementation(() => socket as unknown as WebSocket)
  })

  afterEach(() => {
    closeOpenAiSipWebSocketForCall('call-1')
    deleteCall('call-1')
    process.env.OPENAI_API_KEY = originalApiKey
    jest.useRealTimers()
  })

  it('requires an API key before connecting', () => {
    delete process.env.OPENAI_API_KEY

    expect(() => connectOpenAiSipRealtimeWebSocket('call-1', '')).toThrow(
      'OPENAI_API_KEY is not set'
    )
  })

  it('opens the call socket, then cleans it up by contact id', () => {
    setContactId('call-1', 'contact-1')
    const ws = connectOpenAiSipRealtimeWebSocket('call-1', 'contact-1')

    expect(WebSocket).toHaveBeenCalledWith(
      'wss://api.openai.com/v1/realtime?call_id=call-1',
      { headers: { Authorization: 'Bearer test-key' } }
    )
    socket.emit('open')
    expect(socket.send).toHaveBeenCalledTimes(2)
    socket.emit('error', new Error('socket failed'))

    closeOpenAiSipWebSocketForCall('call-1')
    expect(socket.close).toHaveBeenCalled()
    expect(ws).toBe(socket)
  })

  it('parses JSON and raw messages, then deletes the call on close', async () => {
    connectOpenAiSipRealtimeWebSocket('call-1', '')

    socket.emit('message', '{"type":"response.done"}')
    socket.emit('message', Buffer.from('not-json'))
    socket.emit('message', '{"type":1}')
    await Promise.resolve()
    await Promise.resolve()

    expect(noteTransferResponseDone).toHaveBeenCalledWith('call-1', {
      type: 'response.done',
    })
    expect(noteDisconnectResponseDone).toHaveBeenCalledWith(
      'call-1',
      'not-json'
    )
    expect(handleMessageIfToolCall).toHaveBeenCalled()

    socket.emit('close')
    expect(socket.close).toHaveBeenCalled()
  })

  it('logs inactivity and reschedules while the socket is still open', () => {
    jest.useFakeTimers()
    connectOpenAiSipRealtimeWebSocket('call-1', '')
    socket.emit('message', '{"type":"session.created"}')

    jest.advanceTimersByTime(20_000)
    jest.advanceTimersByTime(20_000)
    onConversationTimeout('call-1', '')

    closeOpenAiSipWebSocketForCall('call-1')
    closeOpenAiSipWebSocketForCall('call-1')
  })
})
