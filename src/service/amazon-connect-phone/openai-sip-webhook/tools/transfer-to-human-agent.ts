import { z } from 'zod'
import logger from '@/misc/logger'
import { updateContactAttributes } from '@/foundation/amazon-connect/update-attributes'
import { deleteCall, getContactId } from '../call-store'
import { hangUpOpenAiSipCall } from '../handle-call/hang-up-call'
import { closeOpenAiSipWebSocketForCall } from '../websocket/connect-to-call'

const transferSchema = z.object({
  summary: z
    .string()
    .optional()
    .describe('Brief, non-sensitive summary of the conversation.'),
})

export const transferToHumanAgentParametersJsonSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Brief, non-sensitive summary of the conversation.',
    },
  },
  additionalProperties: false,
} as const

/**
 * Ends the AI leg so Connect can route to a queue/agent; optionally writes a summary to contact
 * attributes when the Connect SDK is configured.
 *
 * For SIP, prefer scheduling via `transfer-hangup-scheduler` so hangup runs after assistant
 * audio finishes (see `runTransferToHumanAgentHangup`).
 */
export const runTransferToHumanAgentHangup = async (
  callId: string,
  rawArgs: string | Record<string, unknown>
): Promise<void> => {
  const args =
    typeof rawArgs === 'string'
      ? (JSON.parse(rawArgs || '{}') as Record<string, unknown>)
      : rawArgs
  const parsed = transferSchema.parse(args ?? {})
  const contactId = getContactId(callId)

  if (contactId && process.env.AMAZON_CONNECT_SDK_ENABLE === 'true') {
    await updateContactAttributes(contactId, {
      AIVoiceAgentHandoff: 'true',
      AIVoiceAgentConversationSummary: parsed.summary ?? '',
    })
    logger.info(
      { callId, contactId },
      '[AmazonConnectPhone] Contact attributes updated for human handoff'
    )
  }

  closeOpenAiSipWebSocketForCall(callId)
  deleteCall(callId)
  await hangUpOpenAiSipCall(callId, contactId ?? '')

  logger.info(
    { callId, contactId },
    '[AmazonConnectPhone] transfer_to_human_agent completed'
  )
}

export const transferToHumanAgentTool = {
  name: 'transfer_to_human_agent',
  description:
    'Call only after the caller explicitly asks to speak with a human agent. Do not suggest or initiate a transfer yourself. Briefly tell the caller they are being transferred before using this tool. This ends the AI portion of the call so Amazon Connect can continue routing.',
  parameters: transferSchema,
  parametersJsonSchema: transferToHumanAgentParametersJsonSchema,
  execute: async (callId: string, args: unknown): Promise<void> => {
    await runTransferToHumanAgentHangup(callId, args as Record<string, unknown>)
  },
}
