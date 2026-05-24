export interface SolveRequest {
  text?: string
  imageBase64?: string
  mediaType?: string
}

export async function solve(req: SolveRequest): Promise<string> {
  const hasImage = Boolean(req.imageBase64)
  const endpoint = hasImage ? '/api/solve' : '/api/chat'

  const body = hasImage
    ? { text: req.text, imageBase64: req.imageBase64, mediaType: req.mediaType }
    : { text: req.text }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '서버 오류가 발생했습니다.' })) as { error?: string }
    throw new Error(data.error ?? '서버 오류가 발생했습니다.')
  }

  const data = await res.json() as { answer: string }
  return data.answer
}
