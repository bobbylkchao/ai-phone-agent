import {
  DEFAULT_BRAND,
  getSipVoiceAgentInstructions,
} from '../sip-instructions'

describe('getSipVoiceAgentInstructions', () => {
  it('falls back to the default brand', () => {
    expect(getSipVoiceAgentInstructions({})).toContain(DEFAULT_BRAND)
    expect(getSipVoiceAgentInstructions({ partnerName: '   ' })).toContain(
      DEFAULT_BRAND
    )
  })

  it('uses the partner brand when Connect provides one', () => {
    const instructions = getSipVoiceAgentInstructions({
      partnerName: 'Northwind Travel',
    })

    expect(instructions).toContain('Northwind Travel')
    expect(instructions).not.toContain(DEFAULT_BRAND)
  })

  it('documents the three Realtime tools and the spoken goodbye rule', () => {
    const instructions = getSipVoiceAgentInstructions({})

    expect(instructions).toContain('update_trip_intake')
    expect(instructions).toContain('transfer_to_human_agent')
    expect(instructions).toContain('disconnect_the_call')
    expect(instructions).toContain('thank-you and goodbye')
  })
})
