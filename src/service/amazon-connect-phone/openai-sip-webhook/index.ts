import type { Express } from 'express'
import logger from '@/misc/logger'
import { handleOpenAiSipIncomingCallWebhook } from './webhook/incoming-call'

/**
 * Registers POST .../incoming-call for OpenAI `realtime.call.incoming`.
 */
export const registerOpenAiSipWebhookRoutes = (app: Express): void => {
  if (!process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH) {
    logger.error(
      '[AmazonConnectPhone] AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH is not set'
    )
    return
  }

  const incomingCallPath = `${process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH}/incoming-call`
  app.post(incomingCallPath, handleOpenAiSipIncomingCallWebhook)
  logger.info(
    { incomingCallPath },
    '[AmazonConnectPhone] OpenAI SIP webhook registered'
  )
}
