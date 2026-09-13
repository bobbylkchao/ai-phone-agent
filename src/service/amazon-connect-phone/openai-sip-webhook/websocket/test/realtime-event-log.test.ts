import logger from '@/misc/logger'
import { logRealtimeEvent } from '../realtime-event-log'

jest.mock('@/misc/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}))

describe('Realtime event logging', () => {
  const info = jest.mocked(logger.info)
  const error = jest.mocked(logger.error)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('summarizes what a finished response contained', () => {
    logRealtimeEvent('call-1', 'contact-1', {
      type: 'response.done',
      response: {
        status: 'completed',
        output: [
          { type: 'message', status: 'completed' },
          { type: 'mcp_call', name: 'search-hotel' },
        ],
      },
    })

    expect(info).toHaveBeenCalledWith(
      {
        callId: 'call-1',
        contactId: 'contact-1',
        status: 'completed',
        statusDetails: undefined,
        output: [
          { type: 'message', status: 'completed' },
          { type: 'mcp_call', name: 'search-hotel' },
        ],
      },
      '[AmazonConnectPhone] Realtime response done'
    )
  })

  it('raises Realtime error events', () => {
    logRealtimeEvent('call-1', 'contact-1', {
      type: 'error',
      error: { message: 'invalid_request' },
    })

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'invalid_request' } }),
      '[AmazonConnectPhone] Realtime error event'
    )
  })

  it('reports MCP and conversation item events', () => {
    logRealtimeEvent('call-1', 'contact-1', {
      type: 'response.mcp_call.failed',
    })
    logRealtimeEvent('call-1', 'contact-1', { type: 'mcp_list_tools.failed' })
    logRealtimeEvent('call-1', 'contact-1', {
      type: 'conversation.item.done',
      item: { type: 'function_call', name: 'disconnect_the_call' },
    })

    expect(info).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ event: 'response.mcp_call.failed' }),
      '[AmazonConnectPhone] Realtime MCP event'
    )
    expect(info).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ event: 'mcp_list_tools.failed' }),
      '[AmazonConnectPhone] Realtime MCP event'
    )
    expect(info).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        itemType: 'function_call',
        itemName: 'disconnect_the_call',
      }),
      '[AmazonConnectPhone] Realtime conversation item done'
    )
  })

  it('stays quiet for high-frequency and untyped events', () => {
    logRealtimeEvent('call-1', 'contact-1', { type: 'response.created' })
    logRealtimeEvent('call-1', 'contact-1', {
      type: 'response.mcp_call_arguments.delta',
    })
    logRealtimeEvent('call-1', 'contact-1', 'not-json')

    expect(info).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})
