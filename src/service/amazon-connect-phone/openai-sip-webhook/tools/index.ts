import type WebSocket from 'ws'
import type { VoiceAgentTool } from '../types'
import {
  sendFunctionCallOutput,
  sendResponseCreateEvent,
} from '../client-side-events'
import { queueDisconnectToolArguments } from '../websocket/disconnect-hangup-scheduler'
import { queueTransferToolArguments } from '../websocket/transfer-hangup-scheduler'
import { disconnectTheCallTool } from './disconnect-the-call'
import { transferToHumanAgentTool } from './transfer-to-human-agent'

export type { VoiceAgentTool } from '../types'

const coreVoiceAgentTools: VoiceAgentTool[] = [
  transferToHumanAgentTool,
  disconnectTheCallTool,
]

const getVoiceAgentTools = (
  agentTools: VoiceAgentTool[] = []
): VoiceAgentTool[] => [...coreVoiceAgentTools, ...agentTools]

/** Realtime function tools for POST .../realtime/calls/{call_id}/accept */
export const getRealtimeToolsConfig = (
  agentTools: VoiceAgentTool[] = []
): Array<{
  type: 'function'
  name: string
  description: string
  parameters: unknown
}> =>
  getVoiceAgentTools(agentTools).map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parametersJsonSchema,
  }))

export const executeTool = async (
  callId: string,
  toolName: string,
  rawArgs: string | Record<string, unknown>,
  agentTools: VoiceAgentTool[] = []
): Promise<unknown> => {
  const tool = getVoiceAgentTools(agentTools).find((t) => t.name === toolName)
  if (!tool) return
  const args =
    typeof rawArgs === 'string'
      ? (JSON.parse(rawArgs || '{}') as Record<string, unknown>)
      : rawArgs
  const parsed = tool.parameters.parse(args ?? {})
  return tool.execute(callId, parsed)
}

/**
 * Handles conversation.item.done with function_call for registered tools.
 */
export const handleMessageIfToolCall = async (
  callId: string,
  message: unknown,
  ws: WebSocket,
  agentTools: VoiceAgentTool[] = []
): Promise<boolean> => {
  const toolNames = new Set(getVoiceAgentTools(agentTools).map((t) => t.name))
  const m = message as {
    type?: string
    item?: {
      type?: string
      name?: string
      arguments?: string
      call_id?: string
    }
  }
  if (
    m?.type !== 'conversation.item.done' ||
    m?.item?.type !== 'function_call' ||
    !m?.item?.name ||
    !toolNames.has(m.item.name)
  ) {
    return false
  }
  const toolName = m.item.name
  const functionCallId = m.item.call_id ?? ''

  if (toolName === transferToHumanAgentTool.name) {
    const raw = m.item.arguments
    const argsJson = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {})
    queueTransferToolArguments(callId, argsJson)
    return true
  }

  if (toolName === disconnectTheCallTool.name) {
    const raw = m.item.arguments
    const argsJson = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {})
    queueDisconnectToolArguments(callId, argsJson)
    return true
  }

  const result = await executeTool(
    callId,
    toolName,
    m.item.arguments ?? '{}',
    agentTools
  )
  if (functionCallId) {
    sendFunctionCallOutput(ws, functionCallId, JSON.stringify(result ?? {}))
    sendResponseCreateEvent(ws)
  }
  return true
}
