import type { Express } from 'express'
import { Server as HttpServer } from 'http'
import { initTwilioPhoneMediaStreamWebSocket } from '@/foundation/websocket'
import { initTwilioPhoneHttpRoute } from './http-route'

/**
 * Twilio **phone** channel: HTTP `/twilio-phone/incoming-call` (TwiML) + native WebSocket `/twilio-phone/media-stream`.
 */
export const initTwilioPhoneChannel = (
  app: Express,
  httpServer: HttpServer
): void => {
  initTwilioPhoneHttpRoute(app)
  initTwilioPhoneMediaStreamWebSocket(httpServer)
}
