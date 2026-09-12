import type { z } from 'zod'

export interface VoiceAgentTool {
  name: string
  description: string
  parameters: z.ZodType<unknown>
  /** OpenAI Realtime `function` tool `parameters` JSON Schema */
  parametersJsonSchema: unknown
  execute: (callId: string, args: unknown) => Promise<unknown>
}

export interface VoiceAgentDefinition {
  getInstructions: (metaData: AmazonConnectOpenAiVoiceAgentMetaData) => string
  tools?: VoiceAgentTool[]
}

/**
 * Session metadata derived from SIP headers or passed at accept time.
 * Keep product-specific data in the injected application layer.
 */
export interface AmazonConnectOpenAiVoiceAgentMetaData {
  contactId?: string
  initialContactId?: string
  initiationMethod?: string
  customerPhoneNumber?: string
  systemPhoneNumber?: string
}

/**
 * User-to-User (UUI) payload often sent from Amazon Connect as hex-encoded JSON in SIP.
 * Format: "<hex>;encoding=hex" (RFC 7433 style).
 */
export interface UserToUserInfo {
  contactId?: string
  initialContactId?: string
  initiationMethod?: string
  customerPhoneNumber?: string
  systemPhoneNumber?: string
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
