import { initAmazonConnectClient } from '@/foundation/amazon-connect/client'
import { initAmazonConnectPhoneChannel } from '../index'
import { registerOpenAiSipWebhookRoutes } from '../openai-sip-webhook'

jest.mock('@/foundation/amazon-connect/client', () => ({
  initAmazonConnectClient: jest.fn(),
}))
jest.mock('../openai-sip-webhook', () => ({
  registerOpenAiSipWebhookRoutes: jest.fn(),
}))

describe('initAmazonConnectPhoneChannel', () => {
  it('registers the webhook route and initializes the Connect SDK', () => {
    const app = {} as never

    initAmazonConnectPhoneChannel(app)

    expect(registerOpenAiSipWebhookRoutes).toHaveBeenCalledWith(app)
    expect(initAmazonConnectClient).toHaveBeenCalled()
  })
})
