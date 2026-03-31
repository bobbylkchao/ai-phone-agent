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
 */
export const disconnectTheCallTool = {
  name: 'disconnect_the_call',
  description:
    "Call this only when the customer explicitly wants to end the call—e.g. 'thanks, bye', 'I'm done', 'goodbye', or equivalent. Do not call this if only you suggested ending; the customer must have indicated they are finished. Provide `summary` for audit: no real names or PII (use 'Customer' only); say who chose to end (Customer vs AI agent); say why the conversation did not continue.",
  parameters: disconnectTheCallParams,
  parametersJsonSchema: disconnectTheCallParametersJsonSchema,
  execute: async (callId: string, args: unknown): Promise<void> => {
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
  },
}
