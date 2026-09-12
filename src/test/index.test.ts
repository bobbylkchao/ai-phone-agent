import express from 'express'
import { config } from 'dotenv'
import { createServer } from 'node:http'
import { initMcpServers } from '@/foundation/mcp-server'
import { hotelBookingAgent } from '@/example/hotel-booking/agent'
import { hotelBookingMcpServer } from '@/example/hotel-booking/mcp-server'
import logger from '@/misc/logger'
import { registerStatusRoutes } from '@/misc/status-routes'
import { initAmazonConnectPhoneChannel } from '@/service/amazon-connect-phone'

jest.mock('express', () => {
  const expressMock = Object.assign(jest.fn(), {
    json: jest.fn(),
    urlencoded: jest.fn(),
  })
  return { __esModule: true, default: expressMock }
})
jest.mock('dotenv', () => ({ config: jest.fn() }))
jest.mock('node:http', () => ({ createServer: jest.fn() }))
jest.mock('@/foundation/mcp-server', () => ({ initMcpServers: jest.fn() }))
jest.mock('@/example/hotel-booking/agent', () => ({
  hotelBookingAgent: { getInstructions: jest.fn() },
}))
jest.mock('@/example/hotel-booking/mcp-server', () => ({
  hotelBookingMcpServer: {
    name: 'hotel-booking-example',
    path: '/hotel-booking-mcp',
    registerTools: jest.fn(),
  },
}))
jest.mock('@/misc/status-routes', () => ({ registerStatusRoutes: jest.fn() }))
jest.mock('@/service/amazon-connect-phone', () => ({
  initAmazonConnectPhoneChannel: jest.fn(),
}))

const loadApplication = (): void => {
  jest.isolateModules(() => {
    jest.requireActual<typeof import('../index')>('../index')
  })
}

describe('application startup', () => {
  const originalPort = process.env.PORT
  const app = { use: jest.fn() }
  const server = { listen: jest.fn(), on: jest.fn() }

  beforeEach(() => {
    jest.mocked(express).mockReturnValue(app as never)
    jest.mocked(express.json).mockReturnValue('json-middleware' as never)
    jest
      .mocked(express.urlencoded)
      .mockReturnValue('urlencoded-middleware' as never)
    jest.mocked(createServer).mockReturnValue(server as never)
    process.env.PORT = '4567'
  })

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT
    } else {
      process.env.PORT = originalPort
    }
  })

  it('configures middleware and starts every service', () => {
    loadApplication()

    expect(config).toHaveBeenCalledWith({ quiet: true })
    expect(app.use).toHaveBeenNthCalledWith(1, 'json-middleware')
    expect(app.use).toHaveBeenNthCalledWith(2, 'urlencoded-middleware')
    expect(registerStatusRoutes).toHaveBeenCalledWith(app, 4567, [
      { name: 'hotel-booking-example', path: '/hotel-booking-mcp' },
    ])
    expect(createServer).toHaveBeenCalledWith(app)
    expect(initAmazonConnectPhoneChannel).toHaveBeenCalledWith(
      app,
      hotelBookingAgent
    )
    expect(initMcpServers).toHaveBeenCalledWith(app, [hotelBookingMcpServer])
    expect(server.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(server.listen).toHaveBeenCalledWith(4567, expect.any(Function))

    const listenCallback = server.listen.mock.calls[0][1] as () => void
    listenCallback()
    expect(jest.mocked(logger.info)).toHaveBeenCalledWith(
      '[Server] Server started successfully'
    )
  })

  it('uses port 4000 when PORT is invalid', () => {
    process.env.PORT = 'invalid'

    loadApplication()

    expect(registerStatusRoutes).toHaveBeenCalledWith(app, 4000, [
      { name: 'hotel-booking-example', path: '/hotel-booking-mcp' },
    ])
    expect(server.listen).toHaveBeenCalledWith(4000, expect.any(Function))
  })

  it('logs listener errors and exits with a failure status', () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    loadApplication()

    const errorHandler = server.on.mock.calls[0][1] as (error: Error) => void
    const error = new Error('address in use')
    errorHandler(error)

    expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
      { err: error },
      '[Server] HTTP server failed to start'
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('catches synchronous service initialization failures', () => {
    jest.mocked(initAmazonConnectPhoneChannel).mockImplementationOnce(() => {
      throw new Error('bad configuration')
    })

    expect(loadApplication).not.toThrow()
    expect(server.listen).not.toHaveBeenCalled()
    expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      '[Server] Application start failed due to error'
    )
  })
})
