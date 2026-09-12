import { updateContactAttributes } from '@/foundation/amazon-connect/update-attributes'
import { deleteCall, getContactId, setContactId } from '../../call-store'
import { hangUpOpenAiSipCall } from '../../handle-call/hang-up-call'
import { closeOpenAiSipWebSocketForCall } from '../../websocket/connect-to-call'
import {
  disconnectTheCallTool,
  runDisconnectTheCallHangup,
} from '../disconnect-the-call'

jest.mock('@/foundation/amazon-connect/update-attributes', () => ({
  updateContactAttributes: jest.fn(),
}))
jest.mock('../../handle-call/hang-up-call', () => ({
  hangUpOpenAiSipCall: jest.fn(),
}))
jest.mock('../../websocket/connect-to-call', () => ({
  closeOpenAiSipWebSocketForCall: jest.fn(),
}))

describe('disconnect_the_call tool', () => {
  const originalSdkEnable = process.env.AMAZON_CONNECT_SDK_ENABLE

  afterEach(() => {
    deleteCall('call-1')
    if (originalSdkEnable === undefined) {
      delete process.env.AMAZON_CONNECT_SDK_ENABLE
    } else {
      process.env.AMAZON_CONNECT_SDK_ENABLE = originalSdkEnable
    }
  })

  it('records the call as a non-handoff and cleans up', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'
    setContactId('call-1', 'contact-1')

    await runDisconnectTheCallHangup('call-1', {
      summary: 'Customer ended the call',
    })

    expect(updateContactAttributes).toHaveBeenCalledWith('contact-1', {
      AIVoiceAgentHandoff: 'false',
      AIVoiceAgentConversationSummary: 'Customer ended the call',
    })
    expect(closeOpenAiSipWebSocketForCall).toHaveBeenCalledWith('call-1')
    expect(hangUpOpenAiSipCall).toHaveBeenCalledWith('call-1', 'contact-1')
    expect(getContactId('call-1')).toBeUndefined()
  })

  it('defaults the summary when the model omitted it', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'
    setContactId('call-1', 'contact-1')

    await runDisconnectTheCallHangup('call-1', '{}')

    expect(updateContactAttributes).toHaveBeenCalledWith(
      'contact-1',
      expect.objectContaining({ AIVoiceAgentConversationSummary: '' })
    )
  })

  it('skips attributes when the Connect SDK is disabled', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'false'
    setContactId('call-1', 'contact-1')

    await runDisconnectTheCallHangup('call-1', {})

    expect(updateContactAttributes).not.toHaveBeenCalled()
    expect(hangUpOpenAiSipCall).toHaveBeenCalledWith('call-1', 'contact-1')
  })

  it('still hangs up when no contact id is known', async () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'

    await runDisconnectTheCallHangup('call-1', '')

    expect(updateContactAttributes).not.toHaveBeenCalled()
    expect(hangUpOpenAiSipCall).toHaveBeenCalledWith('call-1', '')
  })

  it('exposes an execute wrapper for the Realtime tool table', async () => {
    await disconnectTheCallTool.execute('call-1', {})

    expect(hangUpOpenAiSipCall).toHaveBeenCalledTimes(1)
  })
})
