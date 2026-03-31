/**
 * Per-call state for Amazon Connect + OpenAI Realtime Calls (SIP) path.
 * Intake fields are merged via `update_trip_intake` and sent to Connect on handoff.
 */
export interface SipTripIntakeData {
  customerName?: string
  /** Free-form notes on what the customer wants (destination, dates, party, preferences). */
  tripRequirementsNotes?: string
}

const contactIdByCallId = new Map<string, string>()
const intakeByCallId = new Map<string, SipTripIntakeData>()

export const setContactId = (callId: string, contactId: string): void => {
  if (contactId) contactIdByCallId.set(callId, contactId)
}

export const getContactId = (callId: string): string | undefined => contactIdByCallId.get(callId)

export const mergeTripIntake = (
  callId: string,
  data: Partial<SipTripIntakeData>
): void => {
  const existing = intakeByCallId.get(callId) ?? {}
  intakeByCallId.set(callId, { ...existing, ...data })
}

export const getTripIntake = (
  callId: string
): SipTripIntakeData | undefined => intakeByCallId.get(callId)

export const deleteCall = (callId: string): void => {
  contactIdByCallId.delete(callId)
  intakeByCallId.delete(callId)
}
