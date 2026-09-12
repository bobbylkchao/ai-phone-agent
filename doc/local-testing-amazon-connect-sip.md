# Local testing: Amazon Connect + OpenAI SIP

The call audio flows directly between Amazon Connect and OpenAI. Local testing only needs to expose this service's HTTP webhook over public HTTPS.

## Prerequisites

- Node.js 20.19 or newer
- an OpenAI API key with Realtime SIP access
- Amazon Connect configured to route calls to the OpenAI SIP endpoint
- an HTTPS tunnel such as ngrok or Cloudflare Tunnel

## Configure the service

Copy `.env.example` to `.env` and set:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-realtime-2.1
AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH=/amazon-connect-phone
```

Optional Amazon Connect contact-attribute updates:

```env
AMAZON_CONNECT_SDK_ENABLE=true
AMAZON_CONNECT_INSTANCE_ID=
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Use short-lived credentials or your deployment secret manager outside local development.

## Run and expose the server

```sh
npm install
npm run dev
```

Expose port `4000`, for example:

```sh
ngrok http 4000
```

If the tunnel URL is `https://example.ngrok-free.app`, configure the OpenAI incoming-call webhook as:

```text
https://example.ngrok-free.app/amazon-connect-phone/incoming-call
```

No public WebSocket endpoint is required. This service opens an outbound WebSocket to OpenAI after accepting the call.

## Verify

1. Open `http://localhost:4000/status` and confirm the Amazon Connect phone channel is ready.
2. Place a test call through the Amazon Connect contact flow.
3. Confirm the tunnel receives `POST /amazon-connect-phone/incoming-call`.
4. Confirm logs show the incoming event, successful accept, and Realtime WebSocket connection.
5. Exercise transfer and disconnect, then verify the expected contact attributes if the SDK integration is enabled.

Use AWS and OpenAI documentation as the source of truth for current SIP trunk, authentication, and console configuration.
