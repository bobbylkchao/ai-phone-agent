import logger from '@/misc/logger'

/**
 * Turn-level visibility into the Realtime session. Every message is already
 * logged in full at `debug`; these lines keep the shape of each turn visible at
 * `info`, which is what tells you whether the model spoke, called a tool, or
 * ended the turn owing the caller an answer.
 */

interface RealtimeOutputItem {
  type?: string
  name?: string
  status?: string
}

interface RealtimeMessage {
  type?: string
  response?: {
    status?: string
    status_details?: unknown
    output?: RealtimeOutputItem[]
  }
  item?: { type?: string; name?: string }
  error?: unknown
}

const summarizeOutput = (
  output: RealtimeOutputItem[] = []
): Array<Record<string, string | undefined>> =>
  output.map((item) => ({
    type: item?.type,
    ...(item?.name ? { name: item.name } : undefined),
    ...(item?.status ? { status: item.status } : undefined),
  }))

export const logRealtimeEvent = (
  callId: string,
  contactId: string,
  message: unknown
): void => {
  const m = message as RealtimeMessage
  const type = m?.type
  if (!type) return

  // Deltas stream token by token; the matching `.done` carries the whole value.
  if (type.endsWith('.delta')) return

  const base = { callId, contactId }

  if (type === 'error') {
    logger.error(
      { ...base, error: m.error },
      '[AmazonConnectPhone] Realtime error event'
    )
    return
  }

  if (type === 'response.done') {
    logger.info(
      {
        ...base,
        status: m.response?.status,
        statusDetails: m.response?.status_details,
        output: summarizeOutput(m.response?.output),
      },
      '[AmazonConnectPhone] Realtime response done'
    )
    return
  }

  if (
    type.startsWith('response.mcp_call') ||
    type.startsWith('mcp_list_tools')
  ) {
    logger.info(
      { ...base, event: type },
      '[AmazonConnectPhone] Realtime MCP event'
    )
    return
  }

  if (type === 'conversation.item.done') {
    // `name` would be swallowed by pino as the logger's own name.
    logger.info(
      { ...base, itemType: m.item?.type, itemName: m.item?.name },
      '[AmazonConnectPhone] Realtime conversation item done'
    )
  }
}
