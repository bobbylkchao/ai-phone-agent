import { runDisconnectTheCallHangup } from '../../tools/disconnect-the-call'
import {
  clearDisconnectHangupSchedule,
  noteDisconnectResponseDone,
  queueDisconnectToolArguments,
} from '../disconnect-hangup-scheduler'

jest.mock('../../tools/disconnect-the-call', () => ({
  runDisconnectTheCallHangup: jest.fn(),
}))

const callId = 'disconnect'

const responseDoneMessage = {
  type: 'response.done',
  response: {
    output: [{ type: 'function_call', name: 'disconnect_the_call' }],
  },
}

describe('disconnect hangup scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    process.env.SIP_DISCONNECT_AUDIO_TAIL_MS = '10'
  })

  afterEach(() => {
    clearDisconnectHangupSchedule(callId)
    jest.useRealTimers()
    delete process.env.SIP_DISCONNECT_AUDIO_TAIL_MS
  })

  it('waits for both the tool arguments and the finished response', async () => {
    queueDisconnectToolArguments(callId, '{"summary":"bye"}')
    await jest.advanceTimersByTimeAsync(20)
    expect(runDisconnectTheCallHangup).not.toHaveBeenCalled()

    noteDisconnectResponseDone(callId, responseDoneMessage)
    await jest.advanceTimersByTimeAsync(10)

    expect(runDisconnectTheCallHangup).toHaveBeenCalledWith(
      callId,
      '{"summary":"bye"}'
    )
  })

  it('accepts the finished response before the tool arguments', async () => {
    noteDisconnectResponseDone(callId, responseDoneMessage)
    queueDisconnectToolArguments(callId, '{}')
    await jest.advanceTimersByTimeAsync(10)

    expect(runDisconnectTheCallHangup).toHaveBeenCalledWith(callId, '{}')
  })

  it('schedules the hangup only once per call', async () => {
    noteDisconnectResponseDone(callId, responseDoneMessage)
    queueDisconnectToolArguments(callId, '{}')
    noteDisconnectResponseDone(callId, responseDoneMessage)
    await jest.advanceTimersByTimeAsync(10)

    expect(runDisconnectTheCallHangup).toHaveBeenCalledTimes(1)
  })

  it('ignores messages that do not finish a disconnect response', async () => {
    noteDisconnectResponseDone(callId, {})
    noteDisconnectResponseDone(callId, { type: 'response.done', response: {} })
    noteDisconnectResponseDone(callId, {
      type: 'response.done',
      response: { output: [{ type: 'message' }] },
    })
    queueDisconnectToolArguments(callId, '{}')
    await jest.runAllTimersAsync()

    expect(runDisconnectTheCallHangup).not.toHaveBeenCalled()
  })

  it('cancels a pending hangup', async () => {
    noteDisconnectResponseDone(callId, responseDoneMessage)
    queueDisconnectToolArguments(callId, '{}')
    clearDisconnectHangupSchedule(callId)
    await jest.runAllTimersAsync()

    expect(runDisconnectTheCallHangup).not.toHaveBeenCalled()
  })

  it('falls back to the default tail for invalid configuration', async () => {
    process.env.SIP_DISCONNECT_AUDIO_TAIL_MS = '-1'
    noteDisconnectResponseDone(callId, responseDoneMessage)
    queueDisconnectToolArguments(callId, '{}')

    await jest.advanceTimersByTimeAsync(3499)
    expect(runDisconnectTheCallHangup).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(runDisconnectTheCallHangup).toHaveBeenCalled()
  })

  it('logs a failing hangup instead of rejecting', async () => {
    jest
      .mocked(runDisconnectTheCallHangup)
      .mockRejectedValueOnce(new Error('hangup'))

    noteDisconnectResponseDone(callId, responseDoneMessage)
    queueDisconnectToolArguments(callId, '{}')
    await jest.advanceTimersByTimeAsync(10)
    await Promise.resolve()
    await Promise.resolve()

    expect(runDisconnectTheCallHangup).toHaveBeenCalled()
  })
})
