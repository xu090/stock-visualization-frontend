import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import { useAlertCenterStore } from '@/stores/alertCenter'
import { useAuthStore } from '@/stores/auth'
import { apiDelete, apiGet, apiPost } from '@/utils/api'

const QUOTE_TTL_MS = 30 * 1000
const MY_STOCK_CODES_KEY = 'my_stock_codes'
const DEFAULT_MY_STOCK_CODES = ['603501', '688167', '002371']
const MIN_VALID_STOCK_BASE_SIZE = 5000

function requireLogin() {
  const auth = useAuthStore()
  if (auth.isLoggedIn) return true
  ElMessage.warning('请先登录')
  return false
}

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH|BJ)$/i, '')
  s = s.replace(/^(sz|sh|bj)/i, '')
  return s
}

function normalizeStockName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : ''
  return name.replace(/^(XD|XR|DR)(?=[\u4e00-\u9fa5A-Za-z])/i, '')
}

function normalizeQuote(item = {}) {
  const code = normalizeCode(item.code)
  const change = item.change ?? item.changePercent ?? 0
  const name = normalizeStockName(item.name)
  return {
    ...item,
    code,
    name: name || undefined,
    price: item.price ?? item.close ?? 0,
    close: item.close ?? item.price ?? 0,
    change,
    changePercent: item.changePercent ?? change,
    volume: item.volume ?? item.vol ?? 0,
    ts: item.ts || Date.now(),
    _fetchedAt: Date.now(),
  }
}

function buildBaseMap(list = []) {
  const map = Object.create(null)
  ;(list || []).forEach(item => {
    const code = normalizeCode(item?.code)
    if (!code) return
    map[code] = {
      ...(map[code] || {}),
      ...item,
      code
    }
  })
  return map
}

function pickBaseName(existingName, incomingName, code) {
  const normalizedCode = normalizeCode(code)
  const current = normalizeStockName(existingName)
  const next = normalizeStockName(incomingName)
  if (next && next !== normalizedCode) return next
  if (current && current !== normalizedCode) return current
  return next || current || normalizedCode
}

function buildQuoteMeta(ts) {
  const updatedAt = Number(ts)
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return {
      updatedAt: null,
      quoteAgeMs: Number.POSITIVE_INFINITY,
      isRealtime: false,
      isDelayed: false,
      isStale: true,
    }
  }

  const quoteAgeMs = Math.max(0, Date.now() - updatedAt)
  return {
    updatedAt,
    quoteAgeMs,
    isRealtime: quoteAgeMs <= 10 * 1000,
    isDelayed: quoteAgeMs > 10 * 1000 && quoteAgeMs <= 60 * 1000,
    isStale: quoteAgeMs > 60 * 1000,
  }
}

function loadMyStockCodes() {
  try {
    const cached = localStorage.getItem(MY_STOCK_CODES_KEY)
    if (!cached) return DEFAULT_MY_STOCK_CODES.slice()
    const rows = JSON.parse(cached)
    if (!Array.isArray(rows)) return DEFAULT_MY_STOCK_CODES.slice()
    const codes = Array.from(new Set(rows.map(normalizeCode).filter(Boolean)))
    return codes
  } catch (e) {
    console.warn('Failed to load favorite stock codes:', e)
    return DEFAULT_MY_STOCK_CODES.slice()
  }
}

function saveMyStockCodes(codes = []) {
  try {
    const normalized = Array.from(new Set((codes || []).map(normalizeCode).filter(Boolean)))
    localStorage.setItem(MY_STOCK_CODES_KEY, JSON.stringify(normalized))
  } catch (e) {
    console.warn('Failed to save favorite stock codes:', e)
  }
}

export const useStockStore = defineStore('stock', {
  state: () => {
    // 浠?localStorage 鍔犺浇缂撳瓨鐨勮偂绁ㄥ熀纭€鏁版嵁
    const cachedStockBaseList = []
    try {
      const cached = null
      void cached
    } catch (e) {
      console.warn('Failed to load cached stock base list:', e)
    }

    return {
      stockBaseList: cachedStockBaseList,
      stockBaseMap: buildBaseMap(cachedStockBaseList),
      quotesByCode: {},
      myStockCodes: loadMyStockCodes(),
      myStocksLoaded: false,
      _quoteTimer: null,
      stockBaseLoaded: cachedStockBaseList.length > 0
    }
  },

  getters: {
    baseByCode: (state) => state.stockBaseMap,

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
        return {
          ...base,
          ...quote,
          ...buildQuoteMeta(quote.ts),
          code: c,
          name: quote.name || base.name || c,
          concept: conceptName || '',
        }
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
      const current = this.stockBaseMap[code] || this.stockBaseList.find(s => normalizeCode(s.code) === code) || {}
      const next = {
        code,
        name: pickBaseName(current.name, item.name, code),
        marketCode: item.marketCode || item.market_code || current.marketCode || current.market_code || ''
      }
      const idx = this.stockBaseList.findIndex(s => normalizeCode(s.code) === code)
      if (idx >= 0) this.stockBaseList[idx] = { ...this.stockBaseList[idx], ...next }
      else this.stockBaseList.push(next)
      this.stockBaseMap = {
        ...this.stockBaseMap,
        [code]: {
          ...(this.stockBaseMap[code] || {}),
          ...next
        }
      }
      this.stockBaseLoaded = true

      // 鎸佷箙鍖栧埌 localStorage
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

    async fetchQuotes(codes = [], options = {}) {
      const uniq = Array.from(new Set((codes || []).map(normalizeCode).filter(Boolean)))
      if (!uniq.length) return
      const now = Date.now()
      const targets = options?.force
        ? uniq
        : uniq.filter(code => {
          const cached = this.quotesByCode[code]
          const fetchedAt = Number(cached?._fetchedAt)
          return !cached || !Number.isFinite(fetchedAt) || now - fetchedAt > QUOTE_TTL_MS
        })
      if (!targets.length) return

      const rows = await apiPost('/api/quotes', {
        codes: targets,
        snapshotTs: options?.snapshotTs || null,
      })
      ;(rows || []).forEach(row => this.upsertQuote(row))

      const missing = targets.filter(code => !this.baseByCode[code] || this.baseByCode[code].name === code)
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
     * 鎵归噺鍔犺浇鑲＄エ鍩虹鏁版嵁骞剁紦瀛?
     * 鐢ㄤ簬鍒濆鍖栨椂浠庢湇鍔″櫒鑾峰彇鎵€鏈夎偂绁ㄥ熀纭€淇℃伅
     */
    async loadStockBaseList(force = false) {
      try {
        // 如果已有数据且不为空，跳过加载
        if (!force && this.stockBaseList.length >= MIN_VALID_STOCK_BASE_SIZE) {
          this.stockBaseLoaded = true
          return this.stockBaseList
        }

        const rows = await apiGet('/api/stocks/base')
        if (Array.isArray(rows)) {
          this.stockBaseList = rows
          this.stockBaseMap = buildBaseMap(rows)
          this.stockBaseLoaded = true
          // 鎸佷箙鍖栧埌 localStorage
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

    async fetchFavoriteStocks() {
      const auth = useAuthStore()
      if (!auth.isLoggedIn) {
        this.myStockCodes = DEFAULT_MY_STOCK_CODES.slice()
        this.myStocksLoaded = true
        return this.myStockCodes
      }
      try {
        const rows = await apiGet('/api/favorite-stocks')
        const codes = Array.from(new Set((rows || []).map(row => normalizeCode(row?.code || row)).filter(Boolean)))
        this.myStockCodes = codes
        this.myStocksLoaded = true
        saveMyStockCodes(this.myStockCodes)
        ;(rows || []).forEach(row => {
          if (row && typeof row === 'object') this.upsertBase(row)
        })
        return this.myStockCodes
      } catch (error) {
        console.warn('Failed to load favorite stock codes from database:', error)
        this.myStocksLoaded = true
        return this.myStockCodes
      }
    },

    async hydrateMyStocks(codes = []) {
      const merged = Array.from(new Set([
        ...(this.myStockCodes || []),
        ...(codes || [])
      ].map(normalizeCode).filter(Boolean)))
      this.myStockCodes = merged
      saveMyStockCodes(this.myStockCodes)
      const auth = useAuthStore()
      if (auth.isLoggedIn) {
        await Promise.all(
          merged.map(code => apiPost('/api/favorite-stocks', { code }).catch(() => null))
        )
      }
      return this.myStockCodes
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

    async addStockToMyStocks(code) {
      if (!requireLogin()) return false
      const c = normalizeCode(code)
      if (!c || this.myStockCodes.includes(c)) return
      this.myStockCodes.push(c)
      saveMyStockCodes(this.myStockCodes)
      const alertCenter = useAlertCenterStore()
      alertCenter.captureStockBaseline(c)
      try {
        const row = await apiPost('/api/favorite-stocks', { code: c })
        if (row) this.upsertBase(row)
      } catch (error) {
        this.myStockCodes = this.myStockCodes.filter(x => x !== c)
        saveMyStockCodes(this.myStockCodes)
        alertCenter.clearTargetState('stock', c)
        console.warn('Failed to add favorite stock:', error)
      }
    },

    async removeStockFromMyStocks(code) {
      if (!requireLogin()) return false
      const c = normalizeCode(code)
      if (!c) return
      const previous = this.myStockCodes.slice()
      this.myStockCodes = this.myStockCodes.filter(x => x !== c)
      saveMyStockCodes(this.myStockCodes)
      const alertCenter = useAlertCenterStore()
      alertCenter.clearTargetState('stock', c)
      try {
        await apiDelete(`/api/favorite-stocks/${encodeURIComponent(c)}`)
      } catch (error) {
        this.myStockCodes = previous
        saveMyStockCodes(this.myStockCodes)
        alertCenter.captureStockBaseline(c)
        console.warn('Failed to remove favorite stock:', error)
      }
    }
  }
})
