# Agent instructions (developers)

This is the shared source of project guidance for coding agents. Claude Code
loads it through the import in `CLAUDE.md`.

## What this repo is

- **Node.js + TypeScript** backend for **real phone calls** → **OpenAI Realtime** (voice).
- One telephony integration: **Amazon Connect + OpenAI SIP** (`src/service/amazon-connect-phone/openai-sip-webhook/`).
- **Phone-only** — no browser voice UI in this kit.

## Layout

| Area | Role |
|------|------|
| `src/foundation/` | Generic OpenAI, MCP hosting, and Amazon Connect SDK helpers. |
| `src/service/amazon-connect-phone/` | Generic Connect webhook, call lifecycle, Realtime WS, and core tools. |
| `src/example/hotel-booking/` | Replaceable example instructions and hotel-search MCP stub. |
| `doc/` | Architecture and integration guides — **read before large changes.** |
| `src/**/test/` | Jest suites, one file per source file (`src/misc/test/logger.test.ts` covers `src/misc/logger.ts`). |

Imports use **`@/*` → `src/*`**; build uses **`tsc-alias`** for `dist/`.
`tsconfig.build.json` keeps `src/**/test/**` out of `dist/`.

## Conventions

- **Small, focused diffs** — match existing style; don’t refactor unrelated code.
- **Lint / format** — ESLint uses the official recommended JavaScript config plus type-checked `typescript-eslint`, with Prettier disabling conflicting formatting rules. Run `npm run lint` and `npm run format` before you finish.
- **TypeScript** — prefer arrow functions for new named helpers and callbacks unless hoisting or a dynamic `this` is required.
- **Tests** — every executable source file has a matching test in the sibling `test/` directory; add or update it in the same change.
- **Boundary** — Keep business prompts and tools under `src/example/` (or a product module); inject them through `VoiceAgentDefinition`. Do not add product semantics to the Connect/SIP core.
- **Tools** — New Realtime function tools use a Zod schema plus matching `parametersJsonSchema`, then are supplied through the active `VoiceAgentDefinition`.
- **Phone prompts** — Example prompts belong under their example module. `openai-sip-webhook/agents/entry-agent.ts` only appends generic Connect metadata.

## Security

- **Never commit secrets** — `.env` is gitignored; use `.env.example` for keys **names** only.
- **Don’t log** API keys, tokens, or full PII; sanitize error messages aimed at end users.

## Commands

```sh
npm install
npm run dev      # nodemon
npm run start    # clean build, then run dist/index.js
npm run build
npm run lint
npm run lint:ci
npm run format
npm test
npm run test:coverage
```

## Docs index

- [README.md](./README.md) — overview and quick start
- [doc/ai-phone-agent-architecture.md](./doc/ai-phone-agent-architecture.md)
- [doc/amazon-connect-openai-webhook.md](./doc/amazon-connect-openai-webhook.md)
- [doc/local-testing-amazon-connect-sip.md](./doc/local-testing-amazon-connect-sip.md)
- [doc/ideas/](./doc/ideas/) — exploration notes (not product spec)

## Demo vs product

The hotel-booking prompt and hotel-search MCP stub are **illustrative**. The MCP
stub is connected to the phone session through Realtime Remote MCP when
`HOTEL_BOOKING_MCP_SERVER_URL` is set. Replace the active agent definition, MCP
provider, authorization, persistence, and compliance rules in a real product.
