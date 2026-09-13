import type WebSocket from 'ws'
import {
  clearMcpResponseContinuation,
  continueResponseAfterMcpCall,
} from '../mcp-response-continuation'

const RESPONSE_CREATE = JSON.stringify({ type: 'response.create' })

const mcpResultLanded = {
  type: 'conversation.item.done',
  item: { type: 'mcp_call', name: 'search-hotel' },
}

const responseDone = (types: string[]) => ({
  type: 'response.done',
  response: { output: types.map((type) => ({ type })) },
})

describe('MCP response continuation', () => {
  let ws: WebSocket
  let send: jest.Mock

  beforeEach(() => {
    send = jest.fn()
    ws = { send } as unknown as WebSocket
  })

  afterEach(() => {
    clearMcpResponseContinuation('call-1')
  })

  it('asks for a response once the MCP result lands, not when the response ends', () => {
    // the observed order: the response finishes while the tool is still running
    continueResponseAfterMcpCall(
      'call-1',
      responseDone(['message', 'mcp_call']),
      ws
    )
    expect(send).not.toHaveBeenCalled()

    continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)
    expect(send).toHaveBeenCalledWith(RESPONSE_CREATE)
  })

  it('waits for the active response to finish before asking', () => {
    continueResponseAfterMcpCall('call-1', { type: 'response.created' }, ws)
    continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)
    expect(send).not.toHaveBeenCalled()

    continueResponseAfterMcpCall('call-1', responseDone(['mcp_call']), ws)
    expect(send).toHaveBeenCalledWith(RESPONSE_CREATE)
  })

  it('ignores turns that carry no MCP result', () => {
    continueResponseAfterMcpCall('call-1', responseDone(['message']), ws)
    continueResponseAfterMcpCall(
      'call-1',
      { type: 'conversation.item.done', item: { type: 'function_call' } },
      ws
    )
    continueResponseAfterMcpCall('call-1', { type: 'response.created' }, ws)
    continueResponseAfterMcpCall('call-1', 'not-json', ws)

    expect(send).not.toHaveBeenCalled()
  })

  it('gives up after repeated unspoken results, and resets once speech lands', () => {
    for (let i = 0; i < 5; i += 1) {
      continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)
    }
    expect(send).toHaveBeenCalledTimes(3)

    // a plain speech turn means the caller was answered
    continueResponseAfterMcpCall('call-1', responseDone(['message']), ws)
    continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)

    expect(send).toHaveBeenCalledTimes(4)
  })

  it('forgets a call once it ends', () => {
    continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)
    continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)
    continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)
    clearMcpResponseContinuation('call-1')
    continueResponseAfterMcpCall('call-1', mcpResultLanded, ws)

    expect(send).toHaveBeenCalledTimes(4)
  })

  it('names the tool it is waiting on, even when the item has no name', () => {
    continueResponseAfterMcpCall(
      'call-1',
      { type: 'conversation.item.done', item: { type: 'mcp_call' } },
      ws
    )

    expect(send).toHaveBeenCalledWith(RESPONSE_CREATE)
  })
})
