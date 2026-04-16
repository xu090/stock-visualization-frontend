import { defineStore } from 'pinia'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/utils/api'

function normalizeStrategy(item = {}) {
  return {
    id: item.id,
    name: item.name || '未命名策略',
    desc: item.desc || item.description || '',
    isFavorite: !!item.isFavorite,
    isCustom: !!item.isCustom,
    enabled: item.enabled !== false,
    snapshot: item.snapshot || {}
  }
}

export const useStrategyStore = defineStore('strategy', {
  state: () => ({
    selectStrategies: [],
    loaded: false,
    loading: false,
    error: ''
  }),

  actions: {
    upsertStrategy(item) {
      const next = normalizeStrategy(item)
      const idx = this.selectStrategies.findIndex(s => Number(s.id) === Number(next.id))
      if (idx >= 0) this.selectStrategies[idx] = { ...this.selectStrategies[idx], ...next }
      else this.selectStrategies.unshift(next)
      return next
    },

    async fetchSelectStrategies() {
      this.loading = true
      this.error = ''
      try {
        const rows = await apiGet('/api/select-strategies')
        this.selectStrategies = (rows || []).map(normalizeStrategy)
        this.loaded = true
        return this.selectStrategies
      } catch (err) {
        this.error = err?.message || String(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async ensureLoaded() {
      if (this.loaded && this.selectStrategies.length) return this.selectStrategies
      return this.fetchSelectStrategies()
    },

    async addSelectStrategyFromSnapshot({ name, desc, snapshot, isFavorite = false, isCustom = true } = {}) {
      const row = await apiPost('/api/select-strategies', {
        name: name?.trim() || '未命名策略',
        desc: desc?.trim() || '保存了一组筛选与排序条件',
        snapshot: snapshot || {},
        isFavorite: !!isFavorite,
        isCustom: !!isCustom,
        enabled: true
      })
      return this.upsertStrategy(row)
    },

    async updateStrategy(_type, id, patch) {
      const row = await apiPatch(`/api/select-strategies/${id}`, patch || {})
      return this.upsertStrategy(row)
    },

    async removeStrategy(_type, id) {
      await apiDelete(`/api/select-strategies/${id}`)
      this.selectStrategies = this.selectStrategies.filter(s => Number(s.id) !== Number(id))
    },

    async toggleFavorite(_type, id) {
      const target = this.selectStrategies.find(s => Number(s.id) === Number(id))
      if (!target) return
      target.isFavorite = !target.isFavorite
      try {
        const row = await apiPatch(`/api/select-strategies/${id}`, { isFavorite: target.isFavorite })
        this.upsertStrategy(row)
      } catch (err) {
        target.isFavorite = !target.isFavorite
        throw err
      }
    }
  }
})
