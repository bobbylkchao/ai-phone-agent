# Agent instructions (developers)

This is the shared source of project guidance for coding agents. Cursor reads
it directly; Claude Code loads it through the import in `CLAUDE.md`.

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

## Toolchain

- **Node.js** `>=22.13.0` (`engines.node`); `.nvmrc` pins the recommended LTS major used by CI.
- **TypeScript** stays on `~6.0` until `typescript-eslint` supports 7. Don't reintroduce `baseUrl`, `ignoreDeprecations`, or other options TypeScript 7 removes.
- **Jest** transpiles with SWC and does not type-check; `npm run build` is the type check.
- **Dependencies** — keep `npm audit --audit-level=high` clean. `overrides` in `package.json` pin patched transitive dev tooling; drop each one once upstream resolves a fixed version.

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
npm run test:ci
```

Before finishing a change, run the `verify-phone-agent` skill
(`.claude/skills/verify-phone-agent/`); it mirrors CI.

## Docs index

- [README.md](./README.md) — overview and quick start
- [doc/ai-phone-agent-architecture.md](./doc/ai-phone-agent-architecture.md)
- [doc/amazon-connect-openai-webhook.md](./doc/amazon-connect-openai-webhook.md)
- [doc/local-testing-amazon-connect-sip.md](./doc/local-testing-amazon-connect-sip.md)
- [doc/github-ci.md](./doc/github-ci.md) — CI, Dependabot, and deploy workflow
- [doc/ideas/](./doc/ideas/) — exploration notes (not product spec)

## Demo vs product

The hotel-booking prompt and hotel-search MCP stub are **illustrative**. The MCP
stub is connected to the phone session through Realtime Remote MCP when
`HOTEL_BOOKING_MCP_SERVER_URL` is set. Replace the active agent definition, MCP
provider, authorization, persistence, and compliance rules in a real product.
