import { hotelBookingAgent } from '../agent'

describe('hotel booking example agent', () => {
  it('starts with a simple city question', () => {
    const instructions = hotelBookingAgent.getInstructions({})

    expect(instructions).toContain('Thanks for calling')
    expect(instructions).toContain('Which city are you planning to visit?')
  })

  it('does not claim that the MCP stub is connected', () => {
    const instructions = hotelBookingAgent.getInstructions({})

    expect(instructions).toContain('do not have access to live hotel inventory')
    expect(instructions).toContain('transfer_to_human_agent')
    expect(instructions).toContain('disconnect_the_call')
  })
})
