import { useState, useRef, useEffect } from 'react'
import { solve } from '../api/solve'

type AppView = 'home' | 'chat'
type ChatMode = 'unit' | 'direct'

interface Message {
  role: 'user' | 'assistant'
  text: string
  imageUrl?: string
  isLoading?: boolean
  isProblem?: boolean
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
  const [view, setView] = useState<AppView>('home')
  const [chatMode, setChatMode] = useState<ChatMode>('direct')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [showUnitSelector, setShowUnitSelector] = useState(false)
  const [pendingProblem, setPendingProblem] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function goHome() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setView('home')
    setMessages([])
    setPendingProblem(null)
    setSelectedUnit(null)
    setShowUnitSelector(false)
    setInput('')
    setImageFile(null)
    setImagePreviewUrl(null)
  }

  function startMode(mode: ChatMode) {
    setChatMode(mode)
    setView('chat')
  }

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
    apiText: string,
    imageBase64?: string,
    mediaType?: string,
    displayImageUrl?: string,
    displayText?: string,
  ) {
    if (!apiText && !imageBase64) return
    if (isLoading) return

    const userMessage: Message = {
      role: 'user',
      text: displayText ?? apiText,
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
      const answer = await solve({ text: apiText, imageBase64, mediaType })
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
    if (isLoading) return

    if (pendingProblem !== null) {
      const userAnswer = input.trim()
      const displayText = userAnswer || '풀이 보기'
      const apiText = userAnswer
        ? `[문제]\n${pendingProblem}\n\n[학생 답]\n${userAnswer}\n\n위 문제의 손풀이 풀이를 보여줘. 학생 답이 맞는지 첫 줄에 ✓ 또는 ✗로 표시하고, 틀렸으면 어느 부분이 다른지 짚어줘.`
        : `[문제]\n${pendingProblem}\n\n위 문제의 손풀이 풀이를 보여줘.`

      setPendingProblem(null)
      setInput('')
      await submitMessage(apiText, undefined, undefined, undefined, displayText)
      return
    }

    const text = input.trim()
    if (!text && !imageFile) return

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

  async function handleShowSolution() {
    if (!pendingProblem || isLoading) return
    const problem = pendingProblem
    setPendingProblem(null)
    setInput('')
    await submitMessage(
      `[문제]\n${problem}\n\n위 문제의 손풀이 풀이를 보여줘.`,
      undefined, undefined, undefined,
      '풀이 보기',
    )
  }

  async function handleDifficultySelect(unit: string, d: Difficulty) {
    setSelectedUnit(null)
    setShowUnitSelector(false)
    setPendingProblem(null)

    const requestLabel = `📚 ${unit} · ${d.label} 예제`
    const generationPrompt =
      `[지시] 아래 조건의 수능 확률과 통계 예제 문제를 하나 만들어줘.\n` +
      `단원: ${unit}\n` +
      `난이도: ${d.label}(${d.desc})\n\n` +
      `[출력 규칙 - 반드시 지킬 것]\n` +
      `- 문제 텍스트만 출력해.\n` +
      `- 풀이, 정답, 풀이 전략, 연습문제는 절대 출력하지 마.\n` +
      `- 문제 번호나 "문제:" 같은 접두어 없이 바로 문제 내용만.`

    setMessages(prev => [
      ...prev,
      { role: 'user', text: requestLabel },
      { role: 'assistant', text: '', isLoading: true, isProblem: true },
    ])
    setIsLoading(true)

    try {
      const problemText = await solve({ text: generationPrompt })
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          text: problemText,
          isProblem: true,
        }
        return updated
      })
      setPendingProblem(problemText)
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : '문제 생성 중 오류가 발생했습니다.'
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

  function handleToggleUnitSelector() {
    setShowUnitSelector(prev => !prev)
    setSelectedUnit(null)
  }

  function handleCancelProblem() {
    setPendingProblem(null)
    setInput('')
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
            <button className="back-btn" onClick={() => setSelectedUnit(null)}>
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

  const isAnswerMode = pendingProblem !== null

  // ── Home screen ──────────────────────────────────────────
  if (view === 'home') {
    return (
      <div className="solver">
        <header className="solver-header">
          <h1>확률과 통계 손풀이</h1>
          <p>시작할 방식을 선택하세요</p>
        </header>
        <div className="home-screen">
          <button
            className="mode-card"
            onClick={() => startMode('unit')}
          >
            <span className="mode-icon">📚</span>
            <span className="mode-title">단원별 예제 풀기</span>
            <span className="mode-desc">
              단원과 난이도를 선택하면<br />
              예제 문제를 출제해드려요
            </span>
          </button>
          <button
            className="mode-card"
            onClick={() => startMode('direct')}
          >
            <span className="mode-icon">✏️</span>
            <span className="mode-title">직접 입력</span>
            <span className="mode-desc">
              문제를 직접 타이핑하거나<br />
              이미지를 올려주세요
            </span>
          </button>
        </div>
      </div>
    )
  }

  // ── Chat screen ───────────────────────────────────────────
  return (
    <div className="solver">
      <header className="solver-header">
        <button className="home-btn" onClick={goHome}>← 처음으로</button>
        <h1>확률과 통계 손풀이</h1>
        <p>
          {chatMode === 'unit'
            ? '단원별 예제 풀기'
            : '문제를 입력하거나 이미지를 올려주세요'}
        </p>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            {chatMode === 'unit' ? (
              <>
                <p className="empty-title">단원과 난이도를 선택하세요</p>
                {unitSelectorContent}
              </>
            ) : (
              <>
                <p className="empty-title">어떤 문제를 풀어드릴까요?</p>
                <p className="empty-subtitle">
                  문제를 직접 입력하거나 이미지를 올려주세요
                </p>
              </>
            )}
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
            ) : msg.isProblem ? (
              <div className="message-content problem-content">
                {msg.isLoading ? (
                  <span className="loading-text">문제 생성 중...</span>
                ) : (
                  <>
                    <span className="problem-badge">📝 문제</span>
                    <p className="problem-text">{msg.text}</p>
                  </>
                )}
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
        {isAnswerMode && (
          <div className="pending-hint">
            <span>✏️ 답을 입력하고 전송하세요</span>
            <button
              className="cancel-problem-btn"
              onClick={handleCancelProblem}
              aria-label="문제 취소"
            >
              취소
            </button>
          </div>
        )}
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
            placeholder={
              isAnswerMode
                ? '내 답 또는 풀이를 입력하세요...'
                : '문제를 입력하세요 (Enter로 전송, Shift+Enter로 줄바꿈)'
            }
            rows={3}
            disabled={isLoading}
          />
          <div className="input-actions">
            {isAnswerMode ? (
              <button
                className="show-solution-btn"
                onClick={() => void handleShowSolution()}
                disabled={isLoading}
                title="풀이 바로 보기"
              >
                풀이<br />보기
              </button>
            ) : (
              <>
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
              </>
            )}
            <button
              className="submit-btn"
              onClick={() => void handleSubmit()}
              disabled={
                isLoading || (!isAnswerMode && !input.trim() && !imageFile)
              }
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
