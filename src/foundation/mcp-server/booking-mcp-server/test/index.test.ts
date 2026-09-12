import { EventEmitter } from 'node:events'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Express, Request, Response } from 'express'
import { initBookingMcpServer } from '../index'
import { registerTools } from '../tools'

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn(),
}))
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn(),
}))
jest.mock('../tools', () => ({ registerTools: jest.fn() }))

type RouteHandler = (req: Request, res: Response) => Promise<void>

class FakeResponse extends EventEmitter {
  status = jest.fn(() => this)
  json = jest.fn(() => this)
}

describe('booking MCP HTTP route', () => {
  const connect = jest.fn()
  const close = jest.fn()
  const handleRequest = jest.fn()
  let routes: Map<string, RouteHandler>
  let app: Express

  beforeEach(() => {
    routes = new Map()
    app = {
      post: jest.fn((path: string, handler: RouteHandler) => {
        routes.set(path, handler)
      }),
    } as unknown as Express

    jest.mocked(McpServer).mockImplementation(() => ({ connect }) as never)
    jest
      .mocked(StreamableHTTPServerTransport)
      .mockImplementation(() => ({ close, handleRequest }) as never)
    connect.mockResolvedValue(undefined)
    close.mockResolvedValue(undefined)
    handleRequest.mockResolvedValue(undefined)
  })

  it('registers tools and serves one stateless request per call', async () => {
    initBookingMcpServer(app, 4000)

    expect(McpServer).toHaveBeenCalledWith({
      name: 'booking-mcp-server',
      version: '1.0.0',
    })
    expect(registerTools).toHaveBeenCalled()
    expect(StreamableHTTPServerTransport).not.toHaveBeenCalled()

    const req = { body: { jsonrpc: '2.0' } } as Request
    const res = new FakeResponse()
    await routes.get('/booking-mcp')?.(req, res as unknown as Response)

    expect(StreamableHTTPServerTransport).toHaveBeenCalledWith({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    expect(connect).toHaveBeenCalled()
    expect(handleRequest).toHaveBeenCalledWith(req, res, req.body)

    res.emit('close')
    expect(close).toHaveBeenCalled()
  })

  it('returns 500 when the MCP server cannot connect', async () => {
    connect.mockRejectedValueOnce(new Error('connect failed'))
    initBookingMcpServer(app, 4000)

    const res = new FakeResponse()
    await routes.get('/booking-mcp')?.(
      { body: {} } as Request,
      res as unknown as Response
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
    expect(handleRequest).not.toHaveBeenCalled()
  })

  it('absorbs initialization errors without registering a route', () => {
    jest.mocked(McpServer).mockImplementationOnce(() => {
      throw new Error('constructor failed')
    })

    expect(() => initBookingMcpServer(app, 4000)).not.toThrow()
    expect(app.post).not.toHaveBeenCalled()
  })
})
