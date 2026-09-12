import type { HttpMcpServerDefinition } from '@/foundation/mcp-server'
import { registerHotelSearchTools } from './tools'

export const hotelBookingMcpServer: HttpMcpServerDefinition = {
  name: 'hotel-booking-example',
  path: '/hotel-booking-mcp',
  registerTools: registerHotelSearchTools,
}
