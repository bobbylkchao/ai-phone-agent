import type { Express } from 'express'
import { initAmazonConnectClient } from '@/foundation/amazon-connect/client'
import { registerOpenAiSipWebhookRoutes } from './openai-sip-webhook'
import type { VoiceAgentDefinition } from './openai-sip-webhook/types'

/**
 * Amazon Connect **phone** path: OpenAI Realtime SIP webhook + optional Connect SDK
 * (e.g. contact attributes when the model ends the call).
 */
export const initAmazonConnectPhoneChannel = (
  app: Express,
  agent: VoiceAgentDefinition
): void => {
  registerOpenAiSipWebhookRoutes(app, agent)
  initAmazonConnectClient()
}
