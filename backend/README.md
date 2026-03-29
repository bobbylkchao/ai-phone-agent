# Realtime Voice AI Agent Backend

A production-ready backend server for realtime voice AI agents using OpenAI's Realtime API. This backend supports **web**, **Twilio Media Streams**, and optionally **Amazon Connect + OpenAI SIP** (webhook + Realtime Calls accept/WebSocket).

**Require: Node >= 16**

## Layout & `@/` imports

- **`src/foundation/`** — Shared building blocks: OpenAI agents/session manager, MCP HTTP servers, WebSocket servers (web + Twilio), Amazon Connect SDK client.
- **`src/service/`** — One folder per **entry / modality**: `web-voice` (browser), `twilio-phone` (PSTN via Twilio), `amazon-connect-phone` (PSTN via Connect + OpenAI SIP; webhook in `amazon-connect-phone/openai-sip-webhook/`).

TypeScript maps `@/*` → `src/*` (same pattern as `phone-sales-ai-copilot`). After `tsc`, **`tsc-alias`** rewrites imports in `dist/` so Node can resolve them.

Main wiring: `src/index.ts` calls `initTwilioPhoneChannel`, `initAmazonConnectPhoneChannel`, `initWebVoiceChannel`, and `initMcpServers` (Twilio and Connect are **phone** channels).

## ✨ Key Features

- **Multi-channel voice support**:
  - 🌐 **Web**: Socket.IO `/realtime-voice`
  - 📞 **Twilio**: TwiML `/incoming-call` + WebSocket `/media-stream`
  - ☁️ **Amazon Connect + OpenAI SIP**: HTTP webhook `.../incoming-call` for `realtime.call.incoming`
- **Realtime Voice Interaction**: Bi-directional audio streaming with OpenAI's Realtime API
- **Multi-Agent System**: Intelligent routing and handoff between specialized agents
- **MCP Server Integration**: Integration with Model Context Protocol (MCP) servers for tool access
- **Multiple Sessions**: Concurrent handling of multiple user sessions with proper isolation
- **Voice Activity Detection**: Server-side VAD for natural conversation flow
- **Phone Session Management**: Automatic phone session data retrieval based on caller ID
- **Status dashboard**: `GET /status` (HTML) and `GET /status.json` list services and URLs

## 🚀 Quick Start

### Install Dependencies & Setup Environment

```sh
cd backend
npm install
cp .env.example .env  # Or create .env manually
```

### Environment Configuration

Create a `.env` file in the `backend` directory with the following configuration:

```env
# OpenAI API Configuration (Required)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-realtime-1.5

# Server Configuration (Optional, defaults to 4000)
PORT=4000

# Twilio Integration (Optional - Enable for phone call support)
# Set TWILIO_PHONE_ENABLE=true to enable Twilio phone call support
TWILIO_PHONE_ENABLE=false
# Full WebSocket URL for Twilio Media Stream (must use wss:// for production)
# Example: wss://ai-voice-agent.ilikeai.ca/media-stream
TWILIO_WEBHOOK_URL=wss://your-domain.com/media-stream

# Amazon Connect + OpenAI SIP
AMAZON_CONNECT_PHONE_ENABLE=false
# AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH=/amazon-connect-openai-voice-agent
# AMAZON_CONNECT_SDK_ENABLE=false
# AMAZON_CONNECT_INSTANCE_ID=
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
```

### Start Backend Application

**Development mode** (with auto-reload):
```sh
npm run dev
```

**Production mode**:
```sh
npm run start
```

The backend will start on `http://localhost:4000` (or the port specified in `PORT` environment variable).

Open **`/status`** in the browser for a dashboard of enabled channels and endpoints (machine-readable: **`/status.json`**).

For **local testing with tunnels** (Twilio + Connect/SIP), see [../doc/local-testing-twilio-and-amazon-connect-sip.md](../doc/local-testing-twilio-and-amazon-connect-sip.md).

## 📞 Twilio Phone Integration

This backend includes **built-in support for phone-based voice AI interactions** via Twilio Media Streams API. This is a major feature that enables your AI agent to handle phone calls in addition to web-based voice interactions.

### Architecture Overview

The system supports two distinct voice interaction channels:

1. **Web Channel** (`/realtime-voice`):
   - Uses Socket.IO for WebSocket connections
   - Handles browser-based voice interactions
   - Frontend connects via `ws://localhost:4000/realtime-voice`

2. **Phone Channel** (`/media-stream`):
   - Uses native WebSocket for Twilio Media Streams
   - Handles phone call voice interactions
   - Twilio connects via `wss://your-domain.com/media-stream`

### Prerequisites

- Twilio account with a phone number
- Server accessible via HTTPS/WSS (for production)
- OpenAI API key with Realtime API access

### Configuration

#### 1. Enable Twilio Integration

In your `.env` file:
```env
TWILIO_PHONE_ENABLE=true
TWILIO_WEBHOOK_URL=wss://your-domain.com/media-stream
```

**Important**: `TWILIO_WEBHOOK_URL` must be the full WebSocket URL with `wss://` protocol for production use.

#### 2. Configure Twilio Phone Number

In Twilio Console:
1. Go to **Phone Numbers** → **Manage** → **Active numbers**
2. Select your phone number
3. In the **"Voice & Fax"** section, set the webhook URL:
   ```
   https://your-domain.com/incoming-call
   ```
4. Set HTTP method to `POST`

### How It Works

1. **User calls** your Twilio phone number
2. **Twilio sends** HTTP POST to `/incoming-call` endpoint
3. **Server responds** with TwiML XML containing `<Stream>` directive pointing to `/media-stream`
4. **Twilio connects** to `/media-stream` WebSocket endpoint
5. **Real-time bidirectional audio streaming** begins between phone and AI agent
6. **AI agent processes** voice input and responds via phone

### Implementation Details

#### HTTP Route Handler (`/incoming-call`)

- **Location**: `src/service/twilio-phone/http-route.ts` (`initTwilioPhoneHttpRoute`)
- **Method**: Handles both GET and POST requests
- **Response**: Returns TwiML XML with `<Stream>` directive
- **Configuration**: Controlled by `TWILIO_PHONE_ENABLE` and `TWILIO_WEBHOOK_URL` environment variables

#### WebSocket Server (`/media-stream`)

- **Location**: `src/foundation/websocket/endpoints/twilio-phone/` (`initTwilioPhoneMediaStreamWebSocketServer`, invoked via `initTwilioPhoneChannel`)
- **Transport Layer**: Uses `TwilioRealtimeTransportLayer` from `@openai/agents-extensions`
- **Agent**: Uses `frontDeskAgentForPhone` - a specialized agent optimized for phone conversations
- **Session Management**: Each phone call gets its own isolated session
- **MCP Integration**: Connects to MCP servers in background after session establishment

#### Phone Session Agent

- **Location**: `src/foundation/open-ai/agents/general-agents/phone-session-agent/`
- **Purpose**: Retrieves customer phone session data based on phone number
- **Tool**: `get_phone_session` - retrieves booking context, destination, dates, etc.

#### Front Desk Agent for Phone

- **Location**: `src/foundation/open-ai/agents/realtime-phone/front-desk-agent/`
- **Purpose**: Specialized agent for phone-based customer service
- **Features**:
  - Phone-optimized conversation flow
  - Immediate response acknowledgments
  - Phone session data integration
  - Tool calling with proper user feedback

### Local Development

For local development, use a tunneling service like ngrok:

```bash
# Start ngrok
ngrok http 4000

# Use the HTTPS URL provided by ngrok
TWILIO_WEBHOOK_URL=wss://abc123.ngrok.io/media-stream
```

Then configure your Twilio webhook to point to `https://abc123.ngrok.io/incoming-call`.

### Production Deployment

For production:
1. Deploy your backend to a server with HTTPS/WSS support
2. Set `TWILIO_WEBHOOK_URL` to your production WebSocket URL (must use `wss://`)
3. Configure Twilio webhook to point to your production `/incoming-call` endpoint
4. Ensure your server can handle WebSocket upgrades on `/media-stream` path

## Amazon Connect + OpenAI SIP webhook

When OpenAI receives a SIP call (for example from Amazon Connect), it posts **`realtime.call.incoming`** to your HTTPS URL. This backend accepts the call via the Realtime Calls API and opens the **OpenAI Realtime WebSocket** for session events and function tools.

- **Code layout**: `src/service/amazon-connect-phone/openai-sip-webhook/` (`webhook/`, `handle-call/`, `websocket/`, `tools/`, …), aligned with `phone-sales-ai-copilot`’s `phone-sales-ai-voice-agent`.
- **Enable**: `AMAZON_CONNECT_PHONE_ENABLE=true`
- **Default route**: `POST /amazon-connect-openai-voice-agent/incoming-call`
- **Optional Connect attributes**: `AMAZON_CONNECT_SDK_ENABLE=true` and AWS credentials — see [amazon-connect-openai-webhook.md](./docs/amazon-connect-openai-webhook.md)

### Local development: OpenAI Realtime webhook and ngrok

OpenAI must call your webhook over **public HTTPS**. `http://localhost:4000/...` is not reachable from the internet, so for local development you need a **tunnel** (ngrok, Cloudflare Tunnel, localtunnel, etc.).

1. Start the backend (`npm run dev` on port `4000` by default).
2. In another terminal, start ngrok pointing at the same port:
   ```bash
   ngrok http 4000
   ```
3. Copy the **HTTPS** URL ngrok prints (for example `https://abc123.ngrok-free.app`).
4. In the **OpenAI dashboard**, configure the Realtime / SIP / phone webhook URL to:
   ```
   https://abc123.ngrok-free.app/amazon-connect-openai-voice-agent/incoming-call
   ```
   If you changed `AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH` in `.env`, replace the path segment accordingly (the default base path is `/amazon-connect-openai-voice-agent`).
5. Set `AMAZON_CONNECT_PHONE_ENABLE=true` in `backend/.env` and restart. Open **`/status`** on the tunneled host to confirm the webhook URL OpenAI should use matches what you registered.

Full step-by-step (including Connect and SIP) is in [../doc/local-testing-twilio-and-amazon-connect-sip.md](../doc/local-testing-twilio-and-amazon-connect-sip.md) (section **2. Amazon Connect + SIP (to OpenAI) + OpenAI `realtime.call.incoming` webhook**).

## 🌐 Web Voice Integration

The backend also supports web-based voice interactions via Socket.IO:

- **Endpoint**: `ws://localhost:4000/realtime-voice`
- **Protocol**: Socket.IO WebSocket
- **Channel**: `src/service/web-voice/index.ts` → `foundation/websocket/endpoints/web-voice/`
- **Session management**: `src/foundation/open-ai/session-manager/voice-session-manger.ts`

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.ts                 # Wires the 3 voice channels + MCP
│   ├── misc/
│   ├── foundation/
│   │   ├── open-ai/             # Agents, VoiceSessionManager, send-http-request
│   │   ├── mcp-server/
│   │   ├── websocket/           # web-voice (Socket.IO) + twilio-phone (/media-stream)
│   │   └── amazon-connect/      # Optional Connect SDK
│   └── service/
│       ├── web-voice/           # initWebVoiceChannel
│       ├── twilio-phone/        # initTwilioPhoneChannel (+ http-route)
│       └── amazon-connect-phone/
│           └── openai-sip-webhook/
├── package.json
├── tsconfig.json                # paths: "@/*" -> "src/*"
└── README.md
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server with nodemon (auto-reload)
- `npm run start` - Compile TypeScript and start production server
- `npm run build` - Compile TypeScript to JavaScript
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🔧 Customization

### Adding Your Own Agents

Replace or extend the demo agents in `src/foundation/open-ai/agents/`:

- `realtime-voice/front-desk-agent/` - Web interactions
- `realtime-phone/front-desk-agent/` - Phone-optimized agent ⭐
- `hotel-booking-agent/` - Hotel booking agent (demo)
- `flight-booking-agent/` - Flight booking agent (demo)
- `car-rental-booking-agent/` - Car rental agent (demo)
- `post-booking-agent/` - Post-booking agent (demo)

### Adding Your Own MCP Servers

Create new MCP servers in `src/foundation/mcp-server/` and register them in `src/foundation/mcp-server/index.ts`.

## 📚 Documentation

For detailed architecture documentation, see:
- [Backend Architecture](../doc/backend-voice-ai-agent-design.md)
- [Twilio Integration Guide](./docs/twilio-integration.md)
- [Amazon Connect + OpenAI webhook](./docs/amazon-connect-openai-webhook.md)
- [Local testing: Twilio & Connect + SIP](../doc/local-testing-twilio-and-amazon-connect-sip.md)

## 🎯 Key Implementation Points

1. **Dual-Channel Support**: The backend handles both web and phone voice interactions simultaneously
2. **Agent Specialization**: Different agents for web (`realtime-voice/front-desk-agent`) and phone (`realtime-phone/front-desk-agent`)
3. **Session Isolation**: Each connection (web or phone) gets its own isolated session
4. **MCP Integration**: MCP servers connect in background after session establishment for optimal performance
5. **Phone Session Data**: Automatic retrieval of customer context based on phone number
6. **Transport Layers**: Different transport layers for web (Socket.IO) and phone (Twilio Media Streams)

## 📝 License

MIT
