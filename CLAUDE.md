# Agent instructions (developers)

**`AGENTS.md` and `CLAUDE.md` are intentionally the same.** Edit both when you change this document so Cursor and Claude Code stay aligned.

## What this repo is

- **Node.js + TypeScript** backend for **real phone calls** → **OpenAI Realtime** (voice).
- Two integrations: **Twilio** (`src/service/twilio-phone/`) and **Amazon Connect + OpenAI SIP** (`src/service/amazon-connect-phone/openai-sip-webhook/`).
- **Phone-only** — no browser voice UI in this kit.

## Layout

| Area | Role |
|------|------|
| `src/foundation/` | Shared OpenAI helpers, Twilio WebSocket, MCP servers, Amazon Connect SDK helpers. |
| `src/service/twilio-phone/` | Twilio HTTP + wiring into foundation. |
| `src/service/amazon-connect-phone/` | Connect: incoming webhook, accept/hangup, Realtime WS, tools, SIP instructions. |
| `doc/` | Architecture and integration guides — **read before large changes.** |

Imports use **`@/*` → `src/*`**; build uses **`tsc-alias`** for `dist/`.

## Conventions

- **Small, focused diffs** — match existing style; don’t refactor unrelated code.
- **Lint / format** — ESLint uses **Airbnb** (`eslint-config-airbnb-base` + `@kesills/eslint-config-airbnb-typescript`) with **Prettier** (`eslint-config-prettier`). Run `npm run lint` and `npm run format` before you finish.
- **Tools** — New Realtime tools: Zod schema + matching `parametersJsonSchema`, register in `openai-sip-webhook/tools/index.ts` (same pattern as existing tools).
- **Voice prompts** — Connect SIP: `openai-sip-webhook/agents/` (e.g. `sip-instructions.ts`, `entry-agent.ts`). Twilio: `foundation/open-ai/agents/realtime-phone/`.

## Security

- **Never commit secrets** — `.env` is gitignored; use `.env.example` for keys **names** only.
- **Don’t log** API keys, tokens, or full PII; sanitize error messages aimed at end users.

## Commands

```sh
npm install
npm run dev      # nodemon
npm run build && npm run start
npm run lint
npm run format
```

## Docs index

- [README.md](./README.md) — overview and quick start
- [doc/ai-phone-agent-architecture.md](./doc/ai-phone-agent-architecture.md)
- [doc/twilio-integration.md](./doc/twilio-integration.md)
- [doc/amazon-connect-openai-webhook.md](./doc/amazon-connect-openai-webhook.md)
- [doc/local-testing-twilio-and-amazon-connect-sip.md](./doc/local-testing-twilio-and-amazon-connect-sip.md)

## Demo vs product

Booking/post-booking MCP and trip-intake examples are **illustrative** — replace with your own product logic and compliance rules.
