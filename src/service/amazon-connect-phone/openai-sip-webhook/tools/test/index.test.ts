import type WebSocket from 'ws'
import { deleteCall, getTripIntake } from '../../call-store'
import { queueDisconnectToolArguments } from '../../websocket/disconnect-hangup-scheduler'
import { queueTransferToolArguments } from '../../websocket/transfer-hangup-scheduler'
import {
  executeTool,
  getRealtimeToolsConfig,
  handleMessageIfToolCall,
} from '../index'

jest.mock('../../websocket/transfer-hangup-scheduler', () => ({
  queueTransferToolArguments: jest.fn(),
}))
jest.mock('../../websocket/disconnect-hangup-scheduler', () => ({
  queueDisconnectToolArguments: jest.fn(),
}))

describe('Realtime tool registry', () => {
  const callId = 'call-1'

  afterEach(() => {
    deleteCall(callId)
  })

  it('publishes the three OpenAI function definitions', () => {
    expect(getRealtimeToolsConfig()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function',
          name: 'update_trip_intake',
        }),
        expect.objectContaining({
          type: 'function',
          name: 'transfer_to_human_agent',
        }),
        expect.objectContaining({
          type: 'function',
          name: 'disconnect_the_call',
        }),
      ])
    )
  })

  it('parses string and object arguments and ignores unknown tools', async () => {
    await executeTool(
      callId,
      'update_trip_intake',
      JSON.stringify({ customerName: 'Ada' })
    )
    await executeTool(callId, 'update_trip_intake', '')
    await executeTool(callId, 'update_trip_intake', {
      tripRequirementsNotes: 'object args',
    })
    await executeTool(callId, 'unknown', {})

    expect(getTripIntake(callId)).toEqual({
      customerName: 'Ada',
      tripRequirementsNotes: 'object args',
    })
    await expect(
      executeTool(callId, 'update_trip_intake', { customerName: 123 })
    ).rejects.toThrow()
  })

  it('runs the intake tool and lets the model continue speaking', async () => {
    const send = jest.fn()
    const ws = { send } as unknown as WebSocket

    await expect(
      handleMessageIfToolCall(
        callId,
        {
          type: 'conversation.item.done',
          item: {
            type: 'function_call',
            name: 'update_trip_intake',
            arguments: '{"tripRequirementsNotes":"Paris"}',
            call_id: 'function-1',
          },
        },
        ws
      )
    ).resolves.toBe(true)

    expect(getTripIntake(callId)).toEqual({ tripRequirementsNotes: 'Paris' })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('skips the function output when the call id is missing', async () => {
    const send = jest.fn()
    const ws = { send } as unknown as WebSocket

    await handleMessageIfToolCall(
      callId,
      {
        type: 'conversation.item.done',
        item: {
          type: 'function_call',
          name: 'update_trip_intake',
          arguments: '{}',
        },
      },
      ws
    )

    expect(send).not.toHaveBeenCalled()
  })

  it('queues the handoff tools instead of executing them immediately', async () => {
    const ws = {} as WebSocket

    await expect(
      handleMessageIfToolCall(
        callId,
        {
          type: 'conversation.item.done',
          item: {
            type: 'function_call',
            name: 'transfer_to_human_agent',
            arguments: { summary: 'ready' },
          },
        },
        ws
      )
    ).resolves.toBe(true)
    await expect(
      handleMessageIfToolCall(
        callId,
        {
          type: 'conversation.item.done',
          item: { type: 'function_call', name: 'disconnect_the_call' },
        },
        ws
      )
    ).resolves.toBe(true)
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
      '{"summary":"ready"}'
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
