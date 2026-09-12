import { sendHttpRequestToOpenAi } from '../send-http-request'

describe('sendHttpRequestToOpenAi', () => {
  const originalApiKey = process.env.OPENAI_API_KEY

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey
    jest.restoreAllMocks()
  })

  it('requires an OpenAI API key', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(
      sendHttpRequestToOpenAi('https://example.test', 'POST')
    ).rejects.toThrow('OPENAI_API_KEY is not set')
  })

  it('sends an authenticated JSON request', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const response = new Response(null, { status: 200 })
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response)

    await expect(
      sendHttpRequestToOpenAi('https://example.test', 'POST', { ok: true })
    ).resolves.toBe(response)
    expect(fetchMock).toHaveBeenCalledWith('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: '{"ok":true}',
    })
  })
})
