# AI Phone Agent for Amazon Connect

A ready-to-run Node.js and TypeScript kit for real AI phone calls on **Amazon
Connect**, **OpenAI SIP**, and the **OpenAI Realtime API**. Clone it, point your
Connect SIP trunk at it, and go straight to writing business logic — you don't
have to build the telephony plumbing from scratch.

**Already wired for you:** the `realtime.call.incoming` webhook, call accept
with instructions and tools, the Realtime WebSocket sideband, function-tool
dispatch and validation, transfer-to-human and hangup timing that doesn't cut
off speech, optional Amazon Connect contact attributes, MCP hosting, and health
and status endpoints.

**What you write:** a `VoiceAgentDefinition` — your prompt plus any tools your
scenario needs. Inject it in `src/index.ts` and the whole call lifecycle stays
untouched. A small hotel-booking example ships with the repo so it runs as-is;
replace or delete it.

## Architecture

```text
Application composition
  ├─ voice-agent definition (instructions + optional tools)
  ├─ Amazon Connect / OpenAI SIP foundation
  └─ optional MCP servers

Caller → Amazon Connect → OpenAI SIP / Realtime
  → incoming-call webhook → accept → Realtime WebSocket
  → injected instructions and tools → transfer or disconnect
```

Amazon Connect and OpenAI carry the audio. This backend is the control plane; it
does not proxy audio.

## Included example

`src/example/hotel-booking/` contains a deliberately small hotel-booking
example:

- a phone prompt that greets the caller, tells them they can ask for a person at
  any time, and asks which city they plan to visit;
- a `search-hotel` MCP tool the agent calls during the phone conversation;
- the generic transfer-to-human fallback, used only when the caller asks for it;
- a mock hotel inventory served at `POST /hotel-booking-mcp`.

Set `HOTEL_BOOKING_MCP_SERVER_URL` to the public HTTPS endpoint. The active
`VoiceAgentDefinition` attaches it to the Realtime session as a Remote MCP
server, restricted to `search-hotel`, so OpenAI performs the mock search before
the assistant names hotels or rates. Replace that URL with a compatible
production provider such as Expedia without changing the Connect/SIP core.

## Generic foundation

- OpenAI `realtime.call.incoming` webhook handling
- Realtime call acceptance and sideband WebSocket control
- injectable instructions and application tools
- generic `transfer_to_human_agent` and `disconnect_the_call` tools
- delayed hangup so final speech is not cut off
- optional Amazon Connect `UpdateContactAttributes`
- reusable Streamable HTTP MCP host
- `/health`, `/status`, and `/status.json`

## Repository layout

- `src/service/amazon-connect-phone/` — generic Connect/SIP call lifecycle
- `src/foundation/amazon-connect/` — optional AWS SDK helpers
- `src/foundation/open-ai/` — OpenAI REST helper
- `src/foundation/mcp-server/` — generic Streamable HTTP MCP host
- `src/example/hotel-booking/` — replaceable example prompt and MCP stub
- `src/misc/` — logging and operational status routes
- `src/**/test/` — colocated Jest tests

The application composition root is `src/index.ts`. To use another business
scenario, create a new `VoiceAgentDefinition` and inject it there instead of
`hotelBookingAgent`.

## Quick start

```sh
npm install
cp .env.example .env
npm run dev
```

Set at least:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-realtime-2.1
AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH=/amazon-connect-phone
HOTEL_BOOKING_MCP_SERVER_URL=https://<your-host>/hotel-booking-mcp
```

Configure OpenAI to send incoming Realtime SIP call webhooks to:

```text
https://<your-host>/amazon-connect-phone/incoming-call
```

For optional contact-attribute updates, configure
`AMAZON_CONNECT_SDK_ENABLE`, `AMAZON_CONNECT_INSTANCE_ID`, `AWS_REGION`, and
AWS credentials through your deployment secret manager.

## Local end-to-end testing with ngrok

Amazon Connect and OpenAI carry the audio between themselves, so a laptop only
has to expose one HTTP webhook over public HTTPS. With a tunnel in front of the
dev server you can dial a real phone number and talk to the agent running on
your machine:

```text
Your phone → Amazon Connect → OpenAI SIP / Realtime
  → ngrok → localhost:4000
```

Start the server and the tunnel:

```sh
npm run dev
ngrok http 4000
```

Point the OpenAI `realtime.call.incoming` webhook at the tunnel URL:

```text
https://<subdomain>.ngrok-free.app/amazon-connect-phone/incoming-call
```

Use the same tunnel for the mock MCP server:

```env
HOTEL_BOOKING_MCP_SERVER_URL=https://<subdomain>.ngrok-free.app/hotel-booking-mcp
```

Open `http://localhost:4000/status` to confirm the Amazon Connect phone channel
is ready, then place a test call and watch the logs for the incoming event, the
accept, and the Realtime WebSocket connection.

No public WebSocket endpoint is needed — this service dials out to OpenAI after
accepting the call. Cloudflare Tunnel works the same way. On the free ngrok
plan the URL changes on every restart, so update the OpenAI webhook each time.

Full checklist: [Local Amazon Connect testing](./doc/local-testing-amazon-connect-sip.md).

## Commands

```sh
npm run dev
npm run build
npm run start
npm run lint
npm run lint:ci
npm run format
npm test
npm run test:coverage
```

## Documentation

- [Architecture](./doc/ai-phone-agent-architecture.md)
- [Amazon Connect + OpenAI SIP webhook](./doc/amazon-connect-openai-webhook.md)
- [Local Amazon Connect testing](./doc/local-testing-amazon-connect-sip.md)
- [GitHub CI](./doc/github-ci.md)

## License

MIT
