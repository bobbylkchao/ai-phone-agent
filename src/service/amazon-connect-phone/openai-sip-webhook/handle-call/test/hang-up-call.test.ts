import { sendHttpRequestToOpenAi } from '@/foundation/open-ai/send-http-request'
import { hangUpOpenAiSipCall } from '../hang-up-call'

jest.mock('@/foundation/open-ai/send-http-request', () => ({
  sendHttpRequestToOpenAi: jest.fn(),
}))

describe('hangUpOpenAiSipCall', () => {
  it('hangs up through the encoded OpenAI call URL', async () => {
    jest
      .mocked(sendHttpRequestToOpenAi)
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    await hangUpOpenAiSipCall('call/1', 'contact-1')

    expect(sendHttpRequestToOpenAi).toHaveBeenCalledWith(
      'https://api.openai.com/v1/realtime/calls/call%2F1/hangup',
      'POST'
    )
  })

  it('absorbs request failures because cleanup is best effort', async () => {
    jest
      .mocked(sendHttpRequestToOpenAi)
      .mockRejectedValueOnce(new Error('network'))

    await expect(
      hangUpOpenAiSipCall('call-1', 'contact-1')
    ).resolves.toBeUndefined()
  })
})
