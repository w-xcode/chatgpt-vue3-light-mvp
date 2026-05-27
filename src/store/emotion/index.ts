import { defineStore } from 'pinia'
import { useBusinessStore } from '@/store/business'
import * as TransformUtils from '@/components/MarkdownPreview/transform'
import type { ChatMessage, EmotionReport } from '@/types/chat'

const STORAGE_KEY = 'chat-emotions'

const ANALYSIS_PROMPT = `你是一个情绪分析助手。请分析以下对话内容，返回一个JSON对象，格式如下：
{
  "emotionLabels": ["情绪标签1", "情绪标签2"],
  "score": 7.5,
  "riskLevel": "low",
  "keywords": ["关键词1", "关键词2"],
  "suggestions": ["建议1", "建议2"]
}
规则：
- emotionLabels: 1-5个中文情绪标签（如：开心、焦虑、愤怒、悲伤、平静、兴奋、压力、满足）
- score: 0-10的情绪强度评分，0为最平静，10为最强烈
- riskLevel: "low"（正常）| "medium"（需关注）| "high"（需干预）
- keywords: 1-5个从对话中提取的关键情绪词
- suggestions: 1-3条改善情绪的建议
只返回JSON，不要其他文字。不要用markdown代码块包裹。`

function parseAnalysisJson(raw: string): Partial<EmotionReport> {
  // Try direct parse first
  try {
    return JSON.parse(raw)
  } catch {
    // Try extracting from markdown code fences
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        return JSON.parse(match[1].trim())
      } catch { /* fall through */ }
    }
    // Try finding first { ... }
    const braceMatch = raw.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0])
      } catch { /* fall through */ }
    }
  }
  return {}
}

function validateReport(parsed: Partial<EmotionReport>, messageId: string, sessionId: string): EmotionReport {
  const validRiskLevels = ['low', 'medium', 'high']
  const riskLevel = validRiskLevels.includes(parsed.riskLevel as string) ? parsed.riskLevel! : 'medium'

  return {
    messageId,
    sessionId,
    emotionLabels: Array.isArray(parsed.emotionLabels) ? parsed.emotionLabels.slice(0, 5) : [],
    score: Math.max(0, Math.min(10, Number(parsed.score) || 5)),
    riskLevel,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    timestamp: Date.now(),
  }
}

export const useEmotionStore = defineStore('emotion-store', {
  state: () => ({
    reportsBySession: {} as Record<string, EmotionReport[]>,
  }),

  getters: {
    getReportsBySession(state) {
      return (sessionId: string): EmotionReport[] => {
        return state.reportsBySession[sessionId] ?? []
      }
    },

    getReportByMessage(state) {
      return (messageId: string): EmotionReport | undefined => {
        for (const reports of Object.values(state.reportsBySession)) {
          const found = reports.find(r => r.messageId === messageId)
          if (found) return found
        }
        return undefined
      }
    },

    allReports(state): EmotionReport[] {
      return Object.values(state.reportsBySession).flat()
    },
  },

  actions: {
    loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          this.reportsBySession = JSON.parse(raw)
        }
      } catch {
        this.reportsBySession = {}
      }
    },

    persistToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reportsBySession))
    },

    addReport(report: EmotionReport) {
      if (!this.reportsBySession[report.sessionId]) {
        this.reportsBySession[report.sessionId] = []
      }
      this.reportsBySession[report.sessionId].push(report)
      this.persistToStorage()
    },

    removeReportsBySession(sessionId: string) {
      delete this.reportsBySession[sessionId]
      this.persistToStorage()
    },

    async analyzeEmotion(assistantMessage: ChatMessage, sessionId: string): Promise<void> {
      const businessStore = useBusinessStore()
      const model = businessStore.currentModelItem
      if (!model?.chatFetch || !model?.transformStreamValue) return

      const messages = [
        { role: 'system' as const, content: ANALYSIS_PROMPT },
        { role: 'user' as const, content: assistantMessage.content },
      ]

      const res = await model.chatFetch(messages)
      if (!res.body) return

      const reader = res.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(TransformUtils.splitStream('\n'))
        .getReader()

      let fullContent = ''
      const textDecoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const result = model.transformStreamValue(value, textDecoder)
          if (!result) continue
          if ('done' in result && result.done) break
          if ('content' in result && result.content) {
            fullContent += result.content
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (!fullContent.trim()) return

      const parsed = parseAnalysisJson(fullContent)
      const report = validateReport(parsed, assistantMessage.id, sessionId)
      this.addReport(report)
    },
  },
})
