import { initMcpServers, mcpServerList } from '../index'
import { initBookingMcpServer } from '../booking-mcp-server'
import { initPostBookingMcpServer } from '../post-booking-mcp-server'

jest.mock('../booking-mcp-server', () => ({
  initBookingMcpServer: jest.fn(),
}))
jest.mock('../post-booking-mcp-server', () => ({
  initPostBookingMcpServer: jest.fn(),
}))

describe('MCP server registry', () => {
  it('starts both demo MCP servers', () => {
    const app = {} as never

    initMcpServers(app, 4000)

    expect(initBookingMcpServer).toHaveBeenCalledWith(app, 4000)
    expect(initPostBookingMcpServer).toHaveBeenCalledWith(app, 4000)
  })

  it('lists both demo servers for the status page', () => {
    expect(mcpServerList.map((server) => server.name)).toEqual([
      'booking-mcp-server',
      'post-booking-mcp-server',
    ])
  })
})
