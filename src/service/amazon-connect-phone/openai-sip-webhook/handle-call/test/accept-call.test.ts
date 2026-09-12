import { sendHttpRequestToOpenAi } from '@/foundation/open-ai/send-http-request'
import { deleteCall, getContactId } from '../../call-store'
import { connectOpenAiSipRealtimeWebSocket } from '../../websocket/connect-to-call'
import type { VoiceAgentDefinition } from '../../types'
import { acceptOpenAiSipCall } from '../accept-call'

jest.mock('@/foundation/open-ai/send-http-request', () => ({
  sendHttpRequestToOpenAi: jest.fn(),
}))
jest.mock('../../websocket/connect-to-call', () => ({
  connectOpenAiSipRealtimeWebSocket: jest.fn(),
}))

const sendRequestMock = jest.mocked(sendHttpRequestToOpenAi)
const connectWebSocketMock = jest.mocked(connectOpenAiSipRealtimeWebSocket)
const agent: VoiceAgentDefinition = {
  getInstructions: () => 'You are a test voice agent.',
}

describe('acceptOpenAiSipCall', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
    delete process.env.OPENAI_MODEL
  })

  afterEach(() => {
    deleteCall('call/1')
    process.env = { ...originalEnv }
  })

  it('returns a clear error when the API key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(
      acceptOpenAiSipCall({ callId: 'call/1', agent })
    ).resolves.toEqual({
      ok: false,
      error: 'OPENAI_API_KEY is missing',
    })
    expect(sendRequestMock).not.toHaveBeenCalled()
  })

  it('accepts the call with the default model and opens its WebSocket', async () => {
    sendRequestMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(
      acceptOpenAiSipCall({
        callId: 'call/1',
        agent,
        metaData: { contactId: 'contact-1', queueName: 'Sales' },
      })
    ).resolves.toEqual({ ok: true })

    expect(sendRequestMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/realtime/calls/call%2F1/accept',
      'POST',
      expect.objectContaining({
        type: 'realtime',
        model: 'gpt-realtime-2.1',
        instructions: expect.stringContaining('Queue: Sales'),
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'transfer_to_human_agent' }),
        ]),
      })
    )
    expect(getContactId('call/1')).toBe('contact-1')
    expect(connectWebSocketMock).toHaveBeenCalledWith(
      'call/1',
      'contact-1',
      undefined
    )
  })

  it('uses an explicitly configured model', async () => {
    process.env.OPENAI_MODEL = 'custom-model'
    sendRequestMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    await acceptOpenAiSipCall({ callId: 'call/1', agent })

    expect(sendRequestMock).toHaveBeenCalledWith(
      expect.any(String),
      'POST',
      expect.objectContaining({ model: 'custom-model' })
    )
  })

  it('returns details for an OpenAI rejection', async () => {
    sendRequestMock.mockResolvedValueOnce(
      new Response('bad request', { status: 400 })
    )

    await expect(
      acceptOpenAiSipCall({ callId: 'call/1', agent })
    ).resolves.toEqual({
      ok: false,
      error: 'Accept failed: 400 bad request',
    })
    expect(connectWebSocketMock).not.toHaveBeenCalled()
  })

  it('sanitizes unexpected request failures', async () => {
    sendRequestMock.mockRejectedValueOnce(new Error('network details'))

    await expect(
      acceptOpenAiSipCall({ callId: 'call/1', agent })
    ).resolves.toEqual({
      ok: false,
      error: 'Accept call failed',
    })
  })
})
