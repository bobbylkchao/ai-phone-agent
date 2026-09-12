import express from 'express'
import request from 'supertest'
import { acceptOpenAiSipCall } from '../../handle-call/accept-call'
import { handleOpenAiSipIncomingCallWebhook } from '../incoming-call'

jest.mock('../../handle-call/accept-call', () => ({
  acceptOpenAiSipCall: jest.fn(),
}))

const acceptCallMock = jest.mocked(acceptOpenAiSipCall)

describe('handleOpenAiSipIncomingCallWebhook', () => {
  const createApp = () => {
    const app = express()
    app.use(express.json())
    app.all('/incoming-call', handleOpenAiSipIncomingCallWebhook)
    return app
  }

  const incomingEvent = (userToUser?: string) => ({
    object: 'event',
    id: 'event-1',
    type: 'realtime.call.incoming',
    created_at: 1,
    data: {
      call_id: 'call/1',
      sip_headers: [
        { name: 'X-Amzn-SourceArn', value: 'source-arn' },
        ...(userToUser ? [{ name: 'User-to-User', value: userToUser }] : []),
      ],
    },
  })

  it('decodes Connect UUI metadata and accepts a valid call', async () => {
    acceptCallMock.mockResolvedValueOnce({ ok: true })
    const uui = Buffer.from(
      JSON.stringify({
        contactId: 'contact-1',
        queueName: 'Sales',
        customerPhoneNumber: '+15550000000',
      })
    ).toString('hex')

    const response = await request(createApp())
      .post('/incoming-call')
      .send(incomingEvent(`${uui};encoding=hex`))
      .expect(200)

    expect(response.body).toEqual({ accepted: true, call_id: 'call/1' })
    expect(acceptCallMock).toHaveBeenCalledWith({
      callId: 'call/1',
      metaData: expect.objectContaining({
        amazonConnectSourceArn: 'source-arn',
        contactId: 'contact-1',
        queueName: 'Sales',
        customerPhoneNumber: '+15550000000',
      }),
    })
  })

  it('rejects unsupported methods and malformed events', async () => {
    await request(createApp()).get('/incoming-call').expect(405)
    await request(createApp())
      .post('/incoming-call')
      .send({ type: 'other' })
      .expect(400)
    await request(createApp())
      .post('/incoming-call')
      .send({ type: 'realtime.call.incoming', data: {} })
      .expect(400)
    expect(acceptCallMock).not.toHaveBeenCalled()
  })

  it('tolerates invalid UUI and reports an accept failure', async () => {
    acceptCallMock.mockResolvedValueOnce({ ok: false, error: 'rejected' })

    const response = await request(createApp())
      .post('/incoming-call')
      .send(incomingEvent('not-hex'))
      .expect(500)

    expect(response.body).toEqual({
      accepted: false,
      call_id: 'call/1',
      error: 'rejected',
    })
    expect(acceptCallMock).toHaveBeenCalledWith({
      callId: 'call/1',
      metaData: expect.objectContaining({ contactId: undefined }),
    })
  })

  it('treats invalid JSON UUI and missing SIP headers as empty metadata', async () => {
    acceptCallMock.mockResolvedValue({ ok: true })

    await request(createApp())
      .post('/incoming-call')
      .send(incomingEvent(Buffer.from('{').toString('hex')))
      .expect(200)
    await request(createApp())
      .post('/incoming-call')
      .send({
        object: 'event',
        id: 'event-1',
        type: 'realtime.call.incoming',
        created_at: 1,
        data: { call_id: 'call/1' },
      })
      .expect(200)

    expect(acceptCallMock).toHaveBeenCalledWith({
      callId: 'call/1',
      metaData: expect.objectContaining({
        amazonConnectSourceArn: undefined,
        contactId: undefined,
      }),
    })
  })

  it('returns a sanitized 500 response for unexpected errors', async () => {
    acceptCallMock.mockRejectedValueOnce(new Error('internal secret'))

    const response = await request(createApp())
      .post('/incoming-call')
      .send(incomingEvent())
      .expect(500)

    expect(response.body).toEqual({
      accepted: false,
      error: 'Error occurred while handling incoming call',
    })
  })
})
