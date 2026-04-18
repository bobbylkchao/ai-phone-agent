# Amazon Connect + OpenAI Realtime SIP Webhook

**Project:** [ai-phone-agent](../README.md).

This server can handle **OpenAI Realtime phone calls** that arrive over **SIP**, including calls routed from **Amazon Connect**, using the same flow as in [OpenAI’s Realtime Calls / SIP integration](https://platform.openai.com/docs/guides/realtime-sip): your server receives a `realtime.call.incoming` webhook, calls **accept** on the call, then opens a **client WebSocket** to `wss://api.openai.com/v1/realtime?call_id=...` for session events and function calling.

Layout aligns with `phone-sales-ai-copilot`’s `phone-sales-ai-voice-agent` service, but in this repo it lives under **`service/amazon-connect-phone/openai-sip-webhook/`** (channel) and shared pieces under **`foundation/`**.

| Area | Path in this repo |
|------|-------------------|
| Channel bootstrap | `src/service/amazon-connect-phone/index.ts` |
| Route registration | `src/service/amazon-connect-phone/openai-sip-webhook/index.ts` |
| Webhook | `src/service/amazon-connect-phone/openai-sip-webhook/webhook/incoming-call.ts` |
| Accept / hangup | `src/service/amazon-connect-phone/openai-sip-webhook/handle-call/` |
| OpenAI WS | `src/service/amazon-connect-phone/openai-sip-webhook/websocket/connect-to-call.ts` |
| Session client events | `src/service/amazon-connect-phone/openai-sip-webhook/client-side-events/` |
| Tools | `src/service/amazon-connect-phone/openai-sip-webhook/tools/` |
| Instructions builder | `src/service/amazon-connect-phone/openai-sip-webhook/agents/entry-agent.ts` |
| Connect SDK (optional) | `src/foundation/amazon-connect/` |
| OpenAI REST helper | `src/foundation/open-ai/send-http-request.ts` |

## High-level flow

![High-level flow: Amazon Connect IVR, SIP connector, OpenAI SIP and Realtime, webhook, AI Phone Agent accept and connect, transfer back to IVR](./assets/high-level-design-amazon-connect.png)

At a glance: **Amazon Connect IVR** → **SIP connector** → **OpenAI SIP** (bridged with **OpenAI Realtime**). The **`realtime.call.incoming`** webhook hits this server; the agent **accepts** and **connects** to the call over Realtime, and can **transfer / hand off** back to Connect. Step-by-step behavior is implemented under `openai-sip-webhook/` (see the table above).

## Enable the feature

In `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-realtime-1.5
AMAZON_CONNECT_PHONE_ENABLE=true
```

`OPENAI_MODEL` matches the rest of the backend (see `.env.example`); omit it to use the code fallback (`gpt-realtime-1.5`).

Optional:

```env
AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH=/amazon-connect-phone
AMAZON_CONNECT_VOICE_AGENT_DEFAULT_PHONE=+15551234567
```

Restart the server. The webhook URL is:

`https://<your-host><BASE_PATH>/incoming-call`

Default `BASE_PATH` is `/amazon-connect-phone`.

## OpenAI dashboard

1. Configure your **Realtime SIP / phone** integration so OpenAI sends `realtime.call.incoming` to your public URL (HTTPS).
2. Point the webhook to: `https://<your-domain>/amazon-connect-phone/incoming-call` (or your custom base path).

For local development, see [Local testing: Twilio and Amazon Connect + SIP](../../doc/local-testing-twilio-and-amazon-connect-sip.md).

## Amazon Connect headers

The handler parses SIP headers from the webhook payload:

- **`X-Amzn-SourceArn`** — stored as `amazonConnectSourceArn` in session metadata.
- **`User-to-User`** — hex-encoded JSON (`;encoding=hex`), decoded into `UserToUserInfo` and mapped into `AmazonConnectOpenAiVoiceAgentMetaData` (e.g. `contactId`, `customerPhoneNumber`, `queueName`).

Extend `openai-sip-webhook/types.ts` and `webhook/incoming-call.ts` if your contact flow sends additional fields.

## Optional: UpdateContactAttributes on hang up

When the Connect client is initialized, **`transfer_to_human_agent`** and **`disconnect_the_call`** can set Amazon Connect contact attributes before hanging up the OpenAI leg:

```env
AMAZON_CONNECT_SDK_ENABLE=true
AMAZON_CONNECT_INSTANCE_ID=<your-instance-id>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

If `AMAZON_CONNECT_SDK_ENABLE` is not `true` or the client fails to init, the tools still close the OpenAI WebSocket and call the **hangup** API; attribute updates are skipped.

**Attributes (when the SDK path runs):**

- **`transfer_to_human_agent`:** `AIVoiceAgentHandoff` = `"true"`; `AIVoiceAgentConversationSummary` = optional model `summary` for the next agent; `AIVoiceAgentHandoffPayload` = JSON string of trip intake (from `update_trip_intake`).
- **`disconnect_the_call`:** `AIVoiceAgentHandoff` = `"false"`; `AIVoiceAgentConversationSummary` = optional model `summary` for audit (no PII—use “Customer” only; brief chronological narrative: topic, customer needs, who asked to hang up).

## Customizing behavior

- **Instructions**: Edit `openai-sip-webhook/agents/entry-agent.ts` or replace `getPhoneAgentInstructions`. The default is `agents/sip-instructions.ts` only (name-first intake, trip requirements, then handoff)—it does **not** use the Twilio `service/twilio-phone/agents/.../front-desk-agent` prompts, so the model does not assume a web browsing session.

### Why the assistant used to mention hotels or dates “from session”

Nothing in this template’s `accept` body injects hotel names or check-in/out dates from Amazon Connect unless **you** add those fields to `AmazonConnectOpenAiVoiceAgentMetaData`, map them from SIP `User-to-User` in `webhook/incoming-call.ts`, and print them into instructions. Earlier, long Twilio-oriented prompts (`getGeneralInstructions` + booking examples) could also lead the model to **infer** plausible trip details. The current SIP prompt explicitly forbids inventing itinerary details and only uses Connect metadata as routing hints (see `entry-agent.ts` “session context” section).

- **Tools**: `update_trip_intake` (merge name + trip notes), `transfer_to_human_agent` / `disconnect_the_call` (set handoff flag, summary, and intake payload as in [Optional: UpdateContactAttributes](#optional-updatecontactattributes-on-hang-up) when `AMAZON_CONNECT_SDK_ENABLE=true`, then hang up the OpenAI call leg). Add more tools in `openai-sip-webhook/tools/` and register them in `tools/index.ts` with matching Zod + `parametersJsonSchema`.
- **Handoff hangup timing**: If the model speaks and calls `transfer_to_human_agent` or `disconnect_the_call` in the same response, hanging up immediately can cut off playback. The server waits for `response.done` (with that tool in `output`), then delays hangup: `SIP_TRANSFER_AUDIO_TAIL_MS` for transfer, `SIP_DISCONNECT_AUDIO_TAIL_MS` for disconnect (each defaults to 3500 ms). See `websocket/transfer-hangup-scheduler.ts` and `websocket/disconnect-hangup-scheduler.ts`.
- **Idle timeout**: `openai-sip-webhook/websocket/connect-to-call.ts` exports `onConversationTimeout` if you want to prompt or hang up after silence.

## Twilio vs Amazon Connect (in this repo)

| Channel | Entry | Transport to OpenAI |
|--------|--------|---------------------|
| Twilio | `service/twilio-phone` → `/twilio-phone/incoming-call` + `/twilio-phone/media-stream` | `@openai/agents-extensions` Twilio transport |
| Connect + OpenAI SIP | `service/amazon-connect-phone` → OpenAI webhook | REST `accept` + native Realtime WS |

You can run **both** on the same server if you enable Twilio and set `AMAZON_CONNECT_PHONE_ENABLE=true`.
