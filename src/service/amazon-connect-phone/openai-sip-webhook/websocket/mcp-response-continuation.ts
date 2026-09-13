import type WebSocket from 'ws'
import logger from '@/misc/logger'
import { sendResponseCreateEvent } from '../client-side-events'

/**
 * Remote MCP tools execute inside OpenAI, so the response that issues the call
 * can finish while the tool is still running, leaving the caller in silence with
 * no turn in flight. A function call does not have this problem: we send its
 * output and then `response.create` ourselves.
 *
 * So we wait for the tool result to land in the conversation, and only then ask
 * for the response that speaks it. Asking any earlier gets "it's still running";
 * asking while another response is generating would be rejected outright.
 */

/** Keeps a failing MCP tool from ping-ponging responses for the whole call. */
const MAX_CONSECUTIVE_CONTINUATIONS = 3

interface ContinuationState {
  /** Set once an MCP result is in the conversation and unspoken. */
  pendingToolName?: string
  /** True while a response is generating; a second one would be rejected. */
  responseActive: boolean
  continuations: number
}

const stateByCallId = new Map<string, ContinuationState>()

const getState = (callId: string): ContinuationState => {
  const existing = stateByCallId.get(callId)
  if (existing) return existing
  const created: ContinuationState = { responseActive: false, continuations: 0 }
  stateByCallId.set(callId, created)
  return created
}

export const clearMcpResponseContinuation = (callId: string): void => {
  stateByCallId.delete(callId)
}

const askModelToSpeakResult = (
  callId: string,
  ws: WebSocket,
  state: ContinuationState
): void => {
  const toolName = state.pendingToolName
  if (!toolName || state.responseActive) return

  state.pendingToolName = undefined

  if (state.continuations >= MAX_CONSECUTIVE_CONTINUATIONS) {
    logger.warn(
      { callId, toolName, attempts: state.continuations },
      '[AmazonConnectPhone] MCP results kept going unspoken; stopped asking for a response'
    )
    return
  }

  state.continuations += 1
  logger.info(
    { callId, toolName },
    '[AmazonConnectPhone] Requesting a response so the model speaks the MCP result'
  )
  sendResponseCreateEvent(ws)
}

/** Call for every server message; tracks response state and MCP tool results. */
export const continueResponseAfterMcpCall = (
  callId: string,
  message: unknown,
  ws: WebSocket
): void => {
  const m = message as {
    type?: string
    item?: { type?: string; name?: string }
    response?: { output?: Array<{ type?: string }> }
  }

  switch (m?.type) {
    case 'response.created':
      getState(callId).responseActive = true
      return

    case 'response.done': {
      const state = getState(callId)
      state.responseActive = false

      const output = m.response?.output ?? []
      const spoke = output.some((item) => item?.type === 'message')
      const calledMcp = output.some((item) => item?.type === 'mcp_call')
      // A turn that only spoke means the caller got an answer.
      if (spoke && !calledMcp) {
        state.continuations = 0
      }

      // Covers a result that landed while this response was still generating.
      askModelToSpeakResult(callId, ws, state)
      return
    }

    case 'conversation.item.done': {
      if (m.item?.type !== 'mcp_call') return
      const state = getState(callId)
      state.pendingToolName = m.item?.name ?? 'unknown'
      askModelToSpeakResult(callId, ws, state)
      return
    }

    default:
      return
  }
}
