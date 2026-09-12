import { runTransferToHumanAgentHangup } from '../../tools/transfer-to-human-agent'
import {
  clearTransferHangupSchedule,
  noteTransferResponseDone,
  queueTransferToolArguments,
} from '../transfer-hangup-scheduler'

jest.mock('../../tools/transfer-to-human-agent', () => ({
  runTransferToHumanAgentHangup: jest.fn(),
}))

const callId = 'transfer'

const responseDoneMessage = {
  type: 'response.done',
  response: {
    output: [{ type: 'function_call', name: 'transfer_to_human_agent' }],
  },
}

describe('transfer hangup scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    process.env.SIP_TRANSFER_AUDIO_TAIL_MS = '10'
  })

  afterEach(() => {
    clearTransferHangupSchedule(callId)
    jest.useRealTimers()
    delete process.env.SIP_TRANSFER_AUDIO_TAIL_MS
  })

  it('waits for both the tool arguments and the finished response', async () => {
    queueTransferToolArguments(callId, '{"summary":"handoff"}')
    await jest.advanceTimersByTimeAsync(20)
    expect(runTransferToHumanAgentHangup).not.toHaveBeenCalled()

    noteTransferResponseDone(callId, responseDoneMessage)
    await jest.advanceTimersByTimeAsync(10)

    expect(runTransferToHumanAgentHangup).toHaveBeenCalledWith(
      callId,
      '{"summary":"handoff"}'
    )
  })

  it('accepts the finished response before the tool arguments', async () => {
    noteTransferResponseDone(callId, responseDoneMessage)
    queueTransferToolArguments(callId, '{}')
    await jest.advanceTimersByTimeAsync(10)

    expect(runTransferToHumanAgentHangup).toHaveBeenCalledWith(callId, '{}')
  })

  it('schedules the hangup only once per call', async () => {
    noteTransferResponseDone(callId, responseDoneMessage)
    queueTransferToolArguments(callId, '{}')
    noteTransferResponseDone(callId, responseDoneMessage)
    await jest.advanceTimersByTimeAsync(10)

    expect(runTransferToHumanAgentHangup).toHaveBeenCalledTimes(1)
  })

  it('ignores messages that do not finish a transfer response', async () => {
    noteTransferResponseDone(callId, {})
    noteTransferResponseDone(callId, { type: 'response.done', response: {} })
    noteTransferResponseDone(callId, {
      type: 'response.done',
      response: { output: [{ type: 'function_call', name: 'other' }] },
    })
    queueTransferToolArguments(callId, '{}')
    await jest.runAllTimersAsync()

    expect(runTransferToHumanAgentHangup).not.toHaveBeenCalled()
  })

  it('cancels a pending hangup', async () => {
    noteTransferResponseDone(callId, responseDoneMessage)
    queueTransferToolArguments(callId, '{}')
    clearTransferHangupSchedule(callId)
    await jest.runAllTimersAsync()

    expect(runTransferToHumanAgentHangup).not.toHaveBeenCalled()
  })

  it('falls back to the default tail for invalid configuration', async () => {
    process.env.SIP_TRANSFER_AUDIO_TAIL_MS = 'invalid'
    noteTransferResponseDone(callId, responseDoneMessage)
    queueTransferToolArguments(callId, '{}')

    await jest.advanceTimersByTimeAsync(3499)
    expect(runTransferToHumanAgentHangup).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(runTransferToHumanAgentHangup).toHaveBeenCalled()
  })

  it('logs a failing hangup instead of rejecting', async () => {
    jest
      .mocked(runTransferToHumanAgentHangup)
      .mockRejectedValueOnce(new Error('hangup'))

    noteTransferResponseDone(callId, responseDoneMessage)
    queueTransferToolArguments(callId, '{}')
    await jest.advanceTimersByTimeAsync(10)
    await Promise.resolve()
    await Promise.resolve()

    expect(runTransferToHumanAgentHangup).toHaveBeenCalled()
  })
})
