import { defineStore } from 'pinia'
import { apiGet, apiPatch, apiPost } from '@/utils/api'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: loadUser(),
    loading: false
  }),

  getters: {
    isLoggedIn: state => !!state.token && !!state.user
  },

  actions: {
    async hydrate() {
      if (!this.token) return null
      try {
        const row = await apiGet('/api/auth/me')
        this.user = row?.user || null
        if (!this.user) this.logoutLocal()
        else saveSession(this.token, this.user)
        return this.user
      } catch {
        this.logoutLocal()
        return null
      }
    },

    async login(username, password) {
      this.loading = true
      try {
        const row = await apiPost('/api/auth/login', { username, password })
        this.token = row.token
        this.user = row.user
        saveSession(this.token, this.user)
        return this.user
      } finally {
        this.loading = false
      }
    },

    async register(username, password) {
      this.loading = true
      try {
        const row = await apiPost('/api/auth/register', { username, password })
        this.token = row.token
        this.user = row.user
        saveSession(this.token, this.user)
        return this.user
      } finally {
        this.loading = false
      }
    },

    async updateAccount(payload = {}) {
      this.loading = true
      try {
        const row = await apiPatch('/api/auth/me', payload)
        this.user = row.user
        saveSession(this.token, this.user)
        return this.user
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        if (this.token) await apiPost('/api/auth/logout', {})
      } catch {
        // Local logout should still complete if the server token is already gone.
      }
      this.logoutLocal()
    },

    logoutLocal() {
      this.token = ''
      this.user = null
      clearSession()
    }
  }
})
