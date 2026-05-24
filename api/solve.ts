import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SYSTEM_PROMPT } from '../src/constants/systemPrompt.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const ALLOWED_MEDIA_TYPES: AllowedMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, imageBase64, mediaType } = req.body as {
    text?: string
    imageBase64?: string
    mediaType?: string
  }

  if (!imageBase64) {
    return res.status(400).json({ error: '이미지를 업로드해주세요.' })
  }

  const safeMediaType: AllowedMediaType = ALLOWED_MEDIA_TYPES.includes(
    mediaType as AllowedMediaType,
  )
    ? (mediaType as AllowedMediaType)
    : 'image/jpeg'

  const userText =
    text?.trim() || '위 이미지의 확률과 통계 문제를 손풀이 스타일로 풀어줘.'

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: safeMediaType,
                data: imageBase64,
              },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    })

    const result = message.content[0]
    if (result.type !== 'text') {
      return res.status(500).json({ error: '응답 형식 오류가 발생했습니다.' })
    }
    return res.status(200).json({ answer: result.text })
  } catch (err) {
    console.error('Anthropic API error:', err)
    return res.status(500).json({ error: '풀이 생성 중 오류가 발생했습니다.' })
  }
}
