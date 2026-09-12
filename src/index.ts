import express from 'express'
import { config } from 'dotenv'
import { createServer } from 'http'
import logger from '@/misc/logger'
import { initMcpServers } from '@/foundation/mcp-server'
import { hotelBookingAgent } from '@/example/hotel-booking/agent'
import { hotelBookingMcpServer } from '@/example/hotel-booking/mcp-server'
import { initAmazonConnectPhoneChannel } from '@/service/amazon-connect-phone'
import { registerStatusRoutes } from '@/misc/status-routes'

config({ quiet: true })

const startServices = (): void => {
  logger.info('[Server] Starting server')

  const PORT = Number(process.env.PORT) || 4000

  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  const exampleMcpServers = [hotelBookingMcpServer]
  registerStatusRoutes(
    app,
    PORT,
    exampleMcpServers.map(({ name, path }) => ({ name, path }))
  )
  const httpServer = createServer(app)

  initAmazonConnectPhoneChannel(app, hotelBookingAgent)
  initMcpServers(app, exampleMcpServers)

  httpServer.on('error', (err) => {
    logger.error({ err }, '[Server] HTTP server failed to start')
    process.exit(1)
  })

  httpServer.listen(PORT, () => {
    logger.info('[Server] Server started successfully')
    logger.info(
      `[Server] Open http://localhost:${PORT}/status for all endpoints`
    )
  })
}

try {
  startServices()
} catch (err) {
  logger.error({ err }, '[Server] Application start failed due to error')
}
