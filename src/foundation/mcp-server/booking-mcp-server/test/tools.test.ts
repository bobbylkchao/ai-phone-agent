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

describe('booking MCP tools', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns canned hotel results and checkout success', async () => {
    const tools = collectTools()

    const hotels = await tools.get('search-hotel')?.({
      city: 'Paris',
      country: 'France',
      checkInDate: '2026-05-01',
      checkOutDate: '2026-05-05',
    })
    const checkout = await tools.get(
      'send-checkout-link-to-customer-via-email'
    )?.({ email: 'guest@example.com' })

    expect(hotels).toEqual(
      expect.objectContaining({
        structuredContent: expect.objectContaining({
          hotels: expect.arrayContaining([
            expect.objectContaining({ name: 'Hotel 1' }),
          ]),
        }),
      })
    )
    expect(checkout).toEqual(
      expect.objectContaining({ structuredContent: { success: true } })
    )
  })

  it('loads destination weather from the geocoding and archive APIs', async () => {
    const tools = collectTools()
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ results: [{ latitude: 1, longitude: 2 }] })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            daily: {
              temperature_2m_max: [21],
              temperature_2m_min: [10],
              precipitation_sum: [0],
            },
          })
        )
      )

    await expect(
      tools.get('get-destination-weather')?.({
        city: 'Paris',
        country: 'France',
        todayDate: '2026-05-01',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        structuredContent: {
          maxTemperature: 21,
          minTemperature: 10,
          precipitation: 0,
        },
      })
    )
  })

  it('tolerates an unknown city and reports request failures', async () => {
    const tools = collectTools()
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ daily: {} })))
      .mockRejectedValueOnce(new Error('geo down'))

    await expect(
      tools.get('get-destination-weather')?.({
        city: 'Nowhere',
        country: 'Nowhere',
        todayDate: '2026-05-01',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        structuredContent: {
          maxTemperature: undefined,
          minTemperature: undefined,
          precipitation: undefined,
        },
      })
    )
    await expect(
      tools.get('get-destination-weather')?.({
        city: 'Paris',
        country: 'France',
        todayDate: '2026-05-01',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        structuredContent: {
          maxTemperature: null,
          minTemperature: null,
          precipitation: null,
        },
      })
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
