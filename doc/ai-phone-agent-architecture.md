# AI Phone Agent Architecture

## Overview

This service provides real-time AI phone conversations through Amazon Connect and OpenAI Realtime SIP. It is intentionally phone-only and keeps the telephony integration separate from reusable infrastructure and example business tools.

## Call path

```text
Caller
  │
  ▼
Amazon Connect contact flow
  │ SIP
  ▼
OpenAI Realtime SIP
  │ realtime.call.incoming webhook
  ▼
Express POST /amazon-connect-phone/incoming-call
  │
  ├─ POST /v1/realtime/calls/{call_id}/accept
  └─ WSS /v1/realtime?call_id={call_id}
       │
       ├─ session events
       ├─ function calls
       └─ response completion events
```

Amazon Connect and OpenAI carry the audio. This Node.js service controls the call but does not proxy its audio.

## Layers

### Channel

`src/service/amazon-connect-phone/` initializes the OpenAI SIP webhook and the optional Amazon Connect SDK client.

`openai-sip-webhook/` owns:

- webhook validation and SIP metadata parsing
- call acceptance and hangup requests
- per-call state
- the OpenAI Realtime WebSocket
- voice instructions
- function-tool schemas and execution
- delayed transfer/disconnect scheduling

### Foundation

- `foundation/open-ai/` sends authenticated OpenAI REST requests.
- `foundation/amazon-connect/` initializes the AWS SDK and updates contact attributes.
- `foundation/mcp-server/` hosts illustrative booking and post-booking MCP tools.

### Operations

- `misc/logger.ts` provides structured Pino logs.
- `misc/status-routes.ts` exposes `/status` and `/status.json`.
- `src/index.ts` initializes Express, the Amazon Connect channel, and MCP servers.

## Call lifecycle

1. OpenAI sends `realtime.call.incoming`.
2. The webhook extracts the call ID and decodes supported Amazon Connect SIP headers.
3. The service stores per-call metadata and accepts the call with instructions and tool definitions.
4. A WebSocket is opened to the accepted Realtime call.
5. The service sends session configuration and the initial response request.
6. Realtime function calls are validated with Zod and dispatched to registered tools.
7. Transfer or disconnect waits for `response.done` plus an audio-tail delay before updating Connect attributes and hanging up.
8. WebSocket close clears call state and timers.

## State and concurrency

Maps keyed by `callId` or `contactId` isolate concurrent calls:

- call metadata and contact ID
- trip-intake state
- active OpenAI WebSocket
- conversation timeout
- transfer and disconnect schedules

This is process-local state. Horizontal scaling therefore requires sticky routing or moving call state and coordination into a shared store.

## Voice-agent behavior

The Connect-specific prompt lives in `openai-sip-webhook/agents/`. It treats Amazon Connect metadata as routing context, collects information explicitly from the caller, and does not invent itinerary details.

Realtime tools use two matching contracts:

- a Zod schema for runtime validation
- `parametersJsonSchema` sent to OpenAI

New tools must be exported and registered in `openai-sip-webhook/tools/index.ts`.

## Human handoff

When enabled, the Amazon Connect SDK writes contact attributes before the OpenAI call leg ends:

- handoff flag
- concise conversation summary
- structured intake payload

Transfer and disconnect are scheduled after the model's final response completes so TTS playback is not cut off.

## MCP examples

The MCP servers demonstrate modular tool backends. Booking and post-booking behavior is illustrative and should be replaced with product-specific authorization, persistence, compliance, and error handling.

## Error handling

- Missing required configuration prevents the affected channel from registering or accepting calls.
- OpenAI REST and WebSocket failures are logged with call context.
- Tool inputs are validated before execution.
- WebSocket shutdown clears timers and call state.
- Secrets must never be logged; production logging should minimize caller metadata and transcript content.

## Scaling considerations

Before horizontal production deployment, add:

- shared call state and distributed timer coordination
- webhook authentication/signature verification
- rate limiting and request-size limits
- metrics for accept latency, call duration, tool failures, and handoff outcome
- log redaction and retention controls
- graceful shutdown for active calls

## Runtime

- Node.js 20.19 or newer
- TypeScript
- Express
- `ws`
- OpenAI Realtime REST/WebSocket protocol
- AWS SDK for Amazon Connect
- Zod
- Pino
