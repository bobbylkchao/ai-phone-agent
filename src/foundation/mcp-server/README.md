# MCP HTTP host

`initMcpServers` mounts one or more `HttpMcpServerDefinition` objects on the
Express application using MCP Streamable HTTP transport.

This foundation module contains no business tools. The runnable hotel-search
stub lives in `src/example/hotel-booking/mcp-server/`.

The example endpoint is intentionally independent from the phone session.
OpenAI Realtime can call a deployed MCP endpoint directly when configured with
a Remote MCP tool and a publicly reachable HTTPS `server_url`.
