import { hotelBookingMcpServer } from '../index'
import { registerHotelSearchTools, SEARCH_HOTEL_TOOL } from '../tools'

describe('hotel booking MCP server definition', () => {
  it('exposes the example at a dedicated endpoint', () => {
    expect(hotelBookingMcpServer).toEqual({
      name: 'hotel-booking-example',
      path: '/hotel-booking-mcp',
      serverLabel: 'hotel_booking',
      toolNames: [SEARCH_HOTEL_TOOL],
      registerTools: registerHotelSearchTools,
    })
  })
})
