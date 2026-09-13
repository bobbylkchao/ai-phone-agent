import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import logger from '@/misc/logger'

/** Shared by the registration below and the Realtime allowlist. */
export const SEARCH_HOTEL_TOOL = 'search-hotel'

export interface HotelSearchResult {
  name: string
  city: string
  neighborhood: string
  starRating: number
  nightlyRate: number
  currency: string
  availableRooms: number
  freeCancellation: boolean
  amenities: string[]
}

/**
 * Fixed mock inventory for the runnable example. Swap this module for a real
 * provider (e.g. an Expedia MCP server) without touching the phone core.
 */
const MOCK_HOTELS: Omit<HotelSearchResult, 'city'>[] = [
  {
    name: 'The Rosewood Grand',
    neighborhood: 'downtown',
    starRating: 5,
    nightlyRate: 289,
    currency: 'USD',
    availableRooms: 3,
    freeCancellation: true,
    amenities: ['rooftop pool', 'full spa', 'valet parking'],
  },
  {
    name: 'Harborview Suites',
    neighborhood: 'the waterfront',
    starRating: 4,
    nightlyRate: 212,
    currency: 'USD',
    availableRooms: 6,
    freeCancellation: true,
    amenities: ['free breakfast', 'harbor views', 'fitness center'],
  },
  {
    name: 'Parkside Garden Hotel',
    neighborhood: 'beside the central park',
    starRating: 4,
    nightlyRate: 196,
    currency: 'USD',
    availableRooms: 2,
    freeCancellation: false,
    amenities: ['garden terrace', 'free breakfast', 'indoor pool'],
  },
  {
    name: 'Riverstone Residences',
    neighborhood: 'the riverside',
    starRating: 4,
    nightlyRate: 183,
    currency: 'USD',
    availableRooms: 5,
    freeCancellation: true,
    amenities: ['kitchenette', 'on-site laundry', 'river views'],
  },
  {
    name: 'The Lantern Hotel',
    neighborhood: 'the old town district',
    starRating: 4,
    nightlyRate: 174,
    currency: 'USD',
    availableRooms: 8,
    freeCancellation: true,
    amenities: ['free breakfast', 'on-site restaurant'],
  },
  {
    name: 'Maple and Vine Boutique',
    neighborhood: 'the arts quarter',
    starRating: 4,
    nightlyRate: 162,
    currency: 'USD',
    availableRooms: 1,
    freeCancellation: false,
    amenities: ['boutique rooms', 'wine bar', 'pet friendly'],
  },
  {
    name: 'Cityline Inn',
    neighborhood: 'the financial district',
    starRating: 3,
    nightlyRate: 138,
    currency: 'USD',
    availableRooms: 9,
    freeCancellation: true,
    amenities: ['free wifi', 'business center'],
  },
  {
    name: 'Union Square Lodge',
    neighborhood: 'near the convention center',
    starRating: 3,
    nightlyRate: 121,
    currency: 'USD',
    availableRooms: 4,
    freeCancellation: false,
    amenities: ['free breakfast', 'airport shuttle'],
  },
]

export const searchHotelsStub = (city: string): HotelSearchResult[] =>
  MOCK_HOTELS.map((hotel) => ({ ...hotel, city: city.trim() }))

export const registerHotelSearchTools = (server: McpServer): void => {
  server.registerTool(
    SEARCH_HOTEL_TOOL,
    {
      title: 'Search hotels',
      description:
        'Example hotel search. Returns mock hotel availability for a city, including nightly rate, star rating, neighborhood, and amenities. Replace this implementation with a real provider such as Expedia.',
      inputSchema: {
        city: z.string().min(1),
      },
      outputSchema: {
        hotels: z.array(
          z.object({
            name: z.string(),
            city: z.string(),
            neighborhood: z.string(),
            starRating: z.number(),
            nightlyRate: z.number(),
            currency: z.string(),
            availableRooms: z.number(),
            freeCancellation: z.boolean(),
            amenities: z.array(z.string()),
          })
        ),
      },
    },
    async ({ city }) => {
      logger.info({ city }, '[Hotel Booking Example] Searching hotels')
      const output = { hotels: searchHotelsStub(city) }
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output,
      }
    }
  )
}
