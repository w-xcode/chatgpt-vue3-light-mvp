import { defineStore } from 'pinia'
import { useEmotionStore } from '@/store/emotion'
import type { Session } from '@/types/chat'

const STORAGE_KEY = 'chat-sessions'

export const useSessionStore = defineStore('session-store', {
  state: () => ({
    sessions: [] as Session[],
    activeSessionId: null as string | null,
  }),

  getters: {
    activeSession(state): Session | undefined {
      return state.sessions.find(s => s.id === state.activeSessionId)
    },
    hasSessions(state): boolean {
      return state.sessions.length > 0
    },
  },

  actions: {
    loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          this.sessions = JSON.parse(raw)
        }
      } catch {
        this.sessions = []
      }
    },

    persistToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions))
    },

    createSession(): Session {
      const session: Session = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      this.sessions.unshift(session)
      this.activeSessionId = session.id
      this.persistToStorage()
      return session
    },

    deleteSession(id: string) {
      this.sessions = this.sessions.filter(s => s.id !== id)
      if (this.activeSessionId === id) {
        this.activeSessionId = this.sessions[0]?.id ?? null
      }
      this.persistToStorage()
      useEmotionStore().removeReportsBySession(id)
    },

    renameSession(id: string, title: string) {
      const session = this.sessions.find(s => s.id === id)
      if (session) {
        session.title = title
        this.persistToStorage()
      }
    },

    setActiveSession(id: string) {
      this.activeSessionId = id
    },

    updateSessionTimestamp(id: string) {
      const session = this.sessions.find(s => s.id === id)
      if (session) {
        session.updatedAt = Date.now()
        this.sessions.sort((a, b) => b.updatedAt - a.updatedAt)
        this.persistToStorage()
      }
    },

    generateTitle(sessionId: string, firstMessage: string) {
      const title = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')
      this.renameSession(sessionId, title)
    },
  },
})

