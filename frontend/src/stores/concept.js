import { defineStore } from 'pinia'
import { useAlertCenterStore } from '@/stores/alertCenter'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/utils/api'

function normId(id) {
  return String(id ?? '').trim()
}

function toNullableNumber(value) {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function keepStableRealtimeMetric(current, next) {
  const currentTs = Number(current?.latestTs)
  const nextTs = Number(next?.latestTs)
  const sameSnapshot = Number.isFinite(currentTs) && Number.isFinite(nextTs) && currentTs > 0 && currentTs === nextTs
  if (!sameSnapshot) return next

  const currentHasMove = Number(current?.change) !== 0 || Number(current?.changeAmount) !== 0
  const nextLooksReset = Number(next?.change) === 0 && Number(next?.changeAmount) === 0
  if (!currentHasMove || !nextLooksReset) return next

  return {
    ...next,
    change: current?.change ?? next.change,
    changeAmount: current?.changeAmount ?? next.changeAmount,
    rtChange: current?.rtChange ?? next.rtChange,
    rtChangeAmount: current?.rtChangeAmount ?? next.rtChangeAmount,
  }
}

function normalizeConcept(item = {}) {
  const stockCodes = Array.isArray(item.stockCodes)
    ? item.stockCodes.map(code => String(code).trim()).filter(Boolean)
    : []
  const change = item.changeRate ?? item.change
  const changeAmount = item.changeAmount ?? item.changeValue ?? item.change_amount
  return {
    id: normId(item.id),
    name: item.name || item.id || '',
    description: item.description || '',
    stockCodes,
    algorithm: item.algorithm || '',
    editable: !!item.editable,
    favorite: !!item.favorite,
    source: item.source || '',
    change: toNullableNumber(change),
    changeAmount: toNullableNumber(changeAmount),
    change1m: toNullableNumber(item.change1m),
    change5m: toNullableNumber(item.change5m),
    change20d: toNullableNumber(item.change20d),
    drawdown20d: toNullableNumber(item.drawdown20d),
    netInflow: toNullableNumber(item.netInflow),
    mainInflow: toNullableNumber(item.mainInflow),
    amount: toNullableNumber(item.amount),
    turnover: toNullableNumber(item.turnover),
    volRatio: toNullableNumber(item.volRatio ?? item.volumeRatio),
    upRatio: toNullableNumber(item.upRatio),
    limitUp: toNullableNumber(item.limitUp),
    limitDown: toNullableNumber(item.limitDown),
    strength: null,
    spike5m: null,
    volatility: toNullableNumber(item.volatility),
    stockCount: Number(item.stockCount || stockCodes.length || 0),
    activeStockCount: Number(item.activeStockCount || 0),
    open: item.open == null ? null : Number(item.open),
    close: item.close == null ? null : Number(item.close),
    high: item.high == null ? null : Number(item.high),
    low: item.low == null ? null : Number(item.low),
    preClose: item.preClose == null ? null : Number(item.preClose),
    volume: item.volume == null ? null : Number(item.volume),
    latestTs: item.latestTs || null,
    updatedAt: item.updatedAt || null,
    curve: Array.isArray(item.curve) ? item.curve : [],

    rtChange: toNullableNumber(change),
    rtChangeAmount: toNullableNumber(changeAmount),
    rtChange1m: toNullableNumber(item.change1m),
    rtChange5m: toNullableNumber(item.change5m),
    rtChange20d: toNullableNumber(item.change20d),
    rtNetInflow: toNullableNumber(item.netInflow),
    rtMainInflow: toNullableNumber(item.mainInflow),
    rtAmount: toNullableNumber(item.amount),
    rtTurnover: toNullableNumber(item.turnover),
    rtVolRatio: toNullableNumber(item.volRatio ?? item.volumeRatio),
    rtUpRatio: toNullableNumber(item.upRatio),
    rtLimitUp: toNullableNumber(item.limitUp),
    rtLimitDown: toNullableNumber(item.limitDown),
    rtStrength: null,
    rtSpike5m: null,
    rtVolatility: toNullableNumber(item.volatility),
    rtDrawdown20d: toNullableNumber(item.drawdown20d),
    rtOpen: item.open == null ? null : Number(item.open),
    rtClose: item.close == null ? null : Number(item.close),
    rtHigh: item.high == null ? null : Number(item.high),
    rtLow: item.low == null ? null : Number(item.low),
    rtPreClose: item.preClose == null ? null : Number(item.preClose),
    rtVolume: item.volume == null ? null : Number(item.volume),
  }
}

export const useConceptStore = defineStore('concept', {
  state: () => {
    // 从 localStorage 加载缓存的概念数据
    let cachedConceptList = []
    let cachedLoaded = false
    try {
      const cached = localStorage.getItem('concept_list')
      if (cached) {
        cachedConceptList = JSON.parse(cached)
        cachedLoaded = cachedConceptList.length > 0
      }
    } catch (e) {
      console.warn('Failed to load cached concept list:', e)
    }

    return {
      conceptList: cachedConceptList,
      loaded: cachedLoaded,
      loading: false,
      error: ''
    }
  },

  getters: {
    getConceptById: (state) => (id) => {
      const sid = normId(id)
      if (!sid) return null
      return (state.conceptList || []).find(c => normId(c.id) === sid) || null
    },

    getMyConceptById() {
      return (id) => {
        const c = this.getConceptById(id)
        return c?.favorite ? c : null
      }
    },

    isConceptFavorite() {
      return (id) => !!this.getConceptById(id)?.favorite
    },

    myConceptList() {
      return (this.conceptList || []).filter(c => !!c.favorite)
    },

    userConcepts() {
      return (this.conceptList || []).filter(c => !!c.editable)
    },

    systemConcepts() {
      return (this.conceptList || []).filter(c => !c.editable)
    },

    conceptOverviewList() {
      return this.systemConcepts || []
    },

    conceptOverviewAll() {
      return this.conceptList || []
    }
  },

  actions: {
    upsertConcept(item) {
      const next = normalizeConcept(item)
      if (!next.id) return null
      const idx = this.conceptList.findIndex(c => normId(c.id) === next.id)
      if (idx >= 0) {
        const current = this.conceptList[idx]
        const merged = keepStableRealtimeMetric(current, { ...current, ...next })
        if (next.change == null) merged.change = current?.change ?? null
        if (next.changeAmount == null) merged.changeAmount = current?.changeAmount ?? null
        if (next.rtChange == null) merged.rtChange = current?.rtChange ?? null
        if (next.rtChangeAmount == null) merged.rtChangeAmount = current?.rtChangeAmount ?? null
        this.conceptList[idx] = merged
      } else {
        this.conceptList.push(next)
      }

      // 持久化到 localStorage
      try {
        localStorage.setItem('concept_list', JSON.stringify(this.conceptList))
      } catch (e) {
        console.warn('Failed to save concept list:', e)
      }

      return next
    },

    async fetchConceptOverview() {
      if (this.loading) return this.conceptList
      this.loading = true
      this.error = ''
      try {
        const rows = await apiGet('/api/concepts/overview')
        this.conceptList = (rows || []).map(normalizeConcept)
        this.loaded = true

        // 持久化到 localStorage
        try {
          localStorage.setItem('concept_list', JSON.stringify(this.conceptList))
        } catch (e) {
          console.warn('Failed to save concept list:', e)
        }

        return this.conceptList
      } catch (err) {
        this.error = err?.message || String(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async ensureLoaded(force = false) {
      if (!force && this.loaded && this.conceptList.length) return this.conceptList
      return this.fetchConceptOverview()
    },

    async fetchConceptProfile(id) {
      const row = await apiGet(`/api/concepts/${encodeURIComponent(id)}/profile`)
      return this.upsertConcept(row)
    },

    async fetchConceptMacro(id, limit = 240) {
      return apiGet(`/api/concepts/${encodeURIComponent(id)}/macro?limit=${encodeURIComponent(limit)}`)
    },

    async refreshConceptMacros(ids = [], limit = 240) {
      const targets = ids.length ? ids : this.conceptList.map(c => c.id)
      return Promise.allSettled(targets.map(id => this.fetchConceptMacro(id, limit)))
    },

    syncMarketDetail(detail) {
      const sid = normId(detail?.id)
      if (!sid) return null
      const current = this.getConceptById(sid) || { id: sid }
      return this.upsertConcept({
        ...current,
        id: sid,
        name: detail?.name ?? current.name,
        stockCount: detail?.stockCount ?? current.stockCount,
        amount: detail?.amount ?? current.amount,
        volume: detail?.volume ?? current.volume,
        open: detail?.open ?? current.open,
        close: detail?.close ?? current.close,
        high: detail?.high ?? current.high,
        low: detail?.low ?? current.low,
        preClose: detail?.preClose ?? current.preClose,
        latestTs: detail?.latestTs ?? current.latestTs,
        updatedAt: detail?.updatedAt ?? current.updatedAt,
        change: detail?.changeRate ?? current.change,
        changeAmount: detail?.change ?? current.changeAmount,
      })
    },

    async addConceptToMyConcept(conceptOrId) {
      const id = normId(typeof conceptOrId === 'string' ? conceptOrId : conceptOrId?.id)
      const current = this.getConceptById(id)
      if (!current) return
      this.upsertConcept({ ...current, favorite: true })
      await apiPatch(`/api/concepts/${encodeURIComponent(id)}`, { favorite: true }).catch(() => null)
      const alertCenter = useAlertCenterStore()
      alertCenter.captureConceptBaseline(id)
    },

    async removeConceptFromMyConcept(conceptOrId) {
      const id = normId(typeof conceptOrId === 'string' ? conceptOrId : conceptOrId?.id)
      const current = this.getConceptById(id)
      if (!current) return
      this.upsertConcept({ ...current, favorite: false })
      await apiPatch(`/api/concepts/${encodeURIComponent(id)}`, { favorite: false }).catch(() => null)
      const alertCenter = useAlertCenterStore()
      alertCenter.clearTargetState('concept', id)
    },

    async toggleFavorite(idOrConcept) {
      const id = normId(typeof idOrConcept === 'string' ? idOrConcept : idOrConcept?.id)
      const current = this.getConceptById(id)
      if (!current) return
      if (current.favorite) return this.removeConceptFromMyConcept(id)
      return this.addConceptToMyConcept(id)
    },

    async addUserConcept(concept) {
      if (!concept?.id) return
      const row = await apiPost('/api/concepts', {
        id: normId(concept.id),
        name: concept.name,
        description: concept.description || '',
        stockCodes: Array.isArray(concept.stockCodes) ? concept.stockCodes : [],
        algorithm: concept.algorithm || '',
        favorite: !!concept.favorite
      })
      return this.upsertConcept(row)
    },

    async updateUserConcept(concept) {
      if (!concept?.id) return
      const id = normId(concept.id)
      const row = await apiPatch(`/api/concepts/${encodeURIComponent(id)}`, {
        name: concept.name,
        description: concept.description,
        stockCodes: concept.stockCodes,
        algorithm: concept.algorithm,
        favorite: concept.favorite
      })
      return this.upsertConcept(row)
    },

    async deleteUserConcept(id) {
      const sid = normId(id)
      if (!sid) return
      await apiDelete(`/api/concepts/${encodeURIComponent(sid)}`)
      this.conceptList = (this.conceptList || []).filter(c => normId(c.id) !== sid)
    }
  }
})
