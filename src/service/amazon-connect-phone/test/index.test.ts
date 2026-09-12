import { initAmazonConnectClient } from '@/foundation/amazon-connect/client'
import { initAmazonConnectPhoneChannel } from '../index'
import { registerOpenAiSipWebhookRoutes } from '../openai-sip-webhook'
import type { VoiceAgentDefinition } from '../openai-sip-webhook/types'

jest.mock('@/foundation/amazon-connect/client', () => ({
  initAmazonConnectClient: jest.fn(),
}))
jest.mock('../openai-sip-webhook', () => ({
  registerOpenAiSipWebhookRoutes: jest.fn(),
}))

describe('initAmazonConnectPhoneChannel', () => {
  it('registers the webhook route and initializes the Connect SDK', () => {
    const app = {} as never
    const agent: VoiceAgentDefinition = {
      getInstructions: () => 'Test instructions',
    }

    initAmazonConnectPhoneChannel(app, agent)

    expect(registerOpenAiSipWebhookRoutes).toHaveBeenCalledWith(app, agent)
    expect(initAmazonConnectClient).toHaveBeenCalled()
  })
})
