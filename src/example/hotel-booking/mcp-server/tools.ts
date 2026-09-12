import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import logger from '@/misc/logger'

export interface HotelSearchResult {
  name: string
  city: string
  nightlyRate: number
  currency: string
}

export const searchHotelsStub = (city: string): HotelSearchResult[] => [
  {
    name: 'Example Central Hotel',
    city,
    nightlyRate: 120,
    currency: 'USD',
  },
  {
    name: 'Example Riverside Hotel',
    city,
    nightlyRate: 165,
    currency: 'USD',
  },
]

export const registerHotelSearchTools = (server: McpServer): void => {
  server.registerTool(
    'search-hotel',
    {
      title: 'Search hotels',
      description:
        'Example hotel search stub. Returns placeholder hotels for a city; replace this implementation with a real provider such as Expedia.',
      inputSchema: {
        city: z.string().min(1),
      },
      outputSchema: {
        hotels: z.array(
          z.object({
            name: z.string(),
            city: z.string(),
            nightlyRate: z.number(),
            currency: z.string(),
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
