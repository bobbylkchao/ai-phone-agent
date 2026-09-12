import { updateContactAttributes } from '@/foundation/amazon-connect/update-attributes'
import { deleteCall, getContactId, setContactId } from '../../call-store'
import { hangUpOpenAiSipCall } from '../../handle-call/hang-up-call'
import { closeOpenAiSipWebSocketForCall } from '../../websocket/connect-to-call'
import {
  runTransferToHumanAgentHangup,
  transferToHumanAgentTool,
} from '../transfer-to-human-agent'

jest.mock('@/foundation/amazon-connect/update-attributes', () => ({
  updateContactAttributes: jest.fn(),
}))
jest.mock('../../handle-call/hang-up-call', () => ({
  hangUpOpenAiSipCall: jest.fn(),
}))
jest.mock('../../websocket/connect-to-call', () => ({
  closeOpenAiSipWebSocketForCall: jest.fn(),
}))

describe('transfer_to_human_agent tool', () => {
  const originalSdkEnable = process.env.AMAZON_CONNECT_SDK_ENABLE

  afterEach(() => {
    deleteCall('call-1')
    if (originalSdkEnable === undefined) {
      delete process.env.AMAZON_CONNECT_SDK_ENABLE
    } else {
      process.env.AMAZON_CONNECT_SDK_ENABLE = originalSdkEnable
    }
  })

  it('writes handoff attributes before cleaning up the call', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'
    setContactId('call-1', 'contact-1')

    await runTransferToHumanAgentHangup(
      'call-1',
      '{"summary":"Customer requested a human agent"}'
    )

    expect(updateContactAttributes).toHaveBeenCalledWith('contact-1', {
      AIVoiceAgentHandoff: 'true',
      AIVoiceAgentConversationSummary: 'Customer requested a human agent',
    })
    expect(closeOpenAiSipWebSocketForCall).toHaveBeenCalledWith('call-1')
    expect(hangUpOpenAiSipCall).toHaveBeenCalledWith('call-1', 'contact-1')
    expect(getContactId('call-1')).toBeUndefined()
  })

  it('defaults the summary when the model omitted it', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'
    setContactId('call-1', 'contact-1')

    await runTransferToHumanAgentHangup('call-1', {})

    expect(updateContactAttributes).toHaveBeenCalledWith(
      'contact-1',
      expect.objectContaining({ AIVoiceAgentConversationSummary: '' })
    )
  })

  it('skips attributes when the Connect SDK is disabled', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'false'
    setContactId('call-1', 'contact-1')

    await runTransferToHumanAgentHangup('call-1', {})

    expect(updateContactAttributes).not.toHaveBeenCalled()
    expect(hangUpOpenAiSipCall).toHaveBeenCalledWith('call-1', 'contact-1')
  })

  it('still hangs up when no contact id is known', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'

    await runTransferToHumanAgentHangup('call-1', '')

    expect(updateContactAttributes).not.toHaveBeenCalled()
    expect(hangUpOpenAiSipCall).toHaveBeenCalledWith('call-1', '')
  })

  it('rejects malformed arguments before changing call state', async () => {
    setContactId('call-1', 'contact-1')

    await expect(runTransferToHumanAgentHangup('call-1', '{')).rejects.toThrow()
    expect(getContactId('call-1')).toBe('contact-1')
    expect(hangUpOpenAiSipCall).not.toHaveBeenCalled()
  })

  it('exposes an execute wrapper for the Realtime tool table', async () => {
    await transferToHumanAgentTool.execute('call-1', {})

    expect(hangUpOpenAiSipCall).toHaveBeenCalledTimes(1)
  })
})
