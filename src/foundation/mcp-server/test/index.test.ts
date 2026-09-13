import { EventEmitter } from 'node:events'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Express, Request, Response } from 'express'
import { initMcpServers, type HttpMcpServerDefinition } from '../index'

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn(),
}))
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn(),
}))

type RouteHandler = (req: Request, res: Response) => Promise<void>

class FakeResponse extends EventEmitter {
  headersSent = false
  status = jest.fn(() => this)
  json = jest.fn(() => this)
}

describe('generic MCP HTTP host', () => {
  const connect = jest.fn()
  const close = jest.fn()
  const handleRequest = jest.fn()
  const registerTools = jest.fn()
  const definition: HttpMcpServerDefinition = {
    name: 'example-server',
    path: '/example-mcp',
    serverLabel: 'example_server',
    toolNames: ['example-tool'],
    registerTools,
  }
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

  it('hosts each supplied definition over Streamable HTTP', async () => {
    initMcpServers(app, [definition])

    const req = { body: { jsonrpc: '2.0' } } as Request
    const res = new FakeResponse()
    await routes.get('/example-mcp')?.(req, res as unknown as Response)

    expect(McpServer).toHaveBeenCalledWith({
      name: 'example-server',
      version: '1.0.0',
    })
    expect(registerTools).toHaveBeenCalled()
    expect(connect).toHaveBeenCalled()
    expect(handleRequest).toHaveBeenCalledWith(req, res, req.body)
    res.emit('close')
    expect(close).toHaveBeenCalled()
  })

  it('returns a sanitized error when a request fails', async () => {
    connect.mockRejectedValueOnce(new Error('connect failed'))
    initMcpServers(app, [definition])
    const res = new FakeResponse()

    await routes.get('/example-mcp')?.(
      { body: {} } as Request,
      res as unknown as Response
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })

  it('does not write a second response after headers were sent', async () => {
    handleRequest.mockRejectedValueOnce(new Error('stream failed'))
    initMcpServers(app, [definition])
    const res = new FakeResponse()
    res.headersSent = true

    await routes.get('/example-mcp')?.(
      { body: {} } as Request,
      res as unknown as Response
    )

    expect(res.status).not.toHaveBeenCalled()
  })

  it('isolates initialization failures to the invalid definition', () => {
    app.post = jest.fn(() => {
      throw new Error('route registration failed')
    }) as never

    expect(() => initMcpServers(app, [definition])).not.toThrow()
    expect(app.post).toHaveBeenCalled()
  })
})
