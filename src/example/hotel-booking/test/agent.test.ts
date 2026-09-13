import { hotelBookingAgent } from '../agent'
import { hotelBookingMcpServer } from '../mcp-server'
import { SEARCH_HOTEL_TOOL } from '../mcp-server/tools'

describe('hotel booking example agent', () => {
  const originalMcpUrl = process.env.HOTEL_BOOKING_MCP_SERVER_URL

  afterEach(() => {
    if (originalMcpUrl === undefined) {
      delete process.env.HOTEL_BOOKING_MCP_SERVER_URL
    } else {
      process.env.HOTEL_BOOKING_MCP_SERVER_URL = originalMcpUrl
    }
  })

  it('ends its required greeting with the human handoff phrase', () => {
    const instructions = hotelBookingAgent.getInstructions({})

    expect(instructions).toContain('Thanks for calling')
    expect(instructions).toContain('Which city are you planning to visit?')
    const firstTurn = instructions.slice(
      instructions.indexOf('## First turn ##'),
      instructions.indexOf('## Searching ##')
    )
    expect(
      firstTurn
        .trim()
        .endsWith(
          "At any time, you can ask to speak with a human by saying, 'connect me to a human agent.'\""
        )
    ).toBe(true)
  })

  it('requires MCP search and explicit human-transfer requests', () => {
    const instructions = hotelBookingAgent.getInstructions({})

    // the prompt must name the tool the MCP server actually registers
    expect(instructions).toContain(SEARCH_HOTEL_TOOL)
    expect(instructions).toContain(
      'Never say that you will collect, gather, save, or pass information'
    )
    expect(instructions).toContain(
      'only after the caller explicitly asks to speak with a person or human agent'
    )
  })

  it('connects the configured mock MCP server to Realtime', () => {
    process.env.HOTEL_BOOKING_MCP_SERVER_URL =
      'https://phone.example/hotel-booking-mcp'

    // label and allowlist are taken from the server definition, never retyped
    expect(hotelBookingAgent.getMcpServers?.()).toEqual([
      {
        serverLabel: hotelBookingMcpServer.serverLabel,
        serverUrl: 'https://phone.example/hotel-booking-mcp',
        allowedTools: hotelBookingMcpServer.toolNames,
        requireApproval: 'never',
      },
    ])
  })

  it('omits the MCP server until a public URL is configured', () => {
    delete process.env.HOTEL_BOOKING_MCP_SERVER_URL

    expect(hotelBookingAgent.getMcpServers?.()).toEqual([])
  })
})
