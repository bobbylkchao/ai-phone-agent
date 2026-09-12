import { getPhoneAgentInstructions } from '../entry-agent'

describe('getPhoneAgentInstructions', () => {
  it('omits the Connect context when no routing metadata is present', () => {
    expect(getPhoneAgentInstructions()).not.toContain(
      'Amazon Connect session context'
    )
  })

  it('appends every routing field that Connect provided', () => {
    const instructions = getPhoneAgentInstructions({
      partnerName: 'Northwind Travel',
      contactId: 'contact-1',
      queueName: 'Sales',
      languageCode: 'en-US',
      businessType: 'leisure',
      customerPhoneNumber: '+15550000000',
      amazonConnectSourceArn: 'arn:aws:connect:example',
    })

    expect(instructions).toContain('Amazon Connect session context')
    expect(instructions).toContain('Contact ID: contact-1')
    expect(instructions).toContain('Queue: Sales')
    expect(instructions).toContain('Language: en-US')
    expect(instructions).toContain('Partner / brand label: Northwind Travel')
    expect(instructions).toContain(
      'Business type (operational label, not a customer itinerary): leisure'
    )
    expect(instructions).toContain(
      'Customer phone (from Connect): +15550000000'
    )
    expect(instructions).toContain('Source ARN: arn:aws:connect:example')
  })
})
