import { defineStore } from 'pinia'
import { useSessionStore } from '@/store/session'
import type { ChatMessage, ApiMessage } from '@/types/chat'

const STORAGE_KEY = 'chat-messages'

export const useMessageStore = defineStore('message-store', {
  state: () => ({
    messagesBySession: {} as Record<string, ChatMessage[]>,
    activeController: null as AbortController | null,
    activeStreamingMessageId: null as string | null,
    isStreaming: false,
  }),

  getters: {
    currentMessages(state): ChatMessage[] {
      const sessionStore = useSessionStore()
      return state.messagesBySession[sessionStore.activeSessionId ?? ''] ?? []
    },

    apiMessages(): ApiMessage[] {
      return this.currentMessages
        .filter(m => m.status === 'completed' || m.status === 'streaming')
        .map(m => ({ role: m.role, content: m.content }))
    },
  },

  actions: {
    loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          this.messagesBySession = JSON.parse(raw)
        }
      } catch {
        this.messagesBySession = {}
      }
    },

    persistToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messagesBySession))
    },

    addUserMessage(sessionId: string, content: string): ChatMessage {
      if (!this.messagesBySession[sessionId]) {
        this.messagesBySession[sessionId] = []
      }
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'user',
        content,
        timestamp: Date.now(),
        status: 'completed',
      }
      this.messagesBySession[sessionId].push(msg)
      this.persistToStorage()
      return msg
    },

    addAssistantMessage(sessionId: string): ChatMessage {
      if (!this.messagesBySession[sessionId]) {
        this.messagesBySession[sessionId] = []
      }
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'streaming',
      }
      this.messagesBySession[sessionId].push(msg)
      this.activeStreamingMessageId = msg.id
      this.isStreaming = true
      this.persistToStorage()
      return msg
    },

    appendToMessage(messageId: string, chunk: string) {
      for (const msgs of Object.values(this.messagesBySession)) {
        const msg = msgs.find(m => m.id === messageId)
        if (msg) {
          msg.content += chunk
          return
        }
      }
    },

    completeMessage(messageId: string) {
      for (const msgs of Object.values(this.messagesBySession)) {
        const msg = msgs.find(m => m.id === messageId)
        if (msg) {
          msg.status = 'completed'
          break
        }
      }
      this.activeStreamingMessageId = null
      this.isStreaming = false
      this.activeController = null
      this.persistToStorage()
    },

    failMessage(messageId: string) {
      for (const msgs of Object.values(this.messagesBySession)) {
        const msg = msgs.find(m => m.id === messageId)
        if (msg) {
          msg.status = 'failed'
          break
        }
      }
      this.activeStreamingMessageId = null
      this.isStreaming = false
      this.activeController = null
      this.persistToStorage()
    },

    removeMessagesBySession(sessionId: string) {
      delete this.messagesBySession[sessionId]
      this.persistToStorage()
    },

    setActiveController(controller: AbortController) {
      this.activeController = controller
    },

    clearActiveController() {
      this.activeController = null
    },

    abortActiveStream() {
      if (this.activeController) {
        this.activeController.abort('用户主动取消')
        this.activeController = null
      }
      if (this.activeStreamingMessageId) {
        this.failMessage(this.activeStreamingMessageId)
      }
      this.isStreaming = false
    },

    recoverIncompleteMessages() {
      for (const msgs of Object.values(this.messagesBySession)) {
        for (const msg of msgs) {
          if (msg.status === 'streaming') {
            msg.status = 'failed'
          }
        }
      }
      this.isStreaming = false
      this.activeStreamingMessageId = null
      this.activeController = null
      this.persistToStorage()
    },
  },
})

