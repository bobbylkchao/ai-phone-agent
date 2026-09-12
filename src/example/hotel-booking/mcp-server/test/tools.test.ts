import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerHotelSearchTools, searchHotelsStub } from '../tools'

type ToolHandler = (args: { city: string }) => Promise<unknown>

describe('hotel search MCP stub', () => {
  it('returns deterministic placeholder hotels for the requested city', () => {
    expect(searchHotelsStub('Chicago')).toEqual([
      expect.objectContaining({
        name: 'Example Central Hotel',
        city: 'Chicago',
      }),
      expect.objectContaining({
        name: 'Example Riverside Hotel',
        city: 'Chicago',
      }),
    ])
  })

  it('registers a callable search-hotel MCP tool', async () => {
    let handler: ToolHandler | undefined
    const server = {
      registerTool: jest.fn(
        (name: string, _metadata: unknown, registeredHandler: ToolHandler) => {
          expect(name).toBe('search-hotel')
          handler = registeredHandler
        }
      ),
    } as unknown as McpServer

    registerHotelSearchTools(server)

    await expect(handler?.({ city: 'Chicago' })).resolves.toEqual(
      expect.objectContaining({
        structuredContent: {
          hotels: expect.arrayContaining([
            expect.objectContaining({ city: 'Chicago' }),
          ]),
        },
      })
    )
  })

  it('surfaces MCP registration failures', () => {
    const server = {
      registerTool: () => {
        throw new Error('duplicate tool')
      },
    } as unknown as McpServer

    expect(() => registerHotelSearchTools(server)).toThrow('duplicate tool')
  })
})
