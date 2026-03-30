import type { Express } from 'express'
import logger from '@/misc/logger'
import { handleOpenAiSipIncomingCallWebhook } from './webhook/incoming-call'

/**
 * Registers POST .../incoming-call for OpenAI `realtime.call.incoming`.
 * Enable with AMAZON_CONNECT_PHONE_ENABLE=true.
 */
export const registerOpenAiSipWebhookRoutes = (app: Express): void => {
  if (process.env.AMAZON_CONNECT_PHONE_ENABLE !== 'true') {
    logger.info(
      '[AmazonConnectPhone] OpenAI SIP webhook disabled (set AMAZON_CONNECT_PHONE_ENABLE=true)'
    )
    return
  }

  if (!process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH) {
    logger.error(
      '[AmazonConnectPhone] AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH is not set'
    )
    return
  }

  app.post(
    `${process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH}/incoming-call`,
    handleOpenAiSipIncomingCallWebhook
  )
}
