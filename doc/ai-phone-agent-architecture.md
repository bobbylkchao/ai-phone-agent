# AI Phone Agent Architecture

## Purpose

This repository is a generic control-plane foundation for AI phone calls over
Amazon Connect and OpenAI Realtime SIP. Telephony lifecycle code does not own a
brand, conversation domain, intake schema, or product integration.

A runnable hotel-booking example demonstrates where application behavior
belongs without making that behavior part of the foundation.

## Composition

```text
src/index.ts
  ├─ selects hotelBookingAgent (replaceable example)
  ├─ initializes Amazon Connect / OpenAI SIP channel
  ├─ mounts optional MCP server definitions
  └─ registers operational status routes
```

`VoiceAgentDefinition` is the boundary between reusable call infrastructure and
application behavior:

- `getInstructions(metaData)` returns the active phone prompt.
- `tools` optionally adds application-owned Realtime function tools.

The SIP core always adds the generic `transfer_to_human_agent` and
`disconnect_the_call` tools.

## Call path

```text
Caller
  → Amazon Connect contact flow
  → OpenAI Realtime SIP
  → POST /amazon-connect-phone/incoming-call
  → accept call with injected instructions and tools
  → WSS /v1/realtime?call_id={call_id}
  → function calls and response completion events
  → transfer to Connect or disconnect
```

Amazon Connect and OpenAI carry the audio. This service receives the webhook,
configures the session, handles server-side tools, and controls the call leg.

## Layers

### Generic phone foundation

`src/service/amazon-connect-phone/openai-sip-webhook/` owns:

- incoming webhook validation and supported UUI metadata parsing;
- Realtime call acceptance and hangup requests;
- per-call contact ID state;
- the Realtime sideband WebSocket;
- core transfer/disconnect tools;
- delayed hangup after final spoken audio;
- injection of the active `VoiceAgentDefinition`.

The supported example UUI shape is intentionally limited to generic Connect
call metadata: `contactId`, `initialContactId`, `initiationMethod`,
`customerPhoneNumber`, and `systemPhoneNumber`.

### Generic foundations

- `src/foundation/open-ai/` sends authenticated OpenAI REST requests.
- `src/foundation/amazon-connect/` initializes the optional AWS SDK client and
  updates contact attributes.
- `src/foundation/mcp-server/` hosts supplied MCP definitions over Streamable
  HTTP without knowing their business tools.

### Replaceable example

`src/example/hotel-booking/` contains:

- a minimal prompt that asks which city the caller plans to visit;
- a `search-hotel` MCP stub returning placeholder data;
- no production brand, provider, persistence, checkout, or cancellation logic.

The MCP endpoint is independently runnable but is not attached to the phone
session. A production application can deploy an MCP server publicly and add it
to Realtime as a Remote MCP tool, or inject a function tool that calls a private
backend.

## Tool lifecycle

Application tools and core tools use the same `VoiceAgentTool` contract:

- Zod validates runtime arguments;
- `parametersJsonSchema` is sent in the Realtime accept payload;
- `execute` runs server-side application logic.

Normal tools return a `function_call_output` event and request another model
response. Transfer and disconnect are special because the caller should hear
the final sentence before the OpenAI leg ends:

1. The model speaks and emits the tool call.
2. The service stores tool arguments.
3. The corresponding `response.done` event arrives.
4. An environment-configurable audio-tail delay expires.
5. Contact attributes are optionally updated and the OpenAI call is hung up.

Transfer remains a generic fallback so callers can always ask for a human when
the model cannot provide a satisfactory result.

## State and scaling

Process-local maps hold:

- contact ID by call ID;
- active Realtime WebSocket;
- conversation timeout;
- transfer and disconnect schedules.

Horizontal scaling requires sticky routing or shared state and distributed
timer coordination.

## Security boundary

- Do not put secrets or unnecessary PII in logs.
- Treat UUI metadata as routing context, not trusted business input.
- Keep tool authorization and product compliance inside the injected
  application layer.
- Add webhook authenticity verification before production exposure.
- Narrow Remote MCP tools with `allowed_tools` and use approvals for
  side-effecting operations.

## Extension path

To build another voice application:

1. Add a module under `src/example/` or your product namespace.
2. Export a `VoiceAgentDefinition`.
3. Add only the application tools that scenario needs.
4. Inject the definition from `src/index.ts`.
5. Replace or remove the hotel MCP definition.

No changes to webhook parsing, SIP acceptance, WebSocket lifecycle, or hangup
scheduling should be necessary.
