/**
 * OpenAI REST helpers for Realtime Calls API (accept / hangup).
 */
export const sendHttpRequestToOpenAi = async (
  url: string,
  method: 'POST' | 'GET' | 'PUT' | 'DELETE',
  body: Record<string, unknown> = {}
): Promise<Response> => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
