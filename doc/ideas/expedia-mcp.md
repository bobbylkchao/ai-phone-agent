# Expedia MCP

**Status:** exploring  
**Fits:** `src/example/hotel-booking/` only. Do not put Expedia semantics in the
Connect/SIP core.

## Why

The hotel example currently hosts a local `search-hotel` stub at
`POST /hotel-booking-mcp` and attaches its public HTTPS URL to the phone session
through Realtime Remote MCP. Expedia already publishes an MCP server for travel
recommendations, which is the natural replacement for that stub.

## What exists

- Official repo: [ExpediaGroup/expedia-travel-recommendations-mcp](https://github.com/ExpediaGroup/expedia-travel-recommendations-mcp)
- Transports: `stdio` and Streamable HTTP (`http://localhost:9900/mcp` in their
  docs)
- Surface: hotels, flights, activities, cars
- Auth: `EXPEDIA_API_KEY` on the self-hosted server
- Third-party listings also mention a hosted endpoint `https://www.expedia.com/mcp`
  with OAuth. Treat that as unverified until we try it ourselves.

Hotel query shape from their README (illustrative):

```json
{
  "query": {
    "destination": "Seattle",
    "check_in": "2025-05-01",
    "check_out": "2025-05-05"
  }
}
```

## How it would attach here

The example now uses option 1:

1. **Realtime Remote MCP** — deploy Expedia MCP (or a thin proxy) at a public
   HTTPS URL and add `{ type: "mcp", server_url, allowed_tools }` on call
   accept. OpenAI executes the tools. Localhost will not work.
2. **Function-tool adapter** — keep a Realtime `function` tool in
   `hotelBookingAgent.tools` and have this server call Expedia MCP. Easier
   locally; more code in the app.

Keep option 1 for the open-source story (“swap the MCP URL”). Use option 2 only
if we cannot expose HTTPS or need to sanitize/limit results first.

## Constraints

- Phone latency: hotel search must return a short spoken list, not a dump.
- PII: do not log full caller identity with search queries.
- Keep flights/cars/activities out of the first hotel example.
- API key / OAuth stay in env or secret manager, never in git.

## Next probes

1. Run the Expedia MCP locally with a sandbox/test key; call hotel search
   against a city such as Chicago.
2. Compare tool names and input schema with our stub.
3. Test its public HTTPS endpoint as a drop-in replacement for
   `HOTEL_BOOKING_MCP_SERVER_URL`.
