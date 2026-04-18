# AI Phone Agent — Architecture

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Amazon Connect and OpenAI SIP Webhook](#amazon-connect-and-openai-sip-webhook)
4. [Core Components](#core-components)
   - [OpenAI Realtime Agent](#openai-realtime-agent)
   - [OpenAI Realtime Session](#openai-realtime-session)
   - [Multiple Sessions Management](#multiple-sessions-management)
5. [Multi-Agent System](#multi-agent-system)
   - [Agent Architecture](#agent-architecture)
   - [Agent Types](#agent-types)
   - [Multi-Agent Handoff](#multi-agent-handoff)
   - [Agent2Agent Communication](#agent2agent-communication)
6. [MCP Server Integration](#mcp-server-integration)
   - [MCP Server Architecture](#mcp-server-architecture)
   - [Multiple MCP Servers](#multiple-mcp-servers)
   - [MCP Server Registration](#mcp-server-registration)
7. [WebSocket Communication](#websocket-communication)
8. [Audio Processing](#audio-processing)
9. [Session Lifecycle](#session-lifecycle)
10. [Error Handling](#error-handling)
11. [Future Enhancements](#future-enhancements)
12. [Repository layout](#repository-layout)
13. [Status dashboard](#status-dashboard)

## Overview

This system implements a realtime voice AI agent platform using OpenAI's Realtime API, enabling natural voice conversations with multiple specialized AI agents. The architecture supports concurrent user sessions, multiple agents with handoff capabilities, and integration with Model Context Protocol (MCP) servers for tool access.

### Key Features

- **Realtime Voice Interaction**: Bi-directional audio streaming with OpenAI's Realtime API
- **Multi-Session Support**: Concurrent handling of multiple user sessions
- **Multi-Agent System**: Specialized agents with intelligent routing and handoff
- **MCP Server Integration**: Tool access through multiple MCP servers
- **Agent-to-Agent Communication**: Agents can delegate tasks to specialized agents
- **Voice Activity Detection**: Server-side VAD for natural conversation flow
- **Amazon Connect + OpenAI SIP** (optional): HTTP webhook for `realtime.call.incoming`, accept/hangup REST, and client WebSocket for tool calls
- **Status dashboard** (`GET /status`, `GET /status.json`): HTML or JSON view of enabled channels (Twilio phone, Amazon Connect phone, Connect SDK) and MCP URLs; implementation in `src/misc/status-routes.ts`

## System Architecture

Phone-first layout: **Twilio** (`/twilio-phone/incoming-call` + `/twilio-phone/media-stream`) and/or **Amazon Connect + OpenAI SIP** (HTTPS webhook + OpenAI Realtime WebSocket). Shared **OpenAI agents**, **MCP** HTTP tool servers, optional **Amazon Connect SDK** for contact attributes.

```
Twilio PSTN ──► /twilio-phone/incoming-call (TwiML) ──► /twilio-phone/media-stream (WS) ──► TwilioRealtimeTransportLayer ──► RealtimeSession + agents + MCP

Amazon Connect ──► OpenAI SIP ──► your POST .../incoming-call ──► accept + WSS to OpenAI ──► tools (e.g. handoff)
```

## Amazon Connect and OpenAI SIP Webhook

When **Amazon Connect** (or another SIP provider) routes calls into **OpenAI Realtime SIP**, OpenAI delivers a **`realtime.call.incoming`** event to your HTTPS endpoint. This project implements that flow under `src/service/amazon-connect-phone/openai-sip-webhook/`, following the same directory pattern as `phone-sales-ai-copilot`’s `phone-sales-ai-voice-agent` service (`webhook/`, `handle-call/`, `websocket/`, `client-side-events/`, `tools/`, `agents/`).

### Request flow

```
Amazon Connect → OpenAI SIP → POST /amazon-connect-phone/incoming-call
                                      │
                                      ├─► POST /v1/realtime/calls/{call_id}/accept
                                      │
                                      └─► WSS api.openai.com/v1/realtime?call_id=...
                                            (session.update, response.create, tool calls)
```

### Configuration

- Set `AMAZON_CONNECT_PHONE_ENABLE=true` and configure OpenAI to send webhooks to `{BASE_PATH}/incoming-call`.
- Optional: `AMAZON_CONNECT_SDK_ENABLE=true` plus AWS credentials and `AMAZON_CONNECT_INSTANCE_ID` so tools such as `disconnect_the_call` and `transfer_to_human_agent` can call **UpdateContactAttributes** (handoff flag, conversation summary, and trip intake payload—see [amazon-connect-openai-webhook.md](./amazon-connect-openai-webhook.md)).

### Relationship to Twilio and Connect

| Path | Use case |
|------|-----------|
| Native WS `/twilio-phone/media-stream` | Twilio Media Streams |
| HTTP Twilio `.../twilio-phone/incoming-call` **or** Connect `...{BASE}/incoming-call` | Twilio TwiML **or** OpenAI SIP / Connect webhook (different deployments) |

Detailed setup and customization notes: [amazon-connect-openai-webhook.md](./amazon-connect-openai-webhook.md).  
Local tunnel testing: [local-testing-twilio-and-amazon-connect-sip.md](./local-testing-twilio-and-amazon-connect-sip.md).

## Core Components

### OpenAI Realtime Agent

The OpenAI Realtime Agent is the foundation of our voice interaction system. Each agent is configured with:

- **Name**: Identifies the agent's role
- **Voice**: Voice profile (e.g., 'marin', 'cedar')
- **Instructions**: System prompts defining behavior and capabilities
- **Tools**: Other agents that can be invoked as tools
- **MCP Servers**: External tool providers via Model Context Protocol

**Implementation Location**: `src/service/twilio-phone/agents/`

**Key Configuration**:
- Model: `gpt-realtime-1.5` (default via `OPENAI_MODEL` in `.env`; override as needed)
- Audio Format: PCM, 24kHz sample rate
- VAD: Server-side voice activity detection
- Transcription: `gpt-4o-mini-transcribe`

### OpenAI Realtime Session

Each user connection gets a dedicated `RealtimeSession` instance that manages:

1. **Connection Lifecycle**: Connect, maintain, and disconnect from OpenAI Realtime API
2. **Audio Streaming**: Bidirectional PCM audio at 24kHz
3. **Event Handling**: Transport events, audio events, turn management
4. **Agent Orchestration**: Routes requests to the appropriate agent

**Session Configuration**:

```typescript
{
  model: 'gpt-realtime-1.5',
  config: {
    audio: {
      input: {
        turnDetection: {
          type: 'server_vad',
          create_response: true,
          interrupt_response: true,
          silence_duration_ms: 1500
        },
        format: {
          rate: 24000,
          type: 'audio/pcm'
        },
        transcription: {
          model: 'gpt-4o-mini-transcribe'
        }
      },
      output: {
        format: {
          rate: 24000,
          type: 'audio/pcm'
        },
        speed: 1.0
      }
    }
  }
}
```

**Session Events**:
- `transport_event`: Conversation items, transcriptions
- `audio`: Assistant audio chunks
- `audio_interrupted`: User interrupted assistant
- `turn_started`: Model begins generating response
- `turn_done`: Model completes response
- `error`: Session errors
- `connection_change`: Connection status updates

### Multiple Sessions Management

Twilio and Amazon Connect paths each maintain **per-call** `RealtimeSession` (or equivalent) on the OpenAI side; there is no separate browser `VoiceSessionManager` in this repository (phone-only scope).

## Multi-Agent System

### Agent Architecture

The system implements a hierarchical agent architecture where:

1. **Front Desk Agent**: Primary orchestrator that handles general queries and routes to specialists
2. **Specialized Agents**: Domain experts for specific tasks (hotel, flight, car rental, post-booking)

Each agent can:
- Handle voice conversations in its domain
- Transfer to other agents when needed
- Invoke MCP tools for external capabilities
- Call other agents as tools (Agent2Agent pattern)

### Agent Types

#### 1. Front Desk Agent (phone)

**Location**: `src/service/twilio-phone/agents/realtime-phone/front-desk-agent/index.ts` (Twilio path; Connect SIP uses dedicated prompts under `openai-sip-webhook/agents/`)

**Responsibilities**:
- Primary point of contact for users
- Handles general trip booking questions
- Routes specialized requests to domain agents
- Manages overall conversation flow

**Capabilities**:
- Direct conversation for general queries
- Tool invocation for hotel, car rental, and flight bookings
- Access to MCP servers for hotel search, weather, etc.

**Tools Registered**:
- `hotel_booking_expert`: HotelBookingAgent
- `car_rental_booking_expert`: CarRentalBookingAgent
- `flight_booking_expert`: FlightBookingAgent
- `post_booking_expert`: PostBookingAgent

#### 2. Hotel Booking Agent

**Location**: `src/service/twilio-phone/agents/general-agents/hotel-booking-agent/index.ts`

**Responsibilities**:
- Specialized hotel booking assistance
- Weather information for destinations
- Transfer to other agents for non-hotel requests

**Voice**: Cedar

#### 3. Flight Booking Agent

**Location**: `src/service/twilio-phone/agents/general-agents/flight-booking-agent/index.ts`

**Responsibilities**:
- Specialized flight booking assistance
- Weather information for destinations
- Transfer to Front Desk for other booking types

**Voice**: Cedar

#### 4. Car Rental Booking Agent

**Location**: `src/service/twilio-phone/agents/general-agents/car-rental-booking-agent/index.ts`

**Responsibilities**:
- Specialized car rental booking assistance
- Weather information for destinations
- Transfer to Front Desk for other booking types

**Voice**: Cedar

#### 5. Post Booking Agent

**Location**: `src/service/twilio-phone/agents/general-agents/post-booking-agent/index.ts`

**Responsibilities**:
- Help with existing bookings
- Cancel bookings
- Transfer to Front Desk for new bookings

**Voice**: Cedar

### Multi-Agent Handoff

The system supports intelligent agent handoff through two mechanisms:

#### 1. Explicit Transfer Instructions

Agents are instructed to transfer to the Front Desk Agent when requests are outside their domain:

```typescript
instructions: `
  3. Transfer to Front Desk Agent if the customer requests bookings 
     other than hotels, such as flights or car rentals.
`
```

#### 2. Tool-Based Handoff (Agent2Agent)

Specialized agents are registered as tools that the Front Desk Agent can invoke:

```typescript
tools: [
  hotelBookingAgent().asTool({
    toolName: 'hotel_booking_expert',
    toolDescription: 'Book a hotel for the user.',
  }),
  // ... other agents
]
```

**Handoff Flow**:
1. User makes a request to Front Desk Agent
2. Agent determines if specialized help is needed
3. Agent invokes specialized agent as a tool
4. Specialized agent handles the conversation
5. Control returns to Front Desk Agent

### Agent2Agent Communication

The Agent2Agent pattern enables agents to delegate tasks to specialized agents:

**Implementation Pattern**:
- Agents expose themselves as tools via `.asTool()` method
- Tool invocation triggers agent execution
- Context and conversation state are maintained
- Results are returned to the calling agent

**Benefits**:
- **Modularity**: Each agent handles its domain
- **Scalability**: Easy to add new specialized agents
- **Maintainability**: Clear separation of concerns
- **Flexibility**: Agents can compose complex workflows

**Example Flow**:
```
User: "I need to book a hotel in Paris"

Front Desk Agent:
  1. Recognizes hotel booking request
  2. Invokes hotel_booking_expert tool
  3. HotelBookingAgent takes over conversation
  4. Collects booking details
  5. Uses MCP tools to search hotels
  6. Returns booking confirmation
  7. Front Desk Agent continues conversation
```

## MCP Server Integration

### MCP Server Architecture

Model Context Protocol (MCP) servers provide external tool capabilities to agents:

**Benefits**:
- **Separation of Concerns**: Tools live in separate services
- **Scalability**: Each MCP server can scale independently
- **Modularity**: Easy to add/remove tool capabilities
- **Standardization**: MCP protocol standardizes tool access

### Multiple MCP Servers

The system supports multiple MCP servers per session:

**Implementation**: `src/foundation/mcp-server/index.ts`

**Current MCP Servers**:

1. **Booking MCP Server**
   - URL: `http://localhost:4000/booking-mcp`
   - Tools:
     - `search-hotel`: Search hotels by location and dates
     - `get-destination-weather`: Get weather for destination cities

2. **Post Booking MCP Server**
   - URL: `http://localhost:4000/post-booking-mcp`
   - Tools:
     - `cancel-booking`: Cancel existing bookings

### MCP Server Registration

**Per-Session Connection**:
- Each session creates its own MCP server connections
- MCP servers are stored in `Map<clientId, MCPServerStreamableHttp[]>`
- Connections are established during session creation
- Properly closed during session cleanup

**Connection Flow**:
```typescript
for (const mcpServerConfig of mcpServerList) {
  const mcpServer = new MCPServerStreamableHttp({
    url: mcpServerConfig.url,
    name: mcpServerConfig.name,
  })
  await mcpServer.connect()
  mcpServers.set(clientId, [...(mcpServers.get(clientId) || []), mcpServer])
}
```

**MCP Server Implementation**:

Each MCP server:
- Extends `McpServer` from `@modelcontextprotocol/sdk`
- Registers tools with input/output schemas using Zod
- Handles HTTP POST requests at configured endpoints
- Uses `StreamableHTTPServerTransport` for communication

**Example Tool Registration**:
```typescript
mcpServer.registerTool(
  'search-hotel',
  {
    title: 'Search Hotel',
    description: 'Search hotels by location and dates',
    inputSchema: {
      city: z.string(),
      country: z.string(),
      checkInDate: z.string(),
      checkOutDate: z.string(),
    },
    outputSchema: {
      hotels: z.array(z.object({
        name: z.string(),
        address: z.string(),
        price: z.number(),
        rating: z.number(),
        availability: z.boolean(),
      })),
    },
  },
  async ({ city, country, checkInDate, checkOutDate }) => {
    // Tool implementation
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output,
    }
  }
)
```

## WebSocket Communication

**Implementation**: `src/foundation/websocket/index.ts` exposes Twilio Media Stream WebSocket setup only (`initTwilioPhoneMediaStreamWebSocket`).

### Twilio Media Stream WebSocket

The system supports integration with Twilio for phone-based voice interactions:

**Implementation**: `src/service/twilio-phone/index.ts` and `src/foundation/websocket/endpoints/twilio-phone/` (`initTwilioPhoneMediaStreamWebSocketServer`)

**Configuration**:
- Transport: Native WebSocket (using `ws` library)
- Path: `/twilio-phone/media-stream`
- Protocol: Twilio Media Streams API
- Transport Layer: `TwilioRealtimeTransportLayer` from `@openai/agents-extensions`

**Twilio Integration Architecture**:

```
Phone Call → Twilio → /twilio-phone/incoming-call (HTTP POST)
                      ↓
                  TwiML Response
                  <Stream url="wss://.../twilio-phone/media-stream" />
                      ↓
                  Twilio connects to /twilio-phone/media-stream (WebSocket)
                      ↓
            TwilioRealtimeTransportLayer
                      ↓
            RealtimeSession (OpenAI)
```

**Components**:

1. **HTTP Route Handler** (`src/service/twilio-phone/http-route.ts` — `initTwilioPhoneHttpRoute`):
   - Endpoint: `/twilio-phone/incoming-call`
   - Method: `ALL` (handles GET/POST)
   - Returns: TwiML XML response
   - Configurable via `TWILIO_PHONE_ENABLE` and `TWILIO_WEBHOOK_URL` environment variables

2. **WebSocket Server** (`initTwilioPhoneMediaStreamWebSocketServer`):
   - Accepts Twilio Media Stream connections
   - Creates per-call `RealtimeSession` with `TwilioRealtimeTransportLayer`
   - Manages session lifecycle tied to WebSocket connection
   - Uses `callId` from `X-Twilio-Call-Sid` header for tracking

3. **Twilio session path** (`foundation/websocket/endpoints/twilio-phone/handler.ts` — `handleTwilioPhoneMediaStreamConnection`):
   - Connects MCP servers per call in the background
   - Creates `RealtimeSession` with `frontDeskAgentForPhone`
   - Handles MCP tool calls and greeting flow

**Twilio Features**:
- **Bidirectional Audio**: Real-time audio streaming between phone and AI
- **Automatic Format Conversion**: Twilio transport layer handles audio format conversion
- **Per-Call Isolation**: Each phone call gets its own session and MCP connections
- **Connection Management**: Automatic cleanup on call termination

**Environment Variables**:
- `TWILIO_PHONE_ENABLE`: Set to `'true'` to enable the Twilio phone channel (TwiML + Media Stream)
- `TWILIO_WEBHOOK_URL`: Full WebSocket URL for Media Stream (e.g., `wss://ai-voice-agent.ilikeai.ca/twilio-phone/media-stream`)

**Twilio Setup**:
1. Configure Twilio phone number webhook to point to `https://your-domain.com/twilio-phone/incoming-call`
2. Set `TWILIO_PHONE_ENABLE=true` in environment variables
3. Set `TWILIO_WEBHOOK_URL` to your public WebSocket URL (must be `wss://` for production)
4. Ensure server is accessible via HTTPS/WSS for production use

## Audio Processing

### Audio Format

- **Format**: PCM (Pulse Code Modulation)
- **Sample Rate**: 24kHz (24000 Hz)
- **Type**: `audio/pcm`
- **Direction**: Bidirectional streaming

### Voice Activity Detection (VAD)

**Configuration**:
- **Type**: `server_vad` (OpenAI server-side VAD)
- **Create Response**: Automatically create response after user stops speaking
- **Interrupt Response**: Allow user to interrupt assistant
- **Silence Duration**: 1500ms before considering turn complete

**Benefits of Server VAD**:
- No client-side processing required
- Consistent detection across devices
- Reduces client complexity
- Better accuracy with server-side processing

### Audio streaming (Twilio path)

Media streams flow through **Twilio** ↔ **`TwilioRealtimeTransportLayer`** ↔ **OpenAI Realtime** (see `foundation/websocket/endpoints/twilio-phone/handler.ts`). The Amazon Connect path uses OpenAI’s SIP + your control-plane WebSocket to OpenAI (no browser).

## Session lifecycle (summary)

- **Twilio**: Per-call `RealtimeSession` lives for the lifetime of the `/twilio-phone/media-stream` WebSocket; MCP connects in the background per the Twilio handler.
- **Connect SIP**: Per-call state in `openai-sip-webhook` (accept → client WS → tools); hangup ends the OpenAI call leg.

## Error Handling

### Error Categories

1. **Session Creation Errors**:
   - Missing OpenAI API key
   - MCP server connection failures
   - OpenAI API connection failures

2. **Session Runtime Errors**:
   - Audio processing errors
   - Agent execution errors
   - Tool invocation errors

3. **Connection Errors**:
   - WebSocket disconnections
   - OpenAI API disconnections
   - MCP server disconnections

### Error Handling Strategy

**Graceful Degradation**:
- MCP server connection failures don't block session creation
- Logged as warnings, session continues without those tools
- Users can still interact with agents

**Error Communication**:
- Client receives error events via WebSocket
- Structured error messages with context
- Proper logging for debugging

**Logging**:
- All errors logged with structured context
- Client ID, error details, stack traces
- Uses Pino logger for structured logging

**Example Error Handling**:
```typescript
try {
  voiceSessionManager.createUserSession(socket)
  socket.emit('message', {
    event: 'SESSION_START_SUCCESS',
    data: null,
  })
} catch (error) {
  logger.error(
    { error, clientId: socket.id },
    '[Realtime Voice] Error occurred while creating Voice Session'
  )
  socket.emit('message', {
    event: 'SESSION_START_ERROR',
    data: null,
  })
}
```

## Future Enhancements

### Potential Improvements

1. **Session Persistence**:
   - Store session state for reconnection
   - Maintain conversation history across sessions

2. **Advanced Routing**:
   - Intent-based agent selection
   - Machine learning for optimal routing

3. **Multi-Language Support**:
   - Detect and handle multiple languages
   - Language-specific agents

4. **Enhanced MCP Integration**:
   - Dynamic MCP server discovery
   - MCP server health monitoring
   - Retry logic for MCP connections

5. **Analytics & Monitoring**:
   - Session metrics collection
   - Agent performance tracking
   - Conversation quality metrics

6. **Scalability Enhancements**:
   - Redis for session storage
   - Horizontal scaling support
   - Load balancing for MCP servers

7. **Security Enhancements**:
   - Authentication and authorization
   - Rate limiting per user
   - Audio data encryption

8. **Advanced Audio Features**:
   - Client-side VAD option
   - Audio quality optimization
   - Echo cancellation

## Repository layout

**Entry channels** (phone) vs **shared infrastructure**:

| Layer | Path | Role |
|--------|------|------|
| **Twilio phone** | `src/service/twilio-phone/` | PSTN via Twilio; TwiML `/twilio-phone/incoming-call` + WS `/twilio-phone/media-stream` |
| **Amazon Connect phone** | `src/service/amazon-connect-phone/` | PSTN via Connect + OpenAI SIP; webhook + Realtime WS (`openai-sip-webhook/`) |
| **Foundation** | `src/foundation/` | Shared **open-ai** agents & helpers, **mcp-server**, **websocket** (Twilio), **amazon-connect** SDK |

TypeScript path alias: `@/*` → `src/*`. Production builds run `tsc` then **`tsc-alias`**.

Entry point `src/index.ts` wires **phone channels** and MCP:

- `initTwilioPhoneChannel(app, httpServer)`
- `initAmazonConnectPhoneChannel(app)`
- `initMcpServers(app, PORT)`

**WebSocket**

- Twilio: `initTwilioPhoneMediaStreamWebSocket` → `initTwilioPhoneMediaStreamWebSocketServer`, handler `handleTwilioPhoneMediaStreamConnection` (`foundation/websocket/endpoints/twilio-phone/`).

## Status dashboard

| Route | Content |
|-------|---------|
| `GET /status` | HTML page listing each channel (HTTP, Twilio phone, Amazon Connect phone webhook, Connect SDK flag) with **Ready** / **Off** and resolved URLs using the request **Host** (works behind tunnels). |
| `GET /status.json` | Same information as JSON for scripts or monitoring. |

**Implementation**: `src/misc/status-routes.ts` (`registerStatusRoutes` is registered from `src/index.ts`). On listen, the server logs one line pointing to `/status` and describing that it aggregates ready channel URLs, webhooks, and MCP endpoints.

## Technical Stack

- **Runtime**: Node.js (>=16.0.0)
- **Framework**: Express.js
- **WebSocket**: Native WebSocket via `ws` (Twilio Media Streams)
- **AI Platform**: OpenAI Realtime API
- **Agent Framework**: @openai/agents, @openai/agents-realtime
- **Twilio Integration**: @openai/agents-extensions (TwilioRealtimeTransportLayer)
- **Amazon Connect (optional)**: @aws-sdk/client-connect for contact attribute updates on SIP path
- **MCP Protocol**: @modelcontextprotocol/sdk
- **Logging**: Pino
- **Type Safety**: TypeScript
- **Validation**: Zod

## Conclusion

This architecture provides a scalable, modular foundation for realtime voice AI interactions. The multi-agent system with handoff capabilities, MCP server integration, and concurrent session management enables complex conversational workflows while maintaining code organization and extensibility.

