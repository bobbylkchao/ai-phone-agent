import type { HttpMcpServerDefinition } from '@/foundation/mcp-server'
import { registerHotelSearchTools, SEARCH_HOTEL_TOOL } from './tools'

export const hotelBookingMcpServer: HttpMcpServerDefinition = {
  name: 'hotel-booking-example',
  path: '/hotel-booking-mcp',
  serverLabel: 'hotel_booking',
  toolNames: [SEARCH_HOTEL_TOOL],
  registerTools: registerHotelSearchTools,
}
