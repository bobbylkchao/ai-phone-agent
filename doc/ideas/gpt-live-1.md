# GPT-Live-1

**Status:** exploring  
**Fits:** transport/session layer. Today this kit uses OpenAI **Realtime SIP**
(`gpt-realtime-2.1` by default), not Live sessions.

## Why

[GPT-Live-1](https://developers.openai.com/api/docs/models/gpt-live-1) is
OpenAI’s full-duplex voice model: listen and speak at the same time, handle
interruptions, and optionally **delegate** reasoning/tools to a backend model.

OpenAI’s published comparison (their evals) claims large gains vs
GPT-Realtime-2.1 on full-duplex / turn-taking. For a phone agent that is the
interesting question: fewer cut-offs, more natural barge-in, while tools still
run on a cheaper/smarter backend.

Public pointers:

- Product: [GPT-Live-1 in the API](https://openai.com/index/introducing-gpt-live-1-in-the-api/)
- Model card: [`gpt-live-1`](https://developers.openai.com/api/docs/models/gpt-live-1)
- Pricing (voice layer): **$0.05 / minute**, billed per second; backend model
  and tools billed separately
- Sessions: `POST /v1/live/sessions` (WebRTC / SDP in the public WebRTC guide)

## Tension with this repo

This project is **Amazon Connect + OpenAI SIP Realtime**:

1. Connect bridges audio to OpenAI SIP.
2. We accept `realtime.call.incoming`.
3. We open a Realtime WebSocket sideband for tools and hangup.

GPT-Live-1, as documented for developers, is a **Live session** (WebRTC-oriented)
with a separate delegation model. It is not a drop-in `OPENAI_MODEL=` swap.

Unknown until we read current SIP docs end-to-end:

- Does Live support SIP inbound the way Realtime does?
- Can we keep Connect as the audio plane, or would Live force WebRTC / a
  different trunk?
- How do transfer/disconnect hangup timing and function tools map to Live
  delegation?

If SIP is not supported, Live might only apply to a future non-Connect demo
(browser or another telephony bridge). That would be a second path, not a
replacement of the foundation.

## Next probes

1. Read the current Live + SIP docs (or confirm SIP is Realtime-only).
2. Price a typical 4-minute hotel call: Live voice + backend vs Realtime-2.1.
3. If SIP works: spike accept/session config with `gpt-live-1` in a throwaway
   branch; keep hangup/transfer behavior.
4. If SIP does not work: document Live as out of scope for Connect and stop
   there unless we add a WebRTC playground (this kit is phone-first).
