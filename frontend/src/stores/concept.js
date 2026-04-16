import { defineStore } from 'pinia'
import { useAlertCenterStore } from '@/stores/alertCenter'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/utils/api'

function normId(id) {
  return String(id ?? '').trim()
}

function normalizeConcept(item = {}) {
  const stockCodes = Array.isArray(item.stockCodes)
    ? item.stockCodes.map(code => String(code).trim()).filter(Boolean)
    : []
  return {
    id: normId(item.id),
    name: item.name || item.id || '',
    description: item.description || '',
    stockCodes,
    algorithm: item.algorithm || '',
    editable: !!item.editable,
    favorite: !!item.favorite,
    source: item.source || '',
    change: Number(item.change || 0),
    change1m: Number(item.change1m || 0),
    change5m: Number(item.change5m || item.spike5m || 0),
    change20d: Number(item.change20d || 0),
    drawdown20d: Number(item.drawdown20d || 0),
    netInflow: Number(item.netInflow || 0),
    mainInflow: Number(item.mainInflow || 0),
    amount: Number(item.amount || 0),
    turnover: Number(item.turnover || 0),
    volRatio: Number(item.volRatio || item.volumeRatio || 0),
    upRatio: Number(item.upRatio || 0),
    limitUp: Number(item.limitUp || 0),
    limitDown: Number(item.limitDown || 0),
    strength: Number(item.strength || 0),
    spike5m: Number(item.spike5m || 0),
    volatility: Number(item.volatility || 0),
    stockCount: Number(item.stockCount || stockCodes.length || 0),
    activeStockCount: Number(item.activeStockCount || 0),
    latestTs: item.latestTs || null,
    curve: Array.isArray(item.curve) ? item.curve : [],

    rtChange: Number(item.change || 0),
    rtChange1m: Number(item.change1m || 0),
    rtChange5m: Number(item.change5m || item.spike5m || 0),
    rtChange20d: Number(item.change20d || 0),
    rtNetInflow: Number(item.netInflow || 0),
    rtMainInflow: Number(item.mainInflow || 0),
    rtAmount: Number(item.amount || 0),
    rtTurnover: Number(item.turnover || 0),
    rtVolRatio: Number(item.volRatio || item.volumeRatio || 0),
    rtUpRatio: Number(item.upRatio || 0),
    rtLimitUp: Number(item.limitUp || 0),
    rtLimitDown: Number(item.limitDown || 0),
    rtStrength: Number(item.strength || 0),
    rtSpike5m: Number(item.spike5m || 0),
    rtVolatility: Number(item.volatility || 0),
    rtDrawdown20d: Number(item.drawdown20d || 0)
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
      if (idx >= 0) this.conceptList[idx] = { ...this.conceptList[idx], ...next }
      else this.conceptList.push(next)

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

    async ensureLoaded() {
      if (this.loaded && this.conceptList.length) return this.conceptList
      return this.fetchConceptOverview()
    },

    async fetchConceptProfile(id) {
      const row = await apiGet(`/api/concepts/${encodeURIComponent(id)}/profile`)
      return this.upsertConcept(row)
    },

    async fetchConceptMacro(id) {
      const row = await apiGet(`/api/concepts/${encodeURIComponent(id)}/macro`)
      return this.upsertConcept(row)
    },

    async refreshConceptMacros(ids = []) {
      const targets = ids.length ? ids : this.conceptList.map(c => c.id)
      await Promise.allSettled(targets.map(id => this.fetchConceptMacro(id)))
      return this.conceptList
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
