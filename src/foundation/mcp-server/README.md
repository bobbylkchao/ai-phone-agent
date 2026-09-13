# MCP HTTP host

`initMcpServers` mounts one or more `HttpMcpServerDefinition` objects on the
Express application using MCP Streamable HTTP transport.

A definition is the single source of truth for one MCP server: `path` and
`registerTools` say how this process hosts it, while `serverLabel` and
`toolNames` say how a Realtime session refers to it. An agent definition reads
those fields instead of restating them, so renaming a tool cannot leave a stale
allowlist behind.

This foundation module contains no business tools. The runnable hotel-search
stub lives in `src/example/hotel-booking/mcp-server/`.

The hotel example attaches this endpoint to the phone session as an OpenAI
Realtime Remote MCP tool. Set `HOTEL_BOOKING_MCP_SERVER_URL` to its publicly
reachable HTTPS URL; localhost is not reachable from OpenAI.
