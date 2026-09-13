import type WebSocket from 'ws'
import { z } from 'zod'
import type { VoiceAgentMcpServer } from '../../types'
import { queueDisconnectToolArguments } from '../../websocket/disconnect-hangup-scheduler'
import { queueTransferToolArguments } from '../../websocket/transfer-hangup-scheduler'
import {
  executeTool,
  getRealtimeToolsConfig,
  handleMessageIfToolCall,
  type VoiceAgentTool,
} from '../index'

jest.mock('../../websocket/transfer-hangup-scheduler', () => ({
  queueTransferToolArguments: jest.fn(),
}))
jest.mock('../../websocket/disconnect-hangup-scheduler', () => ({
  queueDisconnectToolArguments: jest.fn(),
}))

const executeExampleTool = jest.fn()
const exampleTool: VoiceAgentTool = {
  name: 'example_tool',
  description: 'An injected example tool.',
  parameters: z.object({ value: z.string().optional() }),
  parametersJsonSchema: {
    type: 'object',
    properties: { value: { type: 'string' } },
    additionalProperties: false,
  },
  execute: executeExampleTool,
}

const exampleMcpServer: VoiceAgentMcpServer = {
  serverLabel: 'example',
  serverUrl: 'https://phone.example/mcp',
  allowedTools: ['search'],
  requireApproval: 'never',
}

describe('Realtime tool registry', () => {
  const callId = 'call-1'

  it('publishes core tools and injected agent tools', () => {
    expect(getRealtimeToolsConfig([exampleTool])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'transfer_to_human_agent' }),
        expect.objectContaining({ name: 'disconnect_the_call' }),
        expect.objectContaining({
          type: 'function',
          name: 'example_tool',
        }),
      ])
    )
    expect(getRealtimeToolsConfig()).toHaveLength(2)
  })

  it('publishes configured Remote MCP servers', () => {
    expect(getRealtimeToolsConfig([], [exampleMcpServer])).toEqual(
      expect.arrayContaining([
        {
          type: 'mcp',
          server_label: 'example',
          server_url: 'https://phone.example/mcp',
          allowed_tools: ['search'],
          require_approval: 'never',
        },
      ])
    )
  })

  it('parses string and object arguments for an injected tool', async () => {
    await executeTool(
      callId,
      'example_tool',
      JSON.stringify({ value: 'first' }),
      [exampleTool]
    )
    await executeTool(callId, 'example_tool', { value: 'second' }, [
      exampleTool,
    ])
    await executeTool(callId, 'unknown', {})

    expect(executeExampleTool).toHaveBeenNthCalledWith(1, callId, {
      value: 'first',
    })
    expect(executeExampleTool).toHaveBeenNthCalledWith(2, callId, {
      value: 'second',
    })
    await expect(
      executeTool(callId, 'example_tool', { value: 123 }, [exampleTool])
    ).rejects.toThrow()
  })

  it('runs an injected tool and lets the model continue speaking', async () => {
    const send = jest.fn()
    const ws = { send } as unknown as WebSocket
    executeExampleTool.mockResolvedValueOnce({ ok: true })

    await expect(
      handleMessageIfToolCall(
        callId,
        {
          type: 'conversation.item.done',
          item: {
            type: 'function_call',
            name: 'example_tool',
            arguments: '{"value":"hello"}',
            call_id: 'function-1',
          },
        },
        ws,
        [exampleTool]
      )
    ).resolves.toBe(true)

    expect(executeExampleTool).toHaveBeenCalledWith(callId, { value: 'hello' })
    expect(send).toHaveBeenCalledTimes(2)
    expect(JSON.parse(send.mock.calls[0][0] as string)).toMatchObject({
      item: {
        call_id: 'function-1',
        output: '{"ok":true}',
      },
    })
  })

  it('skips function output when the call id is missing', async () => {
    const send = jest.fn()
    const ws = { send } as unknown as WebSocket

    await handleMessageIfToolCall(
      callId,
      {
        type: 'conversation.item.done',
        item: {
          type: 'function_call',
          name: 'example_tool',
          arguments: '{}',
        },
      },
      ws,
      [exampleTool]
    )

    expect(send).not.toHaveBeenCalled()
  })

  it('queues transfer and disconnect until spoken audio finishes', async () => {
    const ws = {} as WebSocket

    await handleMessageIfToolCall(
      callId,
      {
        type: 'conversation.item.done',
        item: {
          type: 'function_call',
          name: 'transfer_to_human_agent',
          arguments: { summary: 'Human requested' },
        },
      },
      ws
    )
    await handleMessageIfToolCall(
      callId,
      {
        type: 'conversation.item.done',
        item: { type: 'function_call', name: 'disconnect_the_call' },
      },
      ws
    )
    await handleMessageIfToolCall(
      callId,
      {
        type: 'conversation.item.done',
        item: {
          type: 'function_call',
          name: 'transfer_to_human_agent',
          arguments: '{"summary":"string args"}',
        },
      },
      ws
    )

    expect(queueTransferToolArguments).toHaveBeenCalledWith(
      callId,
      '{"summary":"Human requested"}'
    )
    expect(queueTransferToolArguments).toHaveBeenCalledWith(
      callId,
      '{"summary":"string args"}'
    )
    expect(queueDisconnectToolArguments).toHaveBeenCalledWith(callId, '{}')
  })

  it('ignores messages that are not registered function calls', async () => {
    const ignoredMessages = [
      { type: 'response.done' },
      { type: 'conversation.item.done', item: { type: 'message' } },
      { type: 'conversation.item.done', item: { type: 'function_call' } },
      {
        type: 'conversation.item.done',
        item: { type: 'function_call', name: 'unknown_tool' },
      },
    ]

    for (const message of ignoredMessages) {
      await expect(
        handleMessageIfToolCall(callId, message, {} as WebSocket)
      ).resolves.toBe(false)
    }
  })
})
