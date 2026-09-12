import { hotelBookingMcpServer } from '../index'
import { registerHotelSearchTools } from '../tools'

describe('hotel booking MCP server definition', () => {
  it('exposes the example at a dedicated endpoint', () => {
    expect(hotelBookingMcpServer).toEqual({
      name: 'hotel-booking-example',
      path: '/hotel-booking-mcp',
      registerTools: registerHotelSearchTools,
    })
  })
})
