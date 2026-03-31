import { Server as HttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { TWILIO_PHONE_MEDIA_STREAM_PATH } from '@/service/twilio-phone/constants'
import { handleTwilioPhoneMediaStreamConnection } from './handler'

export const initTwilioPhoneMediaStreamWebSocketServer = (
  httpServer: HttpServer
) => {
  const wss = new WebSocketServer({
    noServer: true,
  })

  httpServer.on('upgrade', (request, socket, head) => {
    const {pathname} = new URL(
      request.url || '',
      `http://${request.headers.host}`
    )

    if (pathname === TWILIO_PHONE_MEDIA_STREAM_PATH) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ;(ws as { request?: unknown }).request = request
        wss.emit('connection', ws, request)
      })
    }
  })

  wss.on('connection', async (ws: WebSocket) => {
    await handleTwilioPhoneMediaStreamConnection(ws)
  })
}
