import { defineStore } from 'pinia'
import { apiGet } from '@/utils/api'
import { useConceptStore } from '@/stores/concept'

const DETAIL_TTL_MS = 10 * 60 * 1000
const STATIC_TTL_MS = 30 * 60 * 1000
const ANALYSIS_TTL_MS = 30 * 60 * 1000
const inflight = new Map()

function nowMs() {
  return Date.now()
}

function isFresh(timestamp, ttl) {
  const value = Number(timestamp)
  return Number.isFinite(value) && value > 0 && nowMs() - value < ttl
}

function inflightOnce(key, factory) {
  if (inflight.has(key)) return inflight.get(key)
  const promise = Promise.resolve()
    .then(factory)
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH|BJ)$/i, '')
  s = s.replace(/^(sz|sh|bj)/i, '')
  return s
}

function asNum(value, fallback = null) {
  if (value == null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeDetail(item = {}) {
  return {
    id: String(item.id || ''),
    name: item.name || '',
    stockCount: asNum(item.stockCount, 0),
    upCount: asNum(item.upCount, null),
    downCount: asNum(item.downCount, null),
    avgChange: asNum(item.avgChange, 0),
    leaderStock: item.leaderStock || null,
    open: asNum(item.open, null),
    close: asNum(item.close, null),
    high: asNum(item.high, null),
    low: asNum(item.low, null),
    preClose: asNum(item.preClose, null),
    change: asNum(item.change, null),
    changeRate: asNum(item.changeRate, null),
    volume: asNum(item.volume, null),
    amount: asNum(item.amount, null),
    inflowAmount: asNum(item.inflowAmount, null),
    outflowAmount: asNum(item.outflowAmount, null),
    netInflow: asNum(item.netInflow, null),
    latestTs: item.latestTs || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCapitalFlow(item = {}) {
  return {
    conceptId: String(item.conceptId || ''),
    derived: !!item.derived,
    times: Array.isArray(item.times) ? item.times : [],
    inflow: Array.isArray(item.inflow) ? item.inflow.map(v => asNum(v, null)) : [],
    outflow: Array.isArray(item.outflow) ? item.outflow.map(v => asNum(v, null)) : [],
    netInflow: Array.isArray(item.netInflow) ? item.netInflow.map(v => asNum(v, null)) : [],
  }
}

function normalizeKline(item = {}) {
  return {
    period: item.period || '1m',
    times: Array.isArray(item.times) ? item.times : [],
    data: Array.isArray(item.data) ? item.data : [],
    volumes: Array.isArray(item.volumes) ? item.volumes : [],
    amounts: Array.isArray(item.amounts) ? item.amounts.map(v => asNum(v, null)) : [],
    changePercents: Array.isArray(item.changePercents) ? item.changePercents.map(v => asNum(v, null)) : [],
    amplitudes: Array.isArray(item.amplitudes) ? item.amplitudes.map(v => asNum(v, null)) : [],
    stockCounts: Array.isArray(item.stockCounts) ? item.stockCounts.map(v => asNum(v, null)) : [],
  }
}

function normalizeStocks(rows = []) {
  return (rows || []).map(row => ({
    code: normalizeCode(row.code),
    name: row.name || normalizeCode(row.code),
    price: asNum(row.price ?? row.close, null),
    open: asNum(row.open, null),
    close: asNum(row.close ?? row.price, null),
    high: asNum(row.high, null),
    low: asNum(row.low, null),
    preClose: asNum(row.preClose, null),
    change: asNum(row.change ?? row.changePercent, null),
    changePercent: asNum(row.changePercent ?? row.change, null),
    amount: asNum(row.amount, null),
    turnover: asNum(row.turnover, null),
    netInflow: asNum(row.netInflow, null),
    mainInflow: asNum(row.mainInflow, null),
    mktCap: asNum(row.mktCap, null),
    pe: asNum(row.pe, null),
    pb: asNum(row.pb, null),
    volume: asNum(row.volume, null),
    ts: row.ts || null,
  }))
}

export const useConceptDetailStore = defineStore('conceptDetail', {
  state: () => ({
    detailById: {},
    capitalFlowById: {},
    klineByKey: {},
    stocksById: {},
    analysisByKey: {},
    fetchedAtByKey: {},
    loadingById: {},
    errorById: {},
  }),

  actions: {
    _setLoading(id, value) {
      this.loadingById = { ...this.loadingById, [String(id)]: !!value }
    },

    _setError(id, value) {
      this.errorById = { ...this.errorById, [String(id)]: value || '' }
    },

    _markFetched(key) {
      this.fetchedAtByKey = { ...this.fetchedAtByKey, [key]: nowMs() }
    },

    _isFresh(key, ttl) {
      return isFresh(this.fetchedAtByKey[key], ttl)
    },

    async fetchDetail(id, options = {}) {
      const sid = String(id || '')
      if (!sid) return null
      const key = `detail:${sid}`
      if (!options.force && this.detailById[sid] && this._isFresh(key, DETAIL_TTL_MS)) {
        return this.detailById[sid]
      }
      return inflightOnce(key, async () => {
        const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}/market-detail`)
        const normalized = normalizeDetail(row)
        const conceptStore = useConceptStore()
        conceptStore.syncMarketDetail?.(normalized)
        this.detailById = { ...this.detailById, [sid]: normalized }
        this._markFetched(key)
        return normalized
      })
    },

    async fetchCapitalFlow(id, options = {}) {
      const sid = String(id || '')
      if (!sid) return null
      const key = `capital:${sid}`
      if (!options.force && this.capitalFlowById[sid] && this._isFresh(key, STATIC_TTL_MS)) {
        return this.capitalFlowById[sid]
      }
      return inflightOnce(key, async () => {
        const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}/capital-flow-history`)
        const normalized = normalizeCapitalFlow(row)
        this.capitalFlowById = { ...this.capitalFlowById, [sid]: normalized }
        this._markFetched(key)
        return normalized
      })
    },

    async fetchKline(id, period = '1m', options = {}) {
      const sid = String(id || '')
      if (!sid) return null
      const key = `${sid}:${period}`
      const cacheKey = `kline:${key}`
      if (!options.force && this.klineByKey[key] && this._isFresh(cacheKey, STATIC_TTL_MS)) {
        return this.klineByKey[key]
      }
      return inflightOnce(cacheKey, async () => {
        const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}/kline?period=${encodeURIComponent(period)}`)
        const normalized = normalizeKline(row)
        this.klineByKey = { ...this.klineByKey, [key]: normalized }
        this._markFetched(cacheKey)
        return normalized
      })
    },

    async fetchStocks(id, options = {}) {
      const sid = String(id || '')
      if (!sid) return []
      const key = `stocks:${sid}`
      if (!options.force && this.stocksById[sid] && this._isFresh(key, STATIC_TTL_MS)) {
        return this.stocksById[sid]
      }
      return inflightOnce(key, async () => {
        const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}`)
        const normalized = normalizeStocks(row?.stocks || [])
        this.stocksById = { ...this.stocksById, [sid]: normalized }
        this._markFetched(key)
        return normalized
      })
    },

    async fetchAnalysis(id, window = 30, options = {}) {
      const sid = String(id || '')
      if (!sid) return null
      const normalizedWindow = Math.min(Math.max(Number(window) || 30, 20), 90)
      const key = `${sid}:${normalizedWindow}`
      const cacheKey = `analysis:${key}`
      if (!options.force && this.analysisByKey[key] && this._isFresh(cacheKey, ANALYSIS_TTL_MS)) {
        return this.analysisByKey[key]
      }
      return inflightOnce(cacheKey, async () => {
        const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}/ma-analysis?window=${encodeURIComponent(normalizedWindow)}`)
        this.analysisByKey = { ...this.analysisByKey, [key]: row }
        this._markFetched(cacheKey)
        return row
      })
    },

    async fetchAllForMarketView(id, period = '1m') {
      const sid = String(id || '')
      if (!sid) return null
      this._setLoading(sid, true)
      this._setError(sid, '')
      try {
        const [detail, capitalFlow, kline, stocks] = await Promise.all([
          this.fetchDetail(sid),
          this.fetchCapitalFlow(sid),
          this.fetchKline(sid, period),
          this.fetchStocks(sid),
        ])
        return { detail, capitalFlow, kline, stocks }
      } catch (err) {
        this._setError(sid, err?.message || String(err))
        throw err
      } finally {
        this._setLoading(sid, false)
      }
    },
  },
})
