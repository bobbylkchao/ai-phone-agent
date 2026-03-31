import logger from '@/misc/logger'

/**
 * When the model calls `disconnect_the_call`, we may receive `conversation.item.done`
 * (function_call) before the callee has finished hearing assistant audio—same race as transfer.
 * Wait until `response.done` for that turn, then add a tail delay so PSTN/SIP audio can finish.
 *
 * Also avoids hanging up instantly when the same response includes a spoken goodbye plus the tool.
 */

type DisconnectState = {
  argumentsJson?: string
  /** True after we see `response.done` whose output includes disconnect. */
  disconnectResponseDone: boolean
  timer?: NodeJS.Timeout
}

const stateByCallId = new Map<string, DisconnectState>()

const getTailMs = (): number => {
  const n = parseInt(process.env.SIP_DISCONNECT_AUDIO_TAIL_MS ?? '3500', 10)
  return Number.isFinite(n) && n >= 0 ? n : 3500
}

const tryScheduleHangup = (callId: string): void => {
  const s = stateByCallId.get(callId)
  if (!s?.argumentsJson || !s.disconnectResponseDone || s.timer) return

  const tailMs = getTailMs()
  logger.info(
    { callId, tailMs },
    '[AmazonConnectPhone] Scheduling disconnect hangup after response audio tail'
  )

  s.timer = setTimeout(() => {
    stateByCallId.delete(callId)
    const args = s.argumentsJson
    if (!args) return
    void import('../tools/disconnect-the-call')
      .then(({ runDisconnectTheCallHangup }) =>
        runDisconnectTheCallHangup(callId, args)
      )
      .catch((err: unknown) => {
        logger.error(
          { callId, err },
          '[AmazonConnectPhone] runDisconnectTheCallHangup failed'
        )
      })
  }, tailMs)
}

/** Call when a server message is `response.done` and output includes `disconnect_the_call`. */
export const noteDisconnectResponseDone = (
  callId: string,
  message: unknown
): void => {
  const m = message as {
    type?: string
    response?: {
      output?: Array<{ type?: string; name?: string }>
    }
  }
  if (m.type !== 'response.done' || !m.response?.output?.length) return

  const hasDisconnect = m.response.output.some(
    (item) =>
      item?.type === 'function_call' && item?.name === 'disconnect_the_call'
  )
  if (!hasDisconnect) return

  const s: DisconnectState = stateByCallId.get(callId) ?? {
    disconnectResponseDone: false,
  }
  s.disconnectResponseDone = true
  stateByCallId.set(callId, s)
  tryScheduleHangup(callId)
}

/**
 * Call when `conversation.item.done` is received for the disconnect tool (before executing hangup).
 */
export const queueDisconnectToolArguments = (
  callId: string,
  argumentsJson: string
): void => {
  const s: DisconnectState = stateByCallId.get(callId) ?? {
    disconnectResponseDone: false,
  }
  s.argumentsJson = argumentsJson
  stateByCallId.set(callId, s)
  tryScheduleHangup(callId)
}

export const clearDisconnectHangupSchedule = (callId: string): void => {
  const s = stateByCallId.get(callId)
  if (s?.timer) clearTimeout(s.timer)
  stateByCallId.delete(callId)
}
