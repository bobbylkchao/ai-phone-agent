import type WebSocket from 'ws'
import { z } from 'zod'
import {
  sendFunctionCallOutput,
  sendResponseCreateEvent,
} from '../client-side-events'
import { queueTransferToolArguments } from '../websocket/transfer-hangup-scheduler'
import { disconnectTheCallTool } from './disconnect-the-call'
import { transferToHumanAgentTool } from './transfer-to-human-agent'
import { updateTripIntakeTool } from './update-trip-intake'

export interface VoiceAgentTool {
  name: string
  description: string
  parameters: z.ZodType<unknown>
  /** OpenAI Realtime \`function\` tool \`parameters\` JSON Schema */
  parametersJsonSchema: unknown
  execute: (callId: string, args: unknown) => Promise<void>
}

const voiceAgentTools: VoiceAgentTool[] = [
  updateTripIntakeTool,
  transferToHumanAgentTool,
  disconnectTheCallTool,
]

/** Realtime function tools for POST .../realtime/calls/{call_id}/accept */
export const getRealtimeToolsConfig = (): Array<{
  type: 'function'
  name: string
  description: string
  parameters: unknown
}> => voiceAgentTools.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parametersJsonSchema,
  }))

export const executeTool = async (
  callId: string,
  toolName: string,
  rawArgs: string | Record<string, unknown>
): Promise<void> => {
  const tool = voiceAgentTools.find((t) => t.name === toolName)
  if (!tool) return
  const args =
    typeof rawArgs === 'string'
      ? (JSON.parse(rawArgs || '{}') as Record<string, unknown>)
      : rawArgs
  const parsed = tool.parameters.parse(args ?? {})
  await tool.execute(callId, parsed)
}

const toolNames = new Set(voiceAgentTools.map((t) => t.name))

const handoffToolNames = new Set([disconnectTheCallTool.name])

/**
 * Handles conversation.item.done with function_call for registered tools.
 */
export const handleMessageIfToolCall = async (
  callId: string,
  message: unknown,
  ws: WebSocket
): Promise<boolean> => {
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

  await executeTool(callId, toolName, m.item.arguments ?? '{}')
  if (!handoffToolNames.has(toolName) && functionCallId) {
    sendFunctionCallOutput(ws, functionCallId, '{}')
    sendResponseCreateEvent(ws)
  }
  return true
}
