import {
  deleteCall,
  getContactId,
  getTripIntake,
  mergeTripIntake,
  setContactId,
} from '../call-store'

describe('call store', () => {
  const callId = 'call-1'

  afterEach(() => {
    deleteCall(callId)
  })

  it('ignores an empty contact id', () => {
    setContactId(callId, '')

    expect(getContactId(callId)).toBeUndefined()
  })

  it('stores, merges, and deletes state per call', () => {
    setContactId(callId, 'contact-1')
    mergeTripIntake(callId, { customerName: 'Ada' })
    mergeTripIntake(callId, { tripRequirementsNotes: 'Tokyo in May' })

    expect(getContactId(callId)).toBe('contact-1')
    expect(getTripIntake(callId)).toEqual({
      customerName: 'Ada',
      tripRequirementsNotes: 'Tokyo in May',
    })

    deleteCall(callId)
    expect(getContactId(callId)).toBeUndefined()
    expect(getTripIntake(callId)).toBeUndefined()
  })

  it('keeps concurrent calls isolated', () => {
    setContactId(callId, 'contact-1')
    setContactId('call-2', 'contact-2')
    mergeTripIntake('call-2', { customerName: 'Grace' })

    expect(getContactId(callId)).toBe('contact-1')
    expect(getTripIntake(callId)).toBeUndefined()
    expect(getTripIntake('call-2')).toEqual({ customerName: 'Grace' })

    deleteCall('call-2')
  })
})
