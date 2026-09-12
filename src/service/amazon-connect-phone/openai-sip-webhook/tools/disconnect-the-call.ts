import { z } from 'zod'
import logger from '@/misc/logger'
import { updateContactAttributes } from '@/foundation/amazon-connect/update-attributes'
import { getContactId, deleteCall } from '../call-store'
import { hangUpOpenAiSipCall } from '../handle-call/hang-up-call'
import { closeOpenAiSipWebSocketForCall } from '../websocket/connect-to-call'

const summaryDescribe =
  'Short plain narrative of the call for audit (no PII): never include real name, email, phone, or other identifiers—refer to the caller only as "Customer". Write a simple chronological log of the request, the response, and who asked to end the call. Do not use field labels such as "Initiator" or "Reason". Use the same language as the conversation when practical.'

const disconnectTheCallParams = z.object({
  summary: z.string().optional().describe(summaryDescribe),
})

export const disconnectTheCallParametersJsonSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: summaryDescribe,
    },
  },
  additionalProperties: false,
} as const

/**
 * Ends the call when the customer clearly wants to hang up.
 * Optionally sets Amazon Connect contact attributes when the SDK client is initialized.
 *
 * For SIP, prefer scheduling via `disconnect-hangup-scheduler` so hangup runs after assistant
 * audio finishes (see `runDisconnectTheCallHangup`).
 */
export const runDisconnectTheCallHangup = async (
  callId: string,
  rawArgs: string | Record<string, unknown>
): Promise<void> => {
  const args =
    typeof rawArgs === 'string'
      ? (JSON.parse(rawArgs || '{}') as Record<string, unknown>)
      : rawArgs
  const parsed = disconnectTheCallParams.parse(args ?? {})
  const contactId = getContactId(callId)

  if (contactId && process.env.AMAZON_CONNECT_SDK_ENABLE === 'true') {
    await updateContactAttributes(contactId, {
      AIVoiceAgentHandoff: 'false',
      AIVoiceAgentConversationSummary: parsed.summary ?? '',
    })
    logger.info(
      { callId, contactId },
      '[AmazonConnectPhone] Contact attributes updated for disconnect'
    )
  }

  closeOpenAiSipWebSocketForCall(callId)
  deleteCall(callId)
  await hangUpOpenAiSipCall(callId, contactId ?? '')

  logger.info(
    { callId, contactId },
    '[AmazonConnectPhone] disconnect_the_call completed'
  )
}

export const disconnectTheCallTool = {
  name: 'disconnect_the_call',
  description:
    "Last step only: call when the customer clearly wants to end the call. Do not use if only you suggested hanging up. **Hard requirement:** Your response must include **assistant spoken audio (thank-you + goodbye) in the same turn before this tool runs**—same response must not be tool-only (zero speech). Order: speak the closing, then call this tool. If their last utterance had no transcript, infer they may want to end and still say a brief goodbye out loud, then call this. `summary`: short chronological narrative (topic, customer needs, what you said, who asked to hang up); no PII—use 'Customer' only.",
  parameters: disconnectTheCallParams,
  parametersJsonSchema: disconnectTheCallParametersJsonSchema,
  execute: async (callId: string, args: unknown): Promise<void> => {
    await runDisconnectTheCallHangup(callId, args as Record<string, unknown>)
  },
}
