import type { Express } from 'express'
import logger from '@/misc/logger'
import type { VoiceAgentDefinition } from './types'
import { createOpenAiSipIncomingCallWebhook } from './webhook/incoming-call'

/**
 * Registers POST .../incoming-call for OpenAI `realtime.call.incoming`.
 */
export const registerOpenAiSipWebhookRoutes = (
  app: Express,
  agent: VoiceAgentDefinition
): void => {
  if (!process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH) {
    logger.error(
      '[AmazonConnectPhone] AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH is not set'
    )
    return
  }

  const incomingCallPath = `${process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH}/incoming-call`
  app.post(incomingCallPath, createOpenAiSipIncomingCallWebhook(agent))
  logger.info(
    { incomingCallPath },
    '[AmazonConnectPhone] OpenAI SIP webhook registered'
  )
}
