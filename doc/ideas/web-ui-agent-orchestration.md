# Web UI agent orchestration

**Status:** exploring  
**Fits:** composition layer (`src/index.ts` / `VoiceAgentDefinition`), not the
SIP call lifecycle.

## Why

Today the active agent is TypeScript: `hotelBookingAgent` is imported in
`src/index.ts`. That is the right default for an open-source kit, but some
teams will want to change prompts, tools, and MCP URLs in a browser instead of
shipping a code change.

The foundation already has a seam: `VoiceAgentDefinition` (`getInstructions` +
optional tools). A UI would produce that object (or JSON equivalent) at boot or
per call.

## Candidates to look at (OSS)

These are starting points, not a shortlist:

| Project | Sketch | Relevance |
|---------|--------|-----------|
| [Dify](https://github.com/langgenius/dify) | Full LLMOps: visual workflows, agents, APIs, RAG | Strong product UI; heavier to embed in a phone control plane |
| [Flowise](https://github.com/FlowiseAI/Flowise) | Node/React Flow canvas on LangChain.js | Same language as this repo; easy self-host |
| [Langflow](https://github.com/langflow-ai/langflow) | Python visual LangChain/LangGraph builder | Good if the orchestrator lives outside Node |
| [n8n](https://github.com/n8n-io/n8n) | General workflow automation | Broad integrations; less voice-agent native |

Also consider a **thin custom editor** (prompt + MCP URL + tool allowlist) if
the OSS canvases cannot emit something we can map to Realtime accept payload.

## What “done” would look like here

- SIP webhook / accept / hangup stay in this repo.
- Instructions, extra tools, and MCP server URL come from a stored definition
  (DB, YAML, or orchestrator API), not a hardcoded example module.
- Transfer and disconnect remain core tools.
- Phone-only: the UI is for operators, not callers.

## Open questions

- Can any of these export a schema we can map to OpenAI Realtime `instructions`
  + `tools` (function and/or remote MCP)?
- Per-call vs process-wide definition? Connect metadata might choose a flow.
- How do we version and review prompt changes (git vs UI-only)?
- Latency and failure mode if the orchestrator is down at accept time.

## Next probes

1. Spin up Flowise and Dify locally; see whether a flow can be called as an API
   with a prompt + tool list.
2. Sketch a mapper from that API to `VoiceAgentDefinition`.
3. If mapping is ugly, design a 1-page operator UI that only edits prompt and
   MCP URL.
