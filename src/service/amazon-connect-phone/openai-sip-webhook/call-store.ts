/**
 * Per-call state for the Amazon Connect + OpenAI Realtime SIP path.
 */
const contactIdByCallId = new Map<string, string>()

export const setContactId = (callId: string, contactId: string): void => {
  if (contactId) contactIdByCallId.set(callId, contactId)
}

export const getContactId = (callId: string): string | undefined =>
  contactIdByCallId.get(callId)

export const deleteCall = (callId: string): void => {
  contactIdByCallId.delete(callId)
}
