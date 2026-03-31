import WebSocket from 'ws'
import { getErrorMessage } from '@/misc/get-error-message'
import logger from '@/misc/logger'
import {
  sendResponseCreateEvent,
  sendSessionUpdateSpeed,
} from '../client-side-events'
import { deleteCall, getContactId } from '../call-store'
import { handleMessageIfToolCall } from '../tools'
import {
  clearTransferHangupSchedule,
  noteTransferResponseDone,
} from './transfer-hangup-scheduler'

/** Key = contactId || callId for concurrent calls. */
const wsByKey = new Map<string, WebSocket>()

const CONVERSATION_TIMEOUT_MS = 20 * 1000
const conversationTimeoutIdByKey = new Map<string, NodeJS.Timeout>()

export const onConversationTimeout: (
  callId: string,
  contactId: string
) => void = (callId, contactId) => {
  logger.info(
    { callId, contactId },
    '[AmazonConnectPhone] Conversation timeout (no message received)'
  )
}

const clearConversationTimeout = (key: string): void => {
  const id = conversationTimeoutIdByKey.get(key)
  if (id) {
    clearTimeout(id)
    conversationTimeoutIdByKey.delete(key)
  }
}

const scheduleConversationTimeout = (
  key: string,
  callId: string,
  contactId: string
): void => {
  clearConversationTimeout(key)
  const id = setTimeout(() => {
    conversationTimeoutIdByKey.delete(key)
    onConversationTimeout(callId, contactId)
    if (wsByKey.has(key)) {
      scheduleConversationTimeout(key, callId, contactId)
    }
  }, CONVERSATION_TIMEOUT_MS)
  conversationTimeoutIdByKey.set(key, id)
}

export const closeOpenAiSipWebSocketForCall = (callId: string): void => {
  const contactId = getContactId(callId)
  const key = contactId || callId
  clearTransferHangupSchedule(callId)
  clearConversationTimeout(key)
  const ws = wsByKey.get(key)
  if (ws) {
    ws.removeAllListeners()
    ws.close()
    wsByKey.delete(key)
    logger.info(
      { callId, contactId, key },
      '[AmazonConnectPhone] Closed OpenAI SIP Realtime WebSocket for call'
    )
  }
}

export const connectOpenAiSipRealtimeWebSocket = (
  callId: string,
  contactId: string
): WebSocket => {
  const key = contactId || callId
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const ws = new WebSocket(
    `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )
  wsByKey.set(key, ws)

  ws.on('error', (error) => {
    const errorDetails = getErrorMessage(
      'connectOpenAiSipRealtimeWebSocket',
      error
    )
    logger.error(
      { ...errorDetails, callId, contactId },
      '[AmazonConnectPhone] OpenAI SIP WebSocket error'
    )
  })

  ws.on('open', () => {
    logger.info(
      { callId, contactId },
      '[AmazonConnectPhone] Connected to OpenAI Realtime WebSocket (SIP call)'
    )
    sendSessionUpdateSpeed(ws)
    sendResponseCreateEvent(ws)
  })

  ws.on('message', async (data: Buffer | string) => {
    scheduleConversationTimeout(key, callId, contactId)

    const raw =
      typeof data === 'string' ? data : Buffer.from(data).toString('utf8')
    let message: unknown
    try {
      message = JSON.parse(raw)
    } catch {
      message = raw
    }
    logger.info(
      { callId, contactId, data: message },
      '[AmazonConnectPhone] OpenAI SIP WebSocket message'
    )

    noteTransferResponseDone(callId, message)
    await handleMessageIfToolCall(callId, message, ws)
  })

  ws.on('close', () => {
    logger.info(
      { callId, contactId },
      '[AmazonConnectPhone] OpenAI SIP WebSocket closed'
    )
    closeOpenAiSipWebSocketForCall(callId)
    deleteCall(callId)
  })

  return ws
}
