import logger from '@/misc/logger'
import { getErrorMessage } from '@/misc/get-error-message'
import { sendHttpRequestToOpenAi } from '@/foundation/open-ai/send-http-request'
import { getPhoneAgentInstructions } from '../agents/entry-agent'
import type { AmazonConnectOpenAiVoiceAgentMetaData } from '../types'
import { setContactId } from '../call-store'
import { getRealtimeToolsConfig } from '../tools'
import { connectOpenAiSipRealtimeWebSocket } from '../websocket/connect-to-call'

export interface AcceptOpenAiSipCallParams {
  callId: string
  metaData?: AmazonConnectOpenAiVoiceAgentMetaData
}

/**
 * Accepts an incoming SIP call via OpenAI Realtime Calls API, then opens the client WebSocket.
 */
export const acceptOpenAiSipCall = async ({
  callId,
  metaData = {},
}: AcceptOpenAiSipCallParams): Promise<{ ok: boolean; error?: string }> => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    logger.error({ callId }, '[AmazonConnectPhone] OPENAI_API_KEY is missing')
    return { ok: false, error: 'OPENAI_API_KEY is missing' }
  }

  const instructions = getPhoneAgentInstructions(metaData)
  const model = process.env.OPENAI_MODEL || 'gpt-realtime-1.5'

  const url = `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/accept`
  const body = {
    type: 'realtime',
    model,
    instructions,
    tools: getRealtimeToolsConfig(),
  }

  try {
    logger.info(
      { callId, metaData },
      '[AmazonConnectPhone] Accepting OpenAI SIP call'
    )

    const res = await sendHttpRequestToOpenAi(url, 'POST', body)

    if (!res.ok) {
      const text = await res.text()
      logger.error(
        { callId, status: res.status, body: text },
        '[AmazonConnectPhone] Accept call failed'
      )
      return { ok: false, error: `Accept failed: ${res.status} ${text}` }
    }

    logger.info({ callId }, '[AmazonConnectPhone] Call accepted')

    if (metaData.contactId) {
      setContactId(callId, metaData.contactId)
    }

    connectOpenAiSipRealtimeWebSocket(callId, metaData.contactId ?? '')

    return { ok: true }
  } catch (error) {
    const errorDetails = getErrorMessage('acceptOpenAiSipCall', error)
    logger.error(
      { ...errorDetails, callId },
      '[AmazonConnectPhone] Accept call error'
    )
    return { ok: false, error: 'Accept call failed' }
  }
}
