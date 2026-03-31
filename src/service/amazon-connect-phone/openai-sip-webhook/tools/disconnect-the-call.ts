import { z } from 'zod'
import logger from '@/misc/logger'
import { updateContactAttributes } from '@/foundation/amazon-connect/update-attributes'
import { getContactId, deleteCall } from '../call-store'
import { hangUpOpenAiSipCall } from '../handle-call/hang-up-call'
import { closeOpenAiSipWebSocketForCall } from '../websocket/connect-to-call'

const summaryDescribe =
  'Audit summary (no PII): never include the caller’s real name, email, phone, or other identifiers—refer to the caller only as "Customer". State who chose to end the session: "Customer" or "AI agent". Then state briefly why the conversation stopped (e.g. declined to continue planning, goal completed, frustration). Example: "Initiator: Customer. Reason: decided not to proceed with trip planning."'

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
    "Use only when the customer clearly wants to end the call (e.g. thanks/bye/done/goodbye). Do not use if only you suggested hanging up. **Before calling this tool, you must speak a short polite closing in the same assistant turn** (thank them and say goodbye in the call language)—never emit only this tool with no spoken audio. If their last utterance had no transcript, still say a brief goodbye, then call this. Provide `summary` for audit: no real names or PII (use 'Customer' only); who chose to end (Customer vs AI agent); why the conversation stopped.",
  parameters: disconnectTheCallParams,
  parametersJsonSchema: disconnectTheCallParametersJsonSchema,
  execute: async (callId: string, args: unknown): Promise<void> => {
    await runDisconnectTheCallHangup(callId, args as Record<string, unknown>)
  },
}
