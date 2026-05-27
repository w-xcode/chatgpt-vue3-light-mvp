export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  status: 'streaming' | 'completed' | 'failed'
}

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface EmotionReport {
  messageId: string
  sessionId: string
  emotionLabels: string[]
  score: number
  riskLevel: string
  keywords: string[]
  suggestions: string[]
  timestamp: number
}
