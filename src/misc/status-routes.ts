import type { Express, Request, Response } from 'express'
import { mcpServerList } from '@/foundation/mcp-server'
import { TWILIO_PHONE_INCOMING_CALL_PATH } from '@/service/twilio-phone/constants'

export interface StatusServiceRow {
  id: string
  name: string
  ready: boolean
  detail?: string
  endpoints: { label: string; url: string }[]
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const publicBase = (req: Request, port: number): string => {
  const host = req.get('host') || `localhost:${port}`
  const proto = req.secure ? 'https' : 'http'
  return `${proto}://${host}`
}

export const buildStatusPayload = (req: Request, port: number) => {
  const base = publicBase(req, port)

  const twilioEnabled =
    process.env.TWILIO_PHONE_ENABLE === 'true' &&
    Boolean(process.env.TWILIO_WEBHOOK_URL)
  const twilioWebhookUrl = process.env.TWILIO_WEBHOOK_URL || ''

  const connectPhoneEnabled = process.env.AMAZON_CONNECT_PHONE_ENABLE === 'true'
  const connectWebhookBase = process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH
  const connectIncomingUrl = `${base}${connectWebhookBase}/incoming-call`

  const connectSdkEnabled = process.env.AMAZON_CONNECT_SDK_ENABLE === 'true'

  const services: StatusServiceRow[] = [
    {
      id: 'http',
      name: 'HTTP server',
      ready: true,
      endpoints: [{ label: 'Base URL', url: base }],
    },
    {
      id: 'twilio-phone',
      name: 'Twilio phone',
      ready: twilioEnabled,
      detail: twilioEnabled
        ? 'TwiML + Media Stream'
        : 'Set TWILIO_PHONE_ENABLE=true and TWILIO_WEBHOOK_URL',
      endpoints: [
        {
          label: 'TwiML webhook (voice)',
          url: `${base}${TWILIO_PHONE_INCOMING_CALL_PATH}`,
        },
        ...(twilioWebhookUrl
          ? [{ label: 'Media Stream (WebSocket)', url: twilioWebhookUrl }]
          : []),
      ],
    },
    {
      id: 'amazon-connect-phone',
      name: 'Amazon Connect phone (OpenAI SIP)',
      ready: connectPhoneEnabled,
      detail: connectPhoneEnabled
        ? 'realtime.call.incoming'
        : 'Set AMAZON_CONNECT_PHONE_ENABLE=true',
      endpoints: [
        {
          label: 'OpenAI webhook POST',
          url: connectIncomingUrl,
        },
      ],
    },
    {
      id: 'amazon-connect-sdk',
      name: 'Amazon Connect SDK',
      ready: connectSdkEnabled,
      detail: connectSdkEnabled
        ? 'Contact attributes API'
        : 'Set AMAZON_CONNECT_SDK_ENABLE=true (+ AWS credentials)',
      endpoints: [],
    },
  ]

  const mcp = mcpServerList.map((m) => {
    const path = new URL(m.url).pathname
    return {
      name: m.name,
      phoneCallOnly: m.phoneCallOnly,
      url: `${base}${path}`,
      ready: true,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    port,
    services,
    mcpServers: mcp,
  }
}

const renderStatusHtml = (
  payload: ReturnType<typeof buildStatusPayload>
): string => {
  const rows = (s: StatusServiceRow) =>
    s.endpoints
      .map(
        (e) =>
          `<tr><td class="muted">${escapeHtml(e.label)}</td><td><code>${escapeHtml(e.url)}</code></td></tr>`
      )
      .join('')

  const serviceCards = payload.services
    .map((s) => {
      const badge = s.ready
        ? '<span class="ok">Ready</span>'
        : '<span class="off">Off</span>'
      const epBlock =
        s.endpoints.length > 0
          ? `<table class="ep">${rows(s)}</table>`
          : '<p class="muted">No URLs</p>'
      return `<section class="card">
  <div class="card-h"><h2>${escapeHtml(s.name)}</h2>${badge}</div>
  ${s.detail ? `<p class="detail">${escapeHtml(s.detail)}</p>` : ''}
  ${epBlock}
</section>`
    })
    .join('\n')

  const mcpRows = payload.mcpServers
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.name)}</td><td><code>${escapeHtml(m.url)}</code></td><td>${m.ready ? '<span class="ok">Ready</span>' : '—'}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Voice agent — status</title>
  <style>
    :root { --bg: #0f1419; --card: #1a2332; --text: #e7e9ea; --muted: #8b98a5; --ok: #00ba7c; --off: #71767b; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; line-height: 1.5; }
    .wrap { max-width: 52rem; margin: 0 auto; }
    h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.25rem; }
    .sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 1.25rem; }
    .card { background: var(--card); border-radius: 10px; padding: 1rem 1.1rem; margin-bottom: 0.85rem; }
    .card-h { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.35rem; }
    .card-h h2 { font-size: 1rem; font-weight: 600; margin: 0; }
    .detail { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.5rem; }
    .ep { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .ep td { padding: 0.35rem 0; vertical-align: top; }
    .ep td:first-child { width: 11rem; }
    code { font-size: 0.8rem; word-break: break-all; background: rgba(0,0,0,0.25); padding: 0.15rem 0.35rem; border-radius: 4px; }
    .muted { color: var(--muted); }
    .ok { color: var(--ok); font-size: 0.75rem; font-weight: 600; }
    .off { color: var(--off); font-size: 0.75rem; font-weight: 600; }
    h3 { font-size: 0.95rem; margin: 1.25rem 0 0.5rem; }
    footer { margin-top: 1.5rem; font-size: 0.8rem; color: var(--muted); }
    a { color: #1d9bf0; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Realtime voice agent — status</h1>
    <p class="sub">Generated ${escapeHtml(payload.generatedAt)} · Port ${payload.port}</p>
    ${serviceCards}
    <h3>MCP servers</h3>
    <section class="card">
      <table class="ep">
        <thead><tr><td class="muted">Name</td><td class="muted">URL</td><td class="muted">Status</td></tr></thead>
        ${mcpRows}
      </table>
    </section>
    <footer>
      JSON: <a href="/status.json">/status.json</a>
    </footer>
  </div>
</body>
</html>`
}

export const registerStatusRoutes = (app: Express, port: number): void => {
  app.get('/status.json', (req: Request, res: Response) => {
    res.json(buildStatusPayload(req, port))
  })

  app.get('/status', (req: Request, res: Response) => {
    const payload = buildStatusPayload(req, port)
    res.type('html').send(renderStatusHtml(payload))
  })
}
