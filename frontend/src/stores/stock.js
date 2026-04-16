import { defineStore } from 'pinia'
import { useAlertCenterStore } from '@/stores/alertCenter'
import { apiGet, apiPost } from '@/utils/api'

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH|BJ)$/i, '')
  s = s.replace(/^(sz|sh|bj)/i, '')
  return s
}

function normalizeQuote(item = {}) {
  const code = normalizeCode(item.code)
  const change = item.change ?? item.changePercent ?? 0
  return {
    ...item,
    code,
    name: item.name || code,
    price: item.price ?? item.close ?? 0,
    close: item.close ?? item.price ?? 0,
    change,
    changePercent: item.changePercent ?? change,
    volume: item.volume ?? item.vol ?? 0,
    ts: item.ts || Date.now()
  }
}

export const useStockStore = defineStore('stock', {
  state: () => {
    // 从 localStorage 加载缓存的股票基础数据
    let cachedStockBaseList = []
    try {
      const cached = localStorage.getItem('stock_base_list')
      if (cached) {
        cachedStockBaseList = JSON.parse(cached)
      }
    } catch (e) {
      console.warn('Failed to load cached stock base list:', e)
    }

    return {
      stockBaseList: cachedStockBaseList,
      quotesByCode: {},
      myStockCodes: ['603501', '688167', '002371'],
      _quoteTimer: null
    }
  },

  getters: {
    baseByCode: (state) => {
      const map = Object.create(null)
      state.stockBaseList.forEach(s => {
        const c = normalizeCode(s.code)
        if (c) map[c] = { ...s, code: c }
      })
      return map
    },

    getBaseByCode() {
      return (code) => this.baseByCode[normalizeCode(code)] || null
    },

    getStockBaseByCode() {
      return (code) => this.baseByCode[normalizeCode(code)] || null
    },

    isStockFavorite() {
      return (code) => this.myStockCodes.includes(normalizeCode(code))
    },

    getStockByCodeEnriched() {
      return (code, conceptName = '') => {
        const c = normalizeCode(code)
        const base = this.baseByCode[c] || { code: c, name: c }
        const quote = this.quotesByCode[c] || {}
        return { ...base, ...quote, code: c, name: quote.name || base.name || c, concept: conceptName || '' }
      }
    },

    getStocksByCodesEnriched() {
      return (codes = [], conceptName = '') => {
        return (codes || [])
          .map(code => this.getStockByCodeEnriched(code, conceptName))
          .filter(item => item?.code)
      }
    },

    myStockListEnriched() {
      return this.myStockCodes
        .map(code => this.getStockByCodeEnriched(code))
        .filter(Boolean)
    }
  },

  actions: {
    upsertBase(item = {}) {
      const code = normalizeCode(item.code)
      if (!code) return
      const next = { code, name: item.name || code, marketCode: item.marketCode || item.market_code || '' }
      const idx = this.stockBaseList.findIndex(s => normalizeCode(s.code) === code)
      if (idx >= 0) this.stockBaseList[idx] = { ...this.stockBaseList[idx], ...next }
      else this.stockBaseList.push(next)

      // 持久化到 localStorage
      try {
        localStorage.setItem('stock_base_list', JSON.stringify(this.stockBaseList))
      } catch (e) {
        console.warn('Failed to save stock base list:', e)
      }
    },

    upsertQuote(item = {}) {
      const quote = normalizeQuote(item)
      if (!quote.code) return
      this.quotesByCode[quote.code] = {
        ...(this.quotesByCode[quote.code] || {}),
        ...quote
      }
      this.upsertBase(quote)
    },

    async fetchQuotes(codes = []) {
      const uniq = Array.from(new Set((codes || []).map(normalizeCode).filter(Boolean)))
      if (!uniq.length) return

      const rows = await apiPost('/api/quotes', { codes: uniq })
      ;(rows || []).forEach(row => this.upsertQuote(row))

      const missing = uniq.filter(code => !this.baseByCode[code] || this.baseByCode[code].name === code)
      if (missing.length) await this.ensureStockProfiles(missing)
    },

    async ensureStockProfiles(codes = []) {
      const uniq = Array.from(new Set((codes || []).map(normalizeCode).filter(Boolean)))
      await Promise.allSettled(
        uniq.map(async code => {
          const row = await apiGet(`/api/stocks/${encodeURIComponent(code)}`)
          this.upsertBase(row)
          this.upsertQuote(row)
        })
      )
    },

    /**
     * 批量加载股票基础数据并缓存
     * 用于初始化时从服务器获取所有股票基础信息
     */
    async loadStockBaseList() {
      try {
        // 如果已有数据且不为空，跳过加载
        if (this.stockBaseList.length > 0) {
          return this.stockBaseList
        }

        const rows = await apiGet('/api/stocks/base')
        if (Array.isArray(rows)) {
          this.stockBaseList = rows
          // 持久化到 localStorage
          try {
            localStorage.setItem('stock_base_list', JSON.stringify(this.stockBaseList))
          } catch (e) {
            console.warn('Failed to save stock base list:', e)
          }
        }
        return this.stockBaseList
      } catch (error) {
        console.warn('Failed to load stock base list:', error)
        return this.stockBaseList
      }
    },

    async searchStocks(q, limit = 20) {
      const keyword = String(q || '').trim()
      if (!keyword) return []
      const rows = await apiGet(`/api/stocks/search?q=${encodeURIComponent(keyword)}&limit=${limit}`)
      ;(rows || []).forEach(row => {
        this.upsertBase(row)
        this.upsertQuote(row)
      })
      return rows || []
    },

    startQuotePolling(codes = [], intervalMs = 3000) {
      this.stopQuotePolling()
      const uniq = Array.from(new Set((codes || []).map(normalizeCode).filter(Boolean)))
      if (!uniq.length) return
      this.fetchQuotes(uniq).catch(() => null)
      this._quoteTimer = setInterval(() => {
        this.fetchQuotes(uniq).catch(() => null)
      }, intervalMs)
    },

    stopQuotePolling() {
      if (this._quoteTimer) {
        clearInterval(this._quoteTimer)
        this._quoteTimer = null
      }
    },

    addStockToMyStocks(code) {
      const c = normalizeCode(code)
      if (!c || this.myStockCodes.includes(c)) return
      this.myStockCodes.push(c)
      const alertCenter = useAlertCenterStore()
      alertCenter.captureStockBaseline(c)
    },

    removeStockFromMyStocks(code) {
      const c = normalizeCode(code)
      if (!c) return
      this.myStockCodes = this.myStockCodes.filter(x => x !== c)
      const alertCenter = useAlertCenterStore()
      alertCenter.clearTargetState('stock', c)
    }
  }
})
