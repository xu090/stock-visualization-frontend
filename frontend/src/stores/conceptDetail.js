import { defineStore } from 'pinia'
import { apiGet } from '@/utils/api'
import { useConceptStore } from '@/stores/concept'

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH|BJ)$/i, '')
  s = s.replace(/^(sz|sh|bj)/i, '')
  return s
}

function asNum(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeDetail(item = {}) {
  return {
    id: String(item.id || ''),
    name: item.name || '',
    stockCount: asNum(item.stockCount, 0),
    upCount: asNum(item.upCount, 0),
    downCount: asNum(item.downCount, 0),
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

    async fetchDetail(id) {
      const sid = String(id || '')
      if (!sid) return null
      const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}/market-detail`)
      const normalized = normalizeDetail(row)
      const conceptStore = useConceptStore()
      conceptStore.syncMarketDetail?.(normalized)
      this.detailById = { ...this.detailById, [sid]: normalized }
      return normalized
    },

    async fetchCapitalFlow(id) {
      const sid = String(id || '')
      if (!sid) return null
      const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}/capital-flow-history`)
      const normalized = normalizeCapitalFlow(row)
      this.capitalFlowById = { ...this.capitalFlowById, [sid]: normalized }
      return normalized
    },

    async fetchKline(id, period = '1m') {
      const sid = String(id || '')
      if (!sid) return null
      const key = `${sid}:${period}`
      const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}/kline?period=${encodeURIComponent(period)}`)
      const normalized = normalizeKline(row)
      this.klineByKey = { ...this.klineByKey, [key]: normalized }
      return normalized
    },

    async fetchStocks(id) {
      const sid = String(id || '')
      if (!sid) return []
      const row = await apiGet(`/api/concepts/${encodeURIComponent(sid)}`)
      const normalized = normalizeStocks(row?.stocks || [])
      this.stocksById = { ...this.stocksById, [sid]: normalized }
      return normalized
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
