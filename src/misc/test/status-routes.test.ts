import express from 'express'
import request from 'supertest'
import { buildStatusPayload, registerStatusRoutes } from '../status-routes'

describe('status routes', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  const createApp = () => {
    const app = express()
    registerStatusRoutes(app, 4000, [
      { name: 'hotel-booking-example', path: '/hotel-booking-mcp' },
    ])
    return app
  }

  it('serves liveness, JSON status, and HTML status', async () => {
    process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH = '/connect'
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'
    const app = createApp()

    await request(app).get('/health').expect(200, 'OK')

    const jsonResponse = await request(app)
      .get('/status.json')
      .set('Host', 'phone.example')
      .expect(200)
    expect(jsonResponse.body).toMatchObject({
      port: 4000,
      services: expect.arrayContaining([
        expect.objectContaining({ id: 'amazon-connect-phone', ready: true }),
        expect.objectContaining({ id: 'amazon-connect-sdk', ready: true }),
      ]),
    })
    expect(jsonResponse.body.services[1].endpoints[0].url).toBe(
      'http://phone.example/connect/incoming-call'
    )

    const httpsJson = await request(app)
      .get('/status.json')
      .set('Host', 'ai-phone-agent.bobbylkchao.com')
      .set('X-Forwarded-Proto', 'https, http')
      .expect(200)
    expect(httpsJson.body.services[0].endpoints[0].url).toBe(
      'https://ai-phone-agent.bobbylkchao.com'
    )
    expect(httpsJson.body.services[1].endpoints[0].url).toBe(
      'https://ai-phone-agent.bobbylkchao.com/connect/incoming-call'
    )
    expect(httpsJson.body.mcpServers[0].url).toBe(
      'https://ai-phone-agent.bobbylkchao.com/hotel-booking-mcp'
    )
    expect(jsonResponse.body.mcpServers).toEqual([
      {
        name: 'hotel-booking-example',
        url: 'http://phone.example/hotel-booking-mcp',
        ready: true,
      },
    ])

    const htmlResponse = await request(app)
      .get('/status')
      .set('Host', '<unsafe.example>')
      .expect(200)
      .expect('Content-Type', /html/)
    expect(htmlResponse.text).toContain('AI Phone Agent — status')
    expect(htmlResponse.text).toContain('&lt;unsafe.example&gt;')
  })

  it('reports missing optional configuration', () => {
    delete process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH
    delete process.env.AMAZON_CONNECT_SDK_ENABLE
    const req = {
      get: jest.fn().mockReturnValue(undefined),
      secure: true,
    }

    const payload = buildStatusPayload(req as never, 4567)

    expect(payload.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'amazon-connect-phone',
          ready: false,
          detail: 'Set AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH',
        }),
        expect.objectContaining({
          id: 'amazon-connect-sdk',
          ready: false,
        }),
      ])
    )
    expect(payload.services[0].endpoints[0].url).toBe('https://localhost:4567')
  })

  it('renders Off badges when optional services are not configured', async () => {
    delete process.env.AMAZON_CONNECT_PHONE_WEBHOOK_BASE_PATH
    delete process.env.AMAZON_CONNECT_SDK_ENABLE

    const response = await request(createApp()).get('/status').expect(200)
    expect(response.text).toContain('<span class="off">Off</span>')
    expect(response.text).toContain('No URLs')
  })
})
