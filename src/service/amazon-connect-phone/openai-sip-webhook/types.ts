/**
 * Session metadata derived from SIP headers or passed at accept time.
 * Extend this type in your fork for business-specific fields (see phone-sales-ai-copilot).
 */
export interface AmazonConnectOpenAiVoiceAgentMetaData {
  contactId?: string
  initialContactId?: string
  queueName?: string
  languageCode?: string
  partnerName?: string
  businessType?: string
  customerPhoneNumber?: string
  systemPhoneNumber?: string
  initiationMethod?: string
  /** Raw Amazon resource ARN from X-Amzn-SourceArn when present */
  amazonConnectSourceArn?: string
}

/**
 * User-to-User (UUI) payload often sent from Amazon Connect as hex-encoded JSON in SIP.
 * Format: "<hex>;encoding=hex" (RFC 7433 style).
 */
export interface UserToUserInfo {
  systemPhoneNumber?: string
  customerPhoneNumber?: string
  contactId?: string
  initialContactId?: string
  queueName?: string
  initiationMethod?: string
  languageCode?: string
  partnerName?: string
  businessType?: string
  [key: string]: unknown
}

export type RealtimeCallIncomingEventSipHeaderName =
  'X-Amzn-SourceArn' | 'X-Amzn-ConnectContactId' | 'User-to-User'

export interface RealtimeCallIncomingEventSipHeader {
  name: RealtimeCallIncomingEventSipHeaderName
  value: string
}

/** Webhook payload for realtime.call.incoming (OpenAI → your server). */
export interface RealtimeCallIncomingEvent {
  object: 'event'
  id: string
  type: 'realtime.call.incoming'
  created_at: number
  data: {
    call_id: string
    sip_headers: RealtimeCallIncomingEventSipHeader[]
  }
}
