import { useState, useRef, useEffect } from 'react'
import { solve } from '../api/solve'

interface Message {
  role: 'user' | 'assistant'
  text: string
  imageUrl?: string
  isLoading?: boolean
}

interface Difficulty {
  label: string
  desc: string
}

const UNITS = [
  '경우의 수',
  '순열과 조합',
  '이항정리',
  '확률의 뜻과 기본 성질',
  '조건부확률과 독립',
  '이산확률변수',
  '연속확률변수와 정규분포',
  '통계적 추정',
]

const DIFFICULTIES: Difficulty[] = [
  { label: '2점', desc: '기본' },
  { label: '3점', desc: '표준' },
  { label: '4점', desc: '심화' },
]

type AllowedMimeType = 'image/jpeg' | 'image/png' | 'image/webp'
const ALLOWED_TYPES: AllowedMimeType[] = ['image/jpeg', 'image/png', 'image/webp']

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Solver() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [showUnitSelector, setShowUnitSelector] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type as AllowedMimeType)) {
      alert('JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다.')
      return
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleImageRemove() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
  }

  async function submitMessage(
    text: string,
    imageBase64?: string,
    mediaType?: string,
    displayImageUrl?: string,
  ) {
    if (!text && !imageBase64) return
    if (isLoading) return

    const userMessage: Message = {
      role: 'user',
      text,
      imageUrl: displayImageUrl,
    }

    setMessages(prev => [
      ...prev,
      userMessage,
      { role: 'assistant', text: '', isLoading: true },
    ])
    setShowUnitSelector(false)
    setIsLoading(true)

    try {
      const answer = await solve({ text, imageBase64, mediaType })
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', text: answer }
        return updated
      })
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : '오류가 발생했습니다.'
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          text: `오류: ${errorMsg}`,
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit() {
    const text = input.trim()
    if (!text && !imageFile) return
    if (isLoading) return

    let imageBase64: string | undefined
    let mediaType: string | undefined
    let displayImageUrl: string | undefined

    if (imageFile) {
      imageBase64 = await fileToBase64(imageFile)
      mediaType = imageFile.type
      displayImageUrl = `data:${imageFile.type};base64,${imageBase64}`
    }

    setInput('')
    handleImageRemove()
    await submitMessage(text, imageBase64, mediaType, displayImageUrl)
  }

  async function handleDifficultySelect(unit: string, d: Difficulty) {
    setSelectedUnit(null)
    const prompt = `[${unit}] 단원의 수능 ${d.label}(${d.desc}) 수준 예제 문제를 새로 하나 직접 만들고, 바로 이어서 손풀이 스타일로 풀어줘. 문제를 먼저 제시한 뒤 풀이를 보여줘.`
    await submitMessage(prompt)
  }

  function handleToggleUnitSelector() {
    setShowUnitSelector(prev => !prev)
    setSelectedUnit(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const unitSelectorContent = (
    <div className="unit-selector">
      {selectedUnit === null ? (
        <>
          <p className="unit-selector-label">단원 선택</p>
          <div className="unit-grid">
            {UNITS.map(unit => (
              <button
                key={unit}
                className="unit-btn"
                onClick={() => setSelectedUnit(unit)}
                disabled={isLoading}
              >
                {unit}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="difficulty-header">
            <button
              className="back-btn"
              onClick={() => setSelectedUnit(null)}
            >
              ← 단원
            </button>
            <span className="selected-unit-label">{selectedUnit}</span>
          </div>
          <div className="difficulty-row">
            {DIFFICULTIES.map(d => (
              <button
                key={d.label}
                className={`difficulty-btn score-${d.label[0]}`}
                onClick={() => void handleDifficultySelect(selectedUnit, d)}
                disabled={isLoading}
              >
                <span className="difficulty-score">{d.label}</span>
                <span className="difficulty-desc">{d.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="solver">
      <header className="solver-header">
        <h1>확률과 통계 손풀이</h1>
        <p>문제를 입력하거나 이미지를 올리면 시험장 스타일로 풀어드립니다</p>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p className="empty-title">어떤 문제를 풀어드릴까요?</p>
            <p className="empty-subtitle">
              단원을 선택하거나 문제를 직접 입력하세요
            </p>
            {unitSelectorContent}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === 'user' ? (
              <div className="message-content user-content">
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="첨부 이미지"
                    className="message-image"
                  />
                )}
                {msg.text && <p className="message-text">{msg.text}</p>}
              </div>
            ) : (
              <div className="message-content assistant-content">
                {msg.isLoading ? (
                  <span className="loading-text">풀이 중...</span>
                ) : (
                  <pre className="solution-text">{msg.text}</pre>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {messages.length > 0 && showUnitSelector && (
        <div className="unit-selector-panel">{unitSelectorContent}</div>
      )}

      <div className="input-area">
        {imagePreviewUrl && (
          <div className="image-preview">
            <img src={imagePreviewUrl} alt="업로드 이미지 미리보기" />
            <button
              className="remove-image-btn"
              onClick={handleImageRemove}
              aria-label="이미지 제거"
            >
              ✕
            </button>
          </div>
        )}
        <div className="input-row">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="문제를 입력하세요 (Enter로 전송, Shift+Enter로 줄바꿈)"
            rows={3}
            disabled={isLoading}
          />
          <div className="input-actions">
            <button
              className={`unit-toggle-btn${showUnitSelector ? ' active' : ''}`}
              onClick={handleToggleUnitSelector}
              disabled={isLoading}
              title="단원별 예제"
              aria-label="단원별 예제"
            >
              📚
            </button>
            <button
              className="image-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="이미지 업로드"
              aria-label="이미지 업로드"
            >
              📷
            </button>
            <button
              className="submit-btn"
              onClick={() => void handleSubmit()}
              disabled={isLoading || (!input.trim() && !imageFile)}
            >
              전송
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}
