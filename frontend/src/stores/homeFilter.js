import { defineStore } from 'pinia'

const emptyFilters = () => ({
  minChange: null,
  maxChange: null,
  minChangeAmount: null,
  maxChangeAmount: null,
  minAmountY: null,
  maxAmountY: null,
  minUpRatio: null,
  maxUpRatio: null,
  maxVolatility: null,
  maxDrawdown20d: null
})

const visibleMetricKeys = new Set(['change', 'changeAmount', 'amount', 'upRatio', 'volatility'])

export const useHomeFilterStore = defineStore('homeFilter', {
  state: () => ({
    scope: 'all',
    searchQuery: '',
    selectedMetrics: ['change'],
    appliedSelectStrategyId: null,
    filters: emptyFilters()
  }),

  actions: {
    _normalizeSnapshot(snapshot) {
      if (!snapshot) return snapshot
      const selectedMetrics = Array.isArray(snapshot.selectedMetrics)
        ? snapshot.selectedMetrics
          .map(key => (key === 'netInflow' ? 'changeAmount' : key))
          .filter(key => visibleMetricKeys.has(key))
          .slice(0, 3)
        : []
      const rawFilters = { ...(snapshot.filters || {}) }
      if (rawFilters.minChangeAmount == null && rawFilters.minNetInflowY != null) rawFilters.minChangeAmount = rawFilters.minNetInflowY
      if (rawFilters.maxChangeAmount == null && rawFilters.maxNetInflowY != null) rawFilters.maxChangeAmount = rawFilters.maxNetInflowY
      delete rawFilters.minNetInflowY
      delete rawFilters.maxNetInflowY
      delete rawFilters.minVolRatio
      delete rawFilters.maxVolRatio
      delete rawFilters.minStrength
      delete rawFilters.minSpike5m
      return {
        ...snapshot,
        selectedMetrics,
        filters: rawFilters,
      }
    },

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
      const normalized = this._normalizeSnapshot(snapshot)
      if (!normalized) return
      this.scope = normalized.scope ?? this.scope
      this.searchQuery = normalized.searchQuery ?? ''
      this.selectedMetrics = Array.isArray(normalized.selectedMetrics)
        ? normalized.selectedMetrics.slice(0, 3)
        : []
      this.filters = { ...emptyFilters(), ...(normalized.filters || {}) }
    }
  }
})
