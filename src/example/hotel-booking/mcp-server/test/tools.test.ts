import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerHotelSearchTools, searchHotelsStub } from '../tools'

type ToolHandler = (args: { city: string }) => Promise<unknown>

describe('hotel search MCP stub', () => {
  it('returns the mock hotels, fully described, for the requested city', () => {
    const hotels = searchHotelsStub('Chicago')

    expect(hotels).toHaveLength(8)
    hotels.forEach((hotel) => {
      expect(hotel).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          city: 'Chicago',
          neighborhood: expect.any(String),
          starRating: expect.any(Number),
          nightlyRate: expect.any(Number),
          currency: 'USD',
          availableRooms: expect.any(Number),
          freeCancellation: expect.any(Boolean),
          amenities: expect.arrayContaining([expect.any(String)]),
        })
      )
      expect(hotel.nightlyRate).toBeGreaterThan(0)
      expect(hotel.availableRooms).toBeGreaterThan(0)
    })

    const names = hotels.map((hotel) => hotel.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('returns the same inventory regardless of city', () => {
    const withoutCity = (city: string) =>
      searchHotelsStub(city).map(({ city: _city, ...hotel }) => hotel)

    expect(withoutCity('Chicago')).toEqual(withoutCity('Toronto'))
    expect(searchHotelsStub(' Toronto ')[0]?.city).toBe('Toronto')
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
