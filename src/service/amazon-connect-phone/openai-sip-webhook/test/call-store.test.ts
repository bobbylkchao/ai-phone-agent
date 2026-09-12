import { deleteCall, getContactId, setContactId } from '../call-store'

describe('call store', () => {
  const callId = 'call-1'

  afterEach(() => {
    deleteCall(callId)
  })

  it('ignores an empty contact id', () => {
    setContactId(callId, '')

    expect(getContactId(callId)).toBeUndefined()
  })

  it('stores and deletes a contact id per call', () => {
    setContactId(callId, 'contact-1')

    expect(getContactId(callId)).toBe('contact-1')

    deleteCall(callId)
    expect(getContactId(callId)).toBeUndefined()
  })

  it('keeps concurrent calls isolated', () => {
    setContactId(callId, 'contact-1')
    setContactId('call-2', 'contact-2')

    expect(getContactId(callId)).toBe('contact-1')
    expect(getContactId('call-2')).toBe('contact-2')

    deleteCall('call-2')
  })
})
