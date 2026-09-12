# AI Phone Agent for Amazon Connect

A production-oriented Node.js and TypeScript backend for real-time AI phone calls through **Amazon Connect**, **OpenAI SIP**, and the **OpenAI Realtime API**.

Callers enter through Amazon Connect and are routed to OpenAI over SIP. OpenAI sends this service a `realtime.call.incoming` webhook; the service accepts the call, opens a Realtime WebSocket for session events and function calls, and can update Amazon Connect contact attributes before transferring or disconnecting.

## Architecture

```text
Caller
  → Amazon Connect contact flow
  → OpenAI SIP / Realtime
  → POST /amazon-connect-phone/incoming-call
  → accept call + Realtime WebSocket
  → voice instructions and tools
  → transfer to an agent or disconnect
```

The audio plane stays between Amazon Connect and OpenAI. This backend is the control plane: it owns webhook handling, call state, prompts, tool execution, handoff timing, and optional Amazon Connect SDK calls.

## Design principles

- **Phone-first**: no browser microphone or web voice client.
- **Channel-focused**: Amazon Connect is the only telephony integration.
- **Explicit call lifecycle**: webhook → accept → WebSocket → tools → hangup.
- **Per-call isolation**: call metadata, intake state, timers, and WebSockets are keyed per call/contact.
- **Safe handoff**: transfer and disconnect wait for the final spoken response before ending the OpenAI call leg.
- **Replaceable product logic**: the included trip-intake and MCP examples demonstrate integration patterns, not production business rules.
- **Minimal sensitive data**: do not log secrets or unnecessary PII.

## Main features

- OpenAI `realtime.call.incoming` webhook handling
- Realtime session configuration and server-side function tools
- Structured trip-intake state
- Transfer-to-human and disconnect tools
- Optional Amazon Connect `UpdateContactAttributes`
- Optional MCP example servers
- `/health` liveness probe, plus `/status` and `/status.json` operational endpoints

## Repository layout

- `src/service/amazon-connect-phone/` — channel bootstrap and OpenAI SIP call lifecycle
- `src/service/amazon-connect-phone/openai-sip-webhook/agents/` — voice prompts
- `src/service/amazon-connect-phone/openai-sip-webhook/tools/` — Realtime function tools
- `src/service/amazon-connect-phone/openai-sip-webhook/websocket/` — per-call WebSocket and hangup scheduling
- `src/foundation/amazon-connect/` — optional AWS SDK helpers
- `src/foundation/open-ai/` — OpenAI HTTP helper
- `src/foundation/mcp-server/` — illustrative MCP servers
- `src/misc/` — logging and status routes

TypeScript imports use `@/*` → `src/*`; `tsc-alias` rewrites them in `dist/`.

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
```

Configure OpenAI to send incoming Realtime SIP call webhooks to:

```text
https://<your-host>/amazon-connect-phone/incoming-call
```

For contact-attribute updates, also configure `AMAZON_CONNECT_SDK_ENABLE`, `AMAZON_CONNECT_INSTANCE_ID`, `AWS_REGION`, and AWS credentials through your deployment secret manager.

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

## Coding agents

- `AGENTS.md` is the shared project guidance for coding agents.
- `CLAUDE.md` imports `AGENTS.md` using Claude Code's supported `@` syntax.
- `.cursor/rules/` and `.claude/rules/` contain tool-specific, path-scoped rules.
- `.claude/skills/verify-phone-agent/` provides one Agent Skills-compatible
  verification workflow that both Claude Code and Cursor can discover.
- `.claude/settings.json` contains shared Claude Code safety permissions; use the
  gitignored `.claude/settings.local.json` for personal overrides.

## Documentation

- [Architecture](./doc/ai-phone-agent-architecture.md)
- [Amazon Connect + OpenAI SIP webhook](./doc/amazon-connect-openai-webhook.md)
- [Local Amazon Connect testing](./doc/local-testing-amazon-connect-sip.md)
- [GitHub CI](./doc/github-ci.md)

## License

MIT
