import { WebSocket } from 'ws'
import { RealtimeSession } from '@openai/agents-realtime'
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions'
import { MCPServerStreamableHttp, withTrace } from '@openai/agents'
import { mcpServerList } from '@/foundation/mcp-server'
import { frontDeskAgentForPhone } from '@/service/twilio-phone/agents/realtime-phone/front-desk-agent'
import logger from '@/misc/logger'

const greetingRecord = new Map<string, boolean>()

const isGreetingSent = (callId: string) => greetingRecord.get(callId) || false

const setGreetingSent = (callId: string) => {
  greetingRecord.set(callId, true)
}

// TODO: mock customer's phone number
// Case 1: Has date search, use +14000000000
// Case 2: No date search, use '+15000000000'
// Case 3: No phone session, use '+16000000000'
const mockCustomerPhoneNumber = '+15000000000'

export const handleTwilioPhoneMediaStreamConnection = async (
  ws: WebSocket
): Promise<void> => {
  withTrace('twilioPhoneMediaStream', async () => {
    let callId = ''

    logger.info('[TwilioPhone] WebSocket connection established')

    // Wrap ws.send to log outgoing messages (for debugging protocol issues)
    // This helps identify what messages are being sent to Twilio
    const originalSend = ws.send.bind(ws)
    ws.send = ((data: any, ...args: any[]) => {
      try {
        if (typeof data === 'string') {
          // Log JSON messages to see what's being sent
          try {
            JSON.parse(data)
          } catch {
            logger.debug(
              { callId, message: data.substring(0, 200) },
              '[TwilioPhone] Outgoing text message to Twilio'
            )
          }
        } else if (Buffer.isBuffer(data)) {
          logger.debug(
            { callId, dataLength: data.length },
            '[TwilioPhone] Outgoing binary data to Twilio'
          )
        }
      } catch {
        // Ignore logging errors
      }
      return originalSend(data, ...args)
    }) as typeof ws.send

    const openAiApiKey = process.env.OPENAI_API_KEY
    if (!openAiApiKey) {
      logger.error({ callId }, '[TwilioPhone] OpenAI API key missing')
      ws.close()
      return
    }

    // IMPORTANT: Following "Speed is the name of the game" from OpenAI docs:
    // 1. Create transport layer IMMEDIATELY
    // 2. Create session IMMEDIATELY (without waiting for MCP servers)
    // 3. Connect IMMEDIATELY (user can start talking right away)
    // 4. Connect MCP servers in background and update agent asynchronously

    const twilioTransportLayer = new TwilioRealtimeTransportLayer({
      twilioWebSocket: ws,
    })

    // Helper function to send greeting if conditions are met
    const sendGreetingIfReady = () => {
      if (callId && !isGreetingSent(callId)) {
        try {
          twilioTransportLayer.sendMessage(
            {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'hi',
                },
              ],
            },
            {}
          )
          logger.info({ callId }, '[TwilioPhone] Greeting sent')
          setGreetingSent(callId)
        } catch {
          logger.info(
            { callId },
            '[TwilioPhone] will retry on next twilio_message to send greeting'
          )
        }
      }
    }

    twilioTransportLayer.on('*', (event) => {
      if (event.type === 'twilio_message') {
        if (!callId) {
          console.log('[TwilioPhone] update callId')
          callId = event?.message?.start?.callSid || ''
        }
      }
    })

    logger.info(
      { callId },
      '[TwilioPhone] TwilioRealtimeTransportLayer created immediately'
    )

    // Create agent without MCP servers initially (we'll update it later)
    const agent = frontDeskAgentForPhone([], mockCustomerPhoneNumber)

    // Create session immediately (user can start talking right away)
    const session = new RealtimeSession(agent, {
      transport: twilioTransportLayer,
      model: process.env.OPENAI_MODEL || 'gpt-realtime-1.5',
      config: {
        audio: {
          input: {
            turnDetection: {
              type: 'server_vad',
              create_response: true,
              interrupt_response: true,
              silence_duration_ms: 300,
            },
          },
          output: {
            voice: 'marin',
          },
        },
      },
    })

    // Set up event listeners
    session.on('mcp_tools_changed', (tools: { name: string }[]) => {
      const toolNames = tools.map((tool) => tool.name).join(', ')
      logger.info(
        { callId, toolNames },
        `[TwilioPhone] Available MCP tools: ${toolNames || 'None'}`
      )
    })

    session.on(
      'mcp_tool_call_completed',
      (_context: unknown, _agent: unknown, toolCall: unknown) => {
        logger.info(
          { callId, toolCall },
          '[TwilioPhone] MCP tool call completed'
        )
      }
    )

    session.on('error', (error) => {
      logger.error({ error, callId }, '[TwilioPhone] Session error occurred')
    })

    session.on('connection_change', (status) => {
      logger.info({ status, callId }, '[TwilioPhone] Connection status changed')
    })

    // Listen to transport events to access raw Twilio messages (Tip #2 from docs)
    session.on('transport_event', (event) => {
      if (event.type === 'twilio_message') {
        logger.debug(
          { callId, message: (event as any).message },
          '[TwilioPhone] Raw Twilio message received'
        )
      }
    })

    // Connect IMMEDIATELY (this is critical!)
    // After session is connected, connect MCP servers and update agent
    // Declare mcpServers in outer scope so it's accessible in ws.on('close')
    //
    // NOTE: This is a working version where:
    // - Greeting voice message works correctly
    // - Customer can hear the voice
    // - MCP servers connect after session is established
    // - WebSocket is guaranteed to be open before agent update
    const mcpServers: MCPServerStreamableHttp[] = []

    session
      .connect({
        apiKey: openAiApiKey,
      })
      .then(() => {
        logger.info(
          { callId },
          '[TwilioPhone] Connected to OpenAI Realtime API immediately'
        )

        // Now that session is connected, connect MCP servers and update agent
        Promise.all(
          mcpServerList.map(async (mcpServerConfig) => {
            try {
              const mcpServer = new MCPServerStreamableHttp({
                url: mcpServerConfig.url,
                name: mcpServerConfig.name,
              })
              await mcpServer.connect()
              mcpServers.push(mcpServer)
              logger.info(
                {
                  callId,
                  mcpServerName: mcpServerConfig.name,
                },
                '[TwilioPhone] MCP server connected successfully (background)'
              )
            } catch (mcpError) {
              logger.warn(
                {
                  mcpError,
                  callId,
                  mcpServerName: mcpServerConfig.name,
                },
                '[TwilioPhone] Failed to connect to MCP server (non-critical)'
              )
            }
          })
        )
          .then(async () => {
            // Update agent with MCP servers after they're connected
            // Session is already connected, so WebSocket is open
            // Tracing context is already available from top-level withTrace
            if (mcpServers.length > 0) {
              const updatedAgent = frontDeskAgentForPhone(
                mcpServers,
                mockCustomerPhoneNumber
              )
              try {
                await session.updateAgent(updatedAgent)
                logger.info(
                  {
                    callId,
                    mcpServerCount: mcpServers.length,
                  },
                  '[TwilioPhone] Agent updated with MCP servers successfully'
                )

                // Immediately send greeting after agent is updated (optimization: no need to wait for twilio_message)
                sendGreetingIfReady()
              } catch (error) {
                logger.error(
                  { error, callId },
                  '[TwilioPhone] Failed to update agent with MCP servers'
                )
              }
            } else {
              logger.info(
                { callId },
                '[TwilioPhone] No MCP servers connected, agent remains unchanged'
              )

              // Even without MCP servers, send greeting immediately
              sendGreetingIfReady()
            }
          })
          .catch((error) => {
            logger.error(
              { error, callId },
              '[TwilioPhone] Error during MCP server connection process'
            )
          })
      })
      .catch((error) => {
        logger.error(
          { error, callId },
          '[TwilioPhone] Failed to connect to OpenAI, closing connection'
        )
        ws.close()
      })

    ws.on('close', async () => {
      logger.info({ callId }, '[TwilioPhone] WebSocket connection closed')

      try {
        session.close()
        greetingRecord.delete(callId)
        callId = ''
        logger.info({ callId }, '[TwilioPhone] RealtimeSession closed')
      } catch (error) {
        logger.error(
          { error, callId },
          '[TwilioPhone] Error closing RealtimeSession'
        )
      }

      // Close MCP servers
      for (const mcpServer of mcpServers) {
        try {
          await mcpServer.close()
          logger.info(
            {
              callId,
              mcpServerName: mcpServer.name,
            },
            '[TwilioPhone] MCP server closed successfully'
          )
        } catch (error) {
          logger.error(
            { error, callId, mcpServerName: mcpServer.name },
            '[TwilioPhone] Error closing MCP server'
          )
        }
      }
    })

    ws.on('error', (error) => {
      logger.error({ error, callId }, '[TwilioPhone] WebSocket error occurred')
      greetingRecord.delete(callId)
      callId = ''
    })
  }).catch((tracingError) => {
    // Log tracing errors separately (non-fatal)
    logger.warn(
      { tracingError },
      '[TwilioPhone] Tracing error during WebSocket connection (non-fatal)'
    )
  })
}
