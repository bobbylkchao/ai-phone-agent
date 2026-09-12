import type { AmazonConnectOpenAiVoiceAgentMetaData } from '../types'
import { getSipVoiceAgentInstructions } from './sip-instructions'

const buildConnectContextSection = (
  meta: AmazonConnectOpenAiVoiceAgentMetaData
): string => {
  const lines: string[] = [
    '## Amazon Connect session context (routing / metadata only) ##',
    '- These fields are for language and routing. They are **not** a confirmed hotel booking or travel itinerary unless explicitly stated as such below.',
  ]
  if (meta.contactId) lines.push(`- Contact ID: ${meta.contactId}`)
  if (meta.queueName) lines.push(`- Queue: ${meta.queueName}`)
  if (meta.languageCode) lines.push(`- Language: ${meta.languageCode}`)
  if (meta.partnerName)
    lines.push(`- Partner / brand label: ${meta.partnerName}`)
  if (meta.businessType)
    lines.push(
      `- Business type (operational label, not a customer itinerary): ${meta.businessType}`
    )
  if (meta.customerPhoneNumber)
    lines.push(`- Customer phone (from Connect): ${meta.customerPhoneNumber}`)
  if (meta.amazonConnectSourceArn)
    lines.push(`- Source ARN: ${meta.amazonConnectSourceArn}`)
  if (lines.length === 2) {
    return ''
  }
  return lines.join('\n')
}

/**
 * Builds instructions for POST /v1/realtime/calls/{call_id}/accept.
 * SIP uses dedicated intake and handoff prompts from `sip-instructions.ts`.
 */
export const getPhoneAgentInstructions = (
  metaData: AmazonConnectOpenAiVoiceAgentMetaData = {}
): string => {
  const connectContext = buildConnectContextSection(metaData)

  return [getSipVoiceAgentInstructions(metaData), connectContext]
    .filter(Boolean)
    .join('\n\n')
    .trim()
}
