import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../tools'

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

const collectTools = (): Map<string, ToolHandler> => {
  const tools = new Map<string, ToolHandler>()
  registerTools({
    registerTool: (name: string, _meta: unknown, handler: ToolHandler) => {
      tools.set(name, handler)
    },
  } as unknown as McpServer)
  return tools
}

describe('post-booking MCP tools', () => {
  it('cancels bookings except the demo failure id', async () => {
    const tools = collectTools()

    await expect(
      tools.get('cancel-booking')?.({ bookingId: 'abc' })
    ).resolves.toEqual(
      expect.objectContaining({ structuredContent: { success: true } })
    )
    await expect(
      tools.get('cancel-booking')?.({ bookingId: '1234' })
    ).resolves.toEqual(
      expect.objectContaining({ structuredContent: { success: false } })
    )
  })

  it('rethrows registration failures', () => {
    expect(() =>
      registerTools({
        registerTool: () => {
          throw new Error('duplicate')
        },
      } as unknown as McpServer)
    ).toThrow('duplicate')
  })
})
