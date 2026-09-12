import type WebSocket from 'ws'
import {
  sendFunctionCallOutput,
  sendResponseCreateEvent,
  sendSessionUpdateSpeed,
} from '../index'

describe('Realtime client events', () => {
  it('serializes session, response, and function output events', () => {
    const send = jest.fn()
    const ws = { send } as unknown as WebSocket

    sendSessionUpdateSpeed(ws)
    sendResponseCreateEvent(ws)
    sendFunctionCallOutput(ws, 'function-1', '{"saved":true}')

    const events = send.mock.calls.map(
      ([value]) => JSON.parse(value as string) as unknown
    )
    expect(events[0]).toMatchObject({
      type: 'session.update',
      session: {
        audio: {
          input: {
            noise_reduction: { type: 'far_field' },
            turn_detection: { type: 'server_vad' },
          },
          output: { voice: 'marin', speed: 1.1 },
        },
      },
    })
    expect(events[1]).toEqual({ type: 'response.create' })
    expect(events[2]).toEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'function-1',
        output: '{"saved":true}',
      },
    })
  })
})
