import { defineStore } from 'pinia'
import { apiGet } from '@/utils/api'

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
    code: normalizeCode(item.code),
    name: item.name || normalizeCode(item.code),
    marketCode: item.marketCode || item.market_code || '',
    price: asNum(item.price ?? item.close, null),
    preClose: asNum(item.preClose, null),
    open: asNum(item.open, null),
    close: asNum(item.close ?? item.price, null),
    high: asNum(item.high, null),
    low: asNum(item.low, null),
    change: asNum(item.change ?? item.changePercent, null),
    changePercent: asNum(item.changePercent ?? item.change, null),
    changeAmount: asNum(item.changeAmount, null),
    amount: asNum(item.amount, null),
    vol: asNum(item.vol ?? item.volume, null),
    volume: asNum(item.volume, null),
    turnover: asNum(item.turnover, null),
    amplitude: asNum(item.amplitude, null),
    volumeRatio: asNum(item.volumeRatio, null),
    netInflow: asNum(item.netInflow, null),
    mainInflow: asNum(item.mainInflow, null),
    mktCap: asNum(item.mktCap, null),
    pe: asNum(item.pe, null),
    pb: asNum(item.pb, null),
    orderImbalance: asNum(item.orderImbalance, null),
    ts: item.ts || null,
    industry: item.industry || '',
    concept: item.concept || null,
    limitUp: Boolean(item.limitUp ?? (Number(item.change ?? item.changePercent) >= 9.8)),
    limitDown: Boolean(item.limitDown ?? (Number(item.change ?? item.changePercent) <= -9.8)),
  }
}

function normalizeCapitalFlow(item = {}) {
  return {
    code: normalizeCode(item.code),
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

export const useStockDetailStore = defineStore('stockDetail', {
  state: () => ({
    detailByCode: {},
    capitalFlowByKey: {},
    klineByKey: {},
    loadingByCode: {},
    errorByCode: {},
  }),

  actions: {
    _detailKey(code, conceptId = '', sector = '') {
      return `${normalizeCode(code)}:${conceptId || ''}:${sector || ''}`
    },

    _klineKey(code, period = '1m') {
      return `${normalizeCode(code)}:${period}`
    },

    _setLoading(code, value) {
      this.loadingByCode = { ...this.loadingByCode, [normalizeCode(code)]: !!value }
    },

    _setError(code, value) {
      this.errorByCode = { ...this.errorByCode, [normalizeCode(code)]: value || '' }
    },

    async fetchDetail(code, { conceptId = '', sector = '' } = {}) {
      const normalizedCode = normalizeCode(code)
      if (!normalizedCode) return null
      const params = new URLSearchParams()
      if (conceptId) params.set('concept_id', conceptId)
      if (sector) params.set('sector', sector)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const row = await apiGet(`/api/stocks/${encodeURIComponent(normalizedCode)}/market-detail${suffix}`)
      const normalized = normalizeDetail(row)
      this.detailByCode = { ...this.detailByCode, [normalizedCode]: normalized }
      return normalized
    },

    async fetchCapitalFlow(code, { conceptId = '', sector = '' } = {}) {
      const normalizedCode = normalizeCode(code)
      if (!normalizedCode) return null
      const key = this._detailKey(normalizedCode, conceptId, sector)
      const params = new URLSearchParams()
      if (conceptId) params.set('concept_id', conceptId)
      if (sector) params.set('sector', sector)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const row = await apiGet(`/api/stocks/${encodeURIComponent(normalizedCode)}/capital-flow-history${suffix}`)
      const normalized = normalizeCapitalFlow(row)
      this.capitalFlowByKey = { ...this.capitalFlowByKey, [key]: normalized }
      return normalized
    },

    async fetchKline(code, period = '1m') {
      const normalizedCode = normalizeCode(code)
      if (!normalizedCode) return null
      const key = this._klineKey(normalizedCode, period)
      const row = await apiGet(`/api/stocks/${encodeURIComponent(normalizedCode)}/kline?period=${encodeURIComponent(period)}`)
      const normalized = normalizeKline(row)
      this.klineByKey = { ...this.klineByKey, [key]: normalized }
      return normalized
    },

    async fetchAllForStockView(code, { conceptId = '', sector = '', period = '1m' } = {}) {
      const normalizedCode = normalizeCode(code)
      if (!normalizedCode) return null
      this._setLoading(normalizedCode, true)
      this._setError(normalizedCode, '')
      try {
        const [detail, capitalFlow, kline] = await Promise.all([
          this.fetchDetail(normalizedCode, { conceptId, sector }),
          this.fetchCapitalFlow(normalizedCode, { conceptId, sector }),
          this.fetchKline(normalizedCode, period),
        ])
        return { detail, capitalFlow, kline }
      } catch (err) {
        this._setError(normalizedCode, err?.message || String(err))
        throw err
      } finally {
        this._setLoading(normalizedCode, false)
      }
    },
  },
})
