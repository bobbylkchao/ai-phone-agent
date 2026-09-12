import { getPhoneAgentInstructions } from '../entry-agent'
import type { VoiceAgentDefinition } from '../../types'

const agent: VoiceAgentDefinition = {
  getInstructions: () => 'You are a generic voice agent.',
}

describe('getPhoneAgentInstructions', () => {
  it('omits the Connect context when no routing metadata is present', () => {
    expect(getPhoneAgentInstructions(agent)).not.toContain(
      'Amazon Connect session context'
    )
    expect(getPhoneAgentInstructions(agent)).toContain(
      'You are a generic voice agent.'
    )
  })

  it('appends every routing field that Connect provided', () => {
    const instructions = getPhoneAgentInstructions(agent, {
      contactId: 'contact-1',
      initialContactId: 'initial-1',
      initiationMethod: 'INBOUND',
      customerPhoneNumber: '+15550000000',
      systemPhoneNumber: '+15551111111',
    })

    expect(instructions).toContain('Amazon Connect session context')
    expect(instructions).toContain('Contact ID: contact-1')
    expect(instructions).toContain('Initial contact ID: initial-1')
    expect(instructions).toContain('Initiation method: INBOUND')
    expect(instructions).toContain(
      'Customer phone (from Connect): +15550000000'
    )
    expect(instructions).toContain('System phone (from Connect): +15551111111')
  })
})
