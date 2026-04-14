import { defineStore } from 'pinia'

const emptyFilters = () => ({
  minChange: null,
  minNetInflowY: null,
  minAmountY: null,
  minVolRatio: null,
  minUpRatio: null,
  minStrength: null,
  minSpike5m: null,
  maxVolatility: null,
  maxDrawdown20d: null
})

export const useHomeFilterStore = defineStore('homeFilter', {
  state: () => ({
    scope: 'all',
    searchQuery: '',
    selectedMetrics: ['change'],
    appliedSelectStrategyId: null,
    filters: emptyFilters()
  }),

  actions: {
    reset() {
      this.scope = 'all'
      this.searchQuery = ''
      this.selectedMetrics = ['change']
      this.appliedSelectStrategyId = null
      this.filters = emptyFilters()
    },

    toSnapshot() {
      return {
        scope: this.scope,
        searchQuery: this.searchQuery,
        selectedMetrics: [...(this.selectedMetrics || [])],
        filters: { ...(this.filters || {}) }
      }
    },

    applySnapshot(snapshot) {
      if (!snapshot) return
      this.scope = snapshot.scope ?? this.scope
      this.searchQuery = snapshot.searchQuery ?? ''
      this.selectedMetrics = Array.isArray(snapshot.selectedMetrics)
        ? snapshot.selectedMetrics.slice(0, 3)
        : []
      this.filters = { ...emptyFilters(), ...(snapshot.filters || {}) }
    }
  }
})
