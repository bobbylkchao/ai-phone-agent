import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Express } from 'express'
import logger from '@/misc/logger'

/**
 * Everything about one MCP server: how this process hosts it, and how a
 * Realtime session refers to it. Keeping both here means a path or tool rename
 * cannot silently drift away from the allowlist sent to OpenAI.
 */
export interface HttpMcpServerDefinition {
  name: string
  path: `/${string}`
  /** Label OpenAI Realtime uses for this server. Letters, digits, `_` and `-`. */
  serverLabel: string
  /** Tools `registerTools` adds, and therefore the Realtime allowlist. */
  toolNames: string[]
  registerTools: (server: McpServer) => void
}

export const initMcpServers = (
  app: Express,
  definitions: HttpMcpServerDefinition[]
): void => {
  for (const definition of definitions) {
    try {
      app.post(definition.path, async (req, res) => {
        try {
          const server = new McpServer({
            name: definition.name,
            version: '1.0.0',
          })
          definition.registerTools(server)
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          })
          res.on('close', () => {
            void transport.close()
          })
          await server.connect(transport)
          await transport.handleRequest(req, res, req.body)
        } catch (error) {
          logger.error(
            { error, mcpServer: definition.name },
            '[MCP Server] Request failed'
          )
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' })
          }
        }
      })
    } catch (error) {
      logger.error(
        { error, mcpServer: definition.name },
        '[MCP Server] Initialization failed'
      )
    }
  }
}
