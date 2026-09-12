import { registerOpenAiSipWebhookRoutes } from '../index'
import type { VoiceAgentDefinition } from '../types'

const agent: VoiceAgentDefinition = {
  getInstructions: () => 'Test instructions',
}

describe('registerOpenAiSipWebhookRoutes', () => {
  const originalBasePath = process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH

  afterEach(() => {
    if (originalBasePath === undefined) {
      delete process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH
    } else {
      process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH = originalBasePath
    }
  })

  it('registers the configured incoming-call route', () => {
    process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH = '/connect'
    const app = { post: jest.fn() }

    registerOpenAiSipWebhookRoutes(app as never, agent)

    expect(app.post).toHaveBeenCalledWith(
      '/connect/incoming-call',
      expect.any(Function)
    )
  })

  it('does not register a route without a base path', () => {
    delete process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH
    const app = { post: jest.fn() }

    registerOpenAiSipWebhookRoutes(app as never, agent)

    expect(app.post).not.toHaveBeenCalled()
  })
})
