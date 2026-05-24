import OpenAI from 'openai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SYSTEM_PROMPT } from '../src/constants/systemPrompt.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body as { text?: string }

  if (!text?.trim()) {
    return res.status(400).json({ error: '문제를 입력해주세요.' })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.trim() },
      ],
      max_tokens: 2048,
    })

    const answer = completion.choices[0]?.message?.content ?? ''
    return res.status(200).json({ answer })
  } catch (err) {
    console.error('OpenAI API error:', err)
    return res.status(500).json({ error: '풀이 생성 중 오류가 발생했습니다.' })
  }
}
