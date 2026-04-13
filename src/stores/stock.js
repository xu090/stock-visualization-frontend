// src/stores/stock.js
/* global globalThis */
import { defineStore } from 'pinia'
import { useAlertCenterStore } from '@/stores/alertCenter'

const httpClient = globalThis.axios

/* =========================
   Utils（稳定 + 时变tick）
========================= */
function hashNum(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}
function round(n, d = 2) {
  const num = Number(n)
  if (Number.isNaN(num)) return 0
  const p = Math.pow(10, d)
  return Math.round(num * p) / p
}
function pickByHash(arr, h) {
  if (!arr?.length) return null
  return arr[h % arr.length]
}

/** ✅ 统一 code：兼容 000001.SZ / sz000001 / SH600519 */
function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH)$/i, '')
  s = s.replace(/^(sz|sh)/i, '')
  return s
}

/** ✅ mock：生成稳定“基线行情”（每只股票不同，同 code 稳定） */
function mockBaseQuote(code) {
  const h = hashNum(code || 'x')

  const basePrice = round(8 + (h % 1800) / 50, 2) // 8 ~ 44
  const changePercent = round(((h % 1600) / 100) - 8, 2) // -8% ~ +8%

  const preClose = basePrice
  const open = round(preClose * (1 + ((h % 300) - 150) / 10000), 2) // ±1.5%
  const close = round(preClose * (1 + changePercent / 100), 2)

  const hiBase = Math.max(open, close)
  const loBase = Math.min(open, close)
  const high = round(hiBase * (1 + ((h % 260) / 10000)), 2)
  const low = round(loBase * (1 - (((h >> 3) % 220) / 10000)), 2)

  const amplitude = round(((high - low) / preClose) * 100, 2)
  const turnover = round(((h % 180) / 10) + 0.8, 1) // 0.8% ~ 18.8%

  const volume = Math.floor(((h % 9000) + 800) * 1000)
  const amount = Math.floor((volume * ((open + close) / 2)) * 10)

  const netInflow = ((h % 6000) - 2500) * 10_000
  const mainInflow = ((h % 4500) - 1800) * 10_000

  const pe = round(((h % 800) / 10) + 6, 1)
  const pb = round(((h % 200) / 100) + 0.8, 2)
  const mktCap = Math.floor(((h % 3800) + 200) * 10_000_000)

  const score = clamp(Math.floor((h % 100)), 0, 100)
  const limitUp = changePercent >= 7.8
  const limitDown = changePercent <= -7.8

  const industries = ['电子', '计算机', '新能源', '医药生物', '通信', '金融', '消费', '机械', '化工', '汽车']
  const industry = pickByHash(industries, h)

  const volumeRatio = round(((h % 270) / 100) + 0.3, 2) // 0.3 ~ 3.0
  const orderImbalance = clamp((h % 201) - 100, -100, 100) // -100 ~ 100

  return {
    code,
    ts: Date.now(),

    price: close,
    preClose,
    open,
    close,
    high,
    low,

    changePercent,
    changeAmount: round(preClose * (changePercent / 100), 2),
    change: changePercent, // 兼容表格

    change5d: round((((h >> 1) % 2000) / 100) - 10, 2),
    change20d: round((((h >> 2) % 3000) / 100) - 15, 2),

    volume,
    amount,
    turnover,
    amplitude,

    netInflow,
    mainInflow,

    pe,
    pb,
    mktCap,
    score,

    limitUp,
    limitDown,

    volumeRatio,
    orderImbalance,

    industry
  }
}

/** ✅ mock：时变tick（小幅波动） */
function tickQuote(prevQuote) {
  if (!prevQuote?.code) return prevQuote
  const h = hashNum(prevQuote.code)
  const t = Date.now()

  const step = ((h % 7) + 2) / 1000 // 0.002 ~ 0.008
  const dir = ((Math.floor(t / 3000) + (h % 10)) % 2 === 0) ? 1 : -1

  const preClose = prevQuote.preClose || prevQuote.price || 1
  const price = Math.max(0.5, round((prevQuote.price || 1) * (1 + dir * step), 2))

  const changePercent = round(((price - preClose) / preClose) * 100, 2)
  const changeAmount = round(price - preClose, 2)

  const high = Math.max(prevQuote.high ?? price, price)
  const low = Math.min(prevQuote.low ?? price, price)
  const amplitude = round(((high - low) / preClose) * 100, 2)

  const volume = Math.max(0, Math.floor((prevQuote.volume || 0) * (1 + dir * step * 6)))
  const amount = Math.max(0, Math.floor((prevQuote.amount || 0) * (1 + dir * step * 5)))

  const netInflow = Math.floor((prevQuote.netInflow || 0) + dir * ((h % 30) + 10) * 10_000)
  const mainInflow = Math.floor((prevQuote.mainInflow || 0) + dir * ((h % 20) + 6) * 10_000)

  const limitUp = changePercent >= 7.8
  const limitDown = changePercent <= -7.8

  return {
    ...prevQuote,
    ts: t,

    price,
    close: price,

    changePercent,
    changeAmount,
    change: changePercent,

    high,
    low,
    amplitude,

    volume,
    amount,

    netInflow,
    mainInflow,

    limitUp,
    limitDown
  }
}

export const useStockStore = defineStore('stock', {
  state: () => ({
    /** ✅ 股票基础库（只存 code + name） */
    stockBaseList: [
      { code: '600550', name: '保利协鑫' },
      { code: '000063', name: '中兴通讯' },
      { code: '600703', name: '三安光电' },
      { code: '300496', name: '中科创达' },
      { code: '600804', name: '鹏博士' },
      { code: '300059', name: '东方财富' },
      { code: '002410', name: '广联达' },
      { code: '600519', name: '贵州茅台' },
      { code: '300459', name: '金雷股份' },
      { code: '300332', name: '天银机电' },
      { code: '600276', name: '恒瑞医药' },
      { code: '000651', name: '格力电器' },
      { code: '300750', name: '宁德时代' },
      { code: '300361', name: '天华超净' },
      { code: '600836', name: '海通证券' },
      { code: '600028', name: '中国石化' },
      { code: '000002', name: '万科A' },
      { code: '000001', name: '平安银行' },
      { code: '600360', name: '华微电子' },
      { code: '600738', name: '兰州黄河' },
      { code: '300051', name: '三五互联' },
      { code: '300042', name: '大北农' },
      { code: '600050', name: '中国联通' },
      { code: '000333', name: '美的集团' },
      { code: '600131', name: '岷江水电' },
      { code: '000027', name: '深圳能源' },
      { code: '300674', name: '阳光电源' },
      { code: '600423', name: '柳工' },
      { code: '600873', name: '梅雁吉祥' },
      { code: '000933', name: '神火股份' },
      { code: '002304', name: '洋河股份' },
      { code: '000858', name: '五粮液' },
      { code: '600775', name: '南京熊猫' },
      { code: '300003', name: '乐普医疗' },
      { code: '002400', name: '省广集团' },
      { code: '000999', name: '三花智控' },
      { code: '600536', name: '中国软件' },
      { code: '600746', name: '大华股份' },
      { code: '600104', name: '上汽集团' },
      { code: '600371', name: '万向钱潮' },
      { code: '600085', name: '同仁堂' },
      { code: '600690', name: '海尔智家' }
    ],

    /** ✅ 行情缓存：code -> quote */
    quotesByCode: {},

    /** ✅ 自选股票（只存 code） */
    myStockCodes: ['600550', '600519', '002410'],

    /** ✅ mock/后端切换 */
    useMock: true,

    _mockTimer: null
  }),

  getters: {
    /** ✅ 建索引：查 base 更快 */
    baseByCode: (state) => {
      const map = Object.create(null)
      state.stockBaseList.forEach(s => {
        const c = normalizeCode(s.code)
        if (c) map[c] = { code: c, name: s.name }
      })
      return map
    },

    /** ✅ 兼容：旧 getter */
    getBaseByCode() {
      return (code) => this.baseByCode[normalizeCode(code)] || null
    },

    /** ✅ 兼容 Sidebar 的命名：你之前写的是 getStockBaseByCode */
    getStockBaseByCode() {
      return (code) => this.baseByCode[normalizeCode(code)] || null
    },

    isStockFavorite() {
      return (code) => this.myStockCodes.includes(normalizeCode(code))
    },

    /** ✅ 单个：基础 + 行情合并 */
    getStockByCodeEnriched() {
      return (code, conceptName = '') => {
        const c = normalizeCode(code)
        const base = this.baseByCode[c]
        if (!base) return null
        const quote = this.quotesByCode[c] || mockBaseQuote(c)
        return { ...base, ...quote, concept: conceptName || '' }
      }
    },

    /** ✅ 批量：基础 + 行情合并 */
    getStocksByCodesEnriched() {
      return (codes = [], conceptName = '') => {
        return (codes || [])
          .map(code => {
            const c = normalizeCode(code)
            const base = this.baseByCode[c]
            if (!base) return null
            const quote = this.quotesByCode[c] || mockBaseQuote(c)
            return { ...base, ...quote, concept: conceptName || '' }
          })
          .filter(Boolean)
      }
    },

    myStockListEnriched() {
      return this.myStockCodes
        .map(code => this.getStockByCodeEnriched(code))
        .filter(Boolean)
    }
  },

  actions: {
    /** ✅ mock 初始化：确保 codes 都有行情 */
    initMockQuotes(codes = []) {
      const list = codes.length ? codes : this.stockBaseList.map(s => s.code)
      list.forEach(code => {
        const c = normalizeCode(code)
        if (!c) return
        if (!this.quotesByCode[c]) this.quotesByCode[c] = mockBaseQuote(c)
      })
    },

    /** ✅ 统一：拉行情入口 */
    async fetchQuotes(codes = []) {
      const uniq = Array.from(new Set((codes || []).map(normalizeCode).filter(Boolean)))
      if (!uniq.length) return

      if (this.useMock) {
        uniq.forEach(code => {
          const prev = this.quotesByCode[code] || mockBaseQuote(code)
          this.quotesByCode[code] = tickQuote(prev)
        })
        return
      }


      if (!httpClient?.post) {
        throw new Error('axios client is not available')
      }
      const resp = await httpClient.post('/api/quotes', { codes: uniq })
      const rows = resp?.data?.data || resp?.data || []
      rows.forEach(q => {
        const c = normalizeCode(q?.code)
        if (!c) return
        this.quotesByCode[c] = {
          ...(this.quotesByCode[c] || {}),
          ...q,
          code: c,
          ts: Date.now(),
          change: q.change ?? q.changePercent
        }
      })
    },

    /** ✅ 演示：启动 mock ticker */
    startMockTicker(codes = [], intervalMs = 3000) {
      if (!this.useMock) return
      this.stopMockTicker()

      const uniq = Array.from(new Set((codes || []).map(normalizeCode).filter(Boolean)))
      this.initMockQuotes(uniq)

      this._mockTimer = setInterval(() => {
        this.fetchQuotes(uniq)
      }, intervalMs)
    },

    stopMockTicker() {
      if (this._mockTimer) {
        clearInterval(this._mockTimer)
        this._mockTimer = null
      }
    },

    addStockToMyStocks(code) {
      const c = normalizeCode(code)
      if (!c) return
      if (this.myStockCodes.includes(c)) return
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
