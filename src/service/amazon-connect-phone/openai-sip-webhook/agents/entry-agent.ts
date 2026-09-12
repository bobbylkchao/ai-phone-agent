import type { AmazonConnectOpenAiVoiceAgentMetaData } from '../types'
import type { VoiceAgentDefinition } from '../types'

const buildConnectContextSection = (
  meta: AmazonConnectOpenAiVoiceAgentMetaData
): string => {
  const lines: string[] = [
    '## Amazon Connect session context ##',
    '- Treat these values as call metadata, not as user-provided business data.',
  ]
  if (meta.contactId) lines.push(`- Contact ID: ${meta.contactId}`)
  if (meta.initialContactId)
    lines.push(`- Initial contact ID: ${meta.initialContactId}`)
  if (meta.queueName) lines.push(`- Queue: ${meta.queueName}`)
  if (meta.initiationMethod)
    lines.push(`- Initiation method: ${meta.initiationMethod}`)
  if (meta.customerPhoneNumber)
    lines.push(`- Customer phone (from Connect): ${meta.customerPhoneNumber}`)
  if (meta.systemPhoneNumber)
    lines.push(`- System phone (from Connect): ${meta.systemPhoneNumber}`)
  if (lines.length === 2) {
    return ''
  }
  return lines.join('\n')
}

/**
 * Builds instructions for POST /v1/realtime/calls/{call_id}/accept.
 */
export const getPhoneAgentInstructions = (
  agent: VoiceAgentDefinition,
  metaData: AmazonConnectOpenAiVoiceAgentMetaData = {}
): string => {
  const connectContext = buildConnectContextSection(metaData)

  return [agent.getInstructions(metaData), connectContext]
    .filter(Boolean)
    .join('\n\n')
    .trim()
}
