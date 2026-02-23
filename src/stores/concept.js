// src/stores/concept.js
import { defineStore } from 'pinia'

/**
 * ✅ 单列表模型（推荐）
 * - state 只有 conceptList：系统 + 自定义 + 自选都在这一个数组里
 * - 用字段区分：
 *   - editable: false => 系统概念
 *   - editable: true  => 自定义概念
 *   - favorite: true  => 自选（收藏）
 */

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
  const p = Math.pow(10, d)
  return Math.round(n * p) / p
}

/** mock 概念指标 */
function mockConceptMetricsById(id) {
  const h = hashNum(id || 'concept-x')

  const change = round(((h % 2400) / 100) - 12, 2)
  const change1m = round((((h >> 1) % 600) / 100) - 3, 2)
  const change5m = round((((h >> 2) % 1000) / 100) - 5, 2)
  const change20d = round((((h >> 3) % 2600) / 100) - 13, 2)

  const netInflow = ((h % 12000) - 4000) * 10_000
  const mainInflow = ((h % 6000) - 2000) * 10_000

  const amount = ((h % 45000) + 5000) * 10_000
  const turnover = round(((h % 800) / 10) + 2, 1)
  const volRatio = round(((h % 500) / 100) + 0.6, 2)

  const upRatio = clamp(round(((h % 100) / 100) * 1.0, 2), 0, 1)
  const limitUp = clamp((h % 16) - 3, 0, 14)
  const limitDown = clamp((h % 8) - 4, 0, 6)

  const strength = clamp(Math.floor((h % 100)), 0, 100)
  const spike5m = clamp(Math.floor(((h >> 4) % 120)), 0, 100)

  const volatility = round(((h % 400) / 10) + 8, 1)
  const drawdown20d = round(-((h % 1800) / 100), 2)

  return {
    // ✅ 新命名
    change,
    change1m,
    change5m,
    change20d,

    netInflow,
    mainInflow,

    amount,
    turnover,
    volRatio,

    upRatio,
    limitUp,
    limitDown,

    strength,
    spike5m,

    volatility,
    drawdown20d,

    // ✅ 向后兼容（旧字段）
    rtChange: change,
    rtChange1m: change1m,
    rtChange5m: change5m,
    rtChange20d: change20d,

    rtNetInflow: netInflow,
    rtMainInflow: mainInflow,

    rtAmount: amount,
    rtTurnover: turnover,

    rtVolRatio: volRatio,
    rtUpRatio: upRatio,

    rtLimitUp: limitUp,
    rtLimitDown: limitDown,

    rtStrength: strength,
    rtSpike5m: spike5m,

    rtVolatility: volatility,
    rtDrawdown20d: drawdown20d
  }
}

function normId(id) {
  return String(id ?? '').trim()
}

export const useConceptStore = defineStore('concept', {
  state: () => ({
    /**
     * ✅ 统一概念列表：系统 + 自定义
     * favorite: 是否收藏（自选）
     */
    conceptList: [
      // ===== 系统概念 =====
      {
        id: 'semiconductor',
        name: '半导体',
        description: '半导体行业相关股票，涵盖芯片制造与封装等相关领域',
        stockCodes: ['600550', '000063', '600703', '300496', '600804', '300059'],
        editable: false,
        favorite: true // ✅ 默认自选（对应你旧 myConceptList）
      },
      {
        id: 'ai',
        name: '人工智能',
        description: '人工智能及相关行业，涵盖AI芯片、机器人、智能硬件等',
        stockCodes: ['000063', '002410', '600519', '300459', '300332', '600276'],
        editable: false,
        favorite: true
      },
      {
        id: 'new-energy',
        name: '新能源',
        description: '涉及风能、太阳能、储能电池等清洁能源领域',
        stockCodes: ['600519', '000651', '300750', '300361', '600836', '600028'],
        editable: false,
        favorite: true
      },
      {
        id: 'blockchain',
        name: '区块链',
        description: '区块链技术相关概念股票，涵盖加密货币、金融区块链等应用领域',
        stockCodes: ['000002', '000001', '600360', '600738', '300051', '300042'],
        editable: false,
        favorite: false
      },
      {
        id: '5g',
        name: '5G',
        description: '5G技术相关产业，涵盖通信设备、基站建设、5G芯片等领域',
        stockCodes: ['600698', '000063', '600268', '000333', '600050', '600131'],
        editable: false,
        favorite: false
      },
      {
        id: 'clean-energy',
        name: '清洁能源',
        description: '风能、太阳能、储能电池等清洁能源相关概念',
        stockCodes: ['000027', '300459', '300674', '600423', '600873', '000933'],
        editable: false,
        favorite: false
      },
      {
        id: 'big-consumption',
        name: '大消费',
        description: '包括消费品、消费品零售、餐饮等行业',
        stockCodes: ['600519', '002304', '000858', '600775', '000002', '600276'],
        editable: false,
        favorite: false
      },
      {
        id: 'healthcare',
        name: '医药健康',
        description: '医药、医疗器械及健康产业相关股票',
        stockCodes: ['600276', '300003', '002400', '000999'],
        editable: false,
        favorite: true
      },
      {
        id: 'fintech',
        name: '金融科技',
        description: '金融科技，包括支付、金融软件等',
        stockCodes: ['000063', '002410', '300750', '300332', '600276', '300059'],
        editable: false,
        favorite: false
      },
      {
        id: 'cloud-computing',
        name: '云计算',
        description: '云计算、云服务相关领域',
        stockCodes: ['600536', '600746', '300059'],
        editable: false,
        favorite: false
      },
      {
        id: 'automobile',
        name: '汽车',
        description: '汽车行业，包括电动汽车、传统汽车等',
        stockCodes: ['600104', '600371'],
        editable: false,
        favorite: false
      },
      {
        id: 'retail',
        name: '零售',
        description: '零售行业，包括线上和线下零售商',
        stockCodes: ['600085', '600690'],
        editable: false,
        favorite: false
      },
      {
        id: 'real-estate',
        name: '房地产',
        description: '房地产行业相关股票',
        stockCodes: ['000002'],
        editable: false,
        favorite: false
      },

      // ===== 自定义概念=====
      {
        id: 'user-ai-hardware',
        name: 'AI 硬件链',
        description: '偏硬件：算力/服务器/高速连接等，跟踪盘中强势方向',
        stockCodes: ['000063', '300059', '600050', '300496'],
        algorithm: 'percentage',
        editable: true,
        favorite: false
      },
      {
        id: 'user-defense',
        name: '军工主线',
        description: '军工链路自定义集合：便于观察板块强度与异动',
        stockCodes: ['600703', '300332', '600268'],
        algorithm: 'weighted',
        editable: true,
        favorite: false
      },
      {
        id: 'user-dividend',
        name: '高股息防守',
        description: '偏防守：回撤可控、适合低波动观察（示例）',
        stockCodes: ['600519', '600104', '600690'],
        algorithm: 'weighted',
        editable: true,
        favorite: false
      },
      {
        id: 'user-trend-breakout',
        name: '趋势突破观察',
        description: '做短线观察用：看异动(spike)和强度(strength)组合',
        stockCodes: ['300459', '300361', '600536', '600746'],
        algorithm: 'percentage',
        editable: true,
        favorite: false
      }
    ]
  }),

  getters: {
    /** ✅ 单一入口：按 id 取（系统/自定义都能取到） */
    getConceptById: (state) => (id) => {
      const sid = normId(id)
      if (!sid) return null
      return (state.conceptList || []).find(c => normId(c.id) === sid) || null
    },

    /** ✅ 向后兼容：旧代码用它取“自选概念” */
    getMyConceptById() {
      return (id) => {
        const c = this.getConceptById(id)
        return c?.favorite ? c : null
      }
    },

    /** ✅ 向后兼容：旧代码调用 isConceptFavorite */
    isConceptFavorite() {
      return (id) => !!this.getConceptById(id)?.favorite
    },

    /** ✅ 自选列表（向后兼容：以前的 myConceptList） */
    myConceptList() {
      return (this.conceptList || []).filter(c => !!c.favorite)
    },

    /** ✅ 自定义列表（向后兼容：你页面里用的 userConcepts） */
    userConcepts() {
      return (this.conceptList || []).filter(c => !!c.editable)
    },

    /** ✅ 系统概念（可选） */
    systemConcepts() {
      return (this.conceptList || []).filter(c => !c.editable)
    },

    /** ✅ 系统概念总览（旧名保留） */
    conceptOverviewList() {
      return (this.systemConcepts || []).map(c => {
        const m = mockConceptMetricsById(c.id)
        return { ...c, ...m }
      })
    },

    /** ✅ 全部概念总览（系统 + 自定义） */
    conceptOverviewAll() {
      const list = (this.conceptList || []).slice()
      // 防重复（以 id 去重）
      const map = new Map()
      list.forEach(c => {
        if (!c?.id) return
        map.set(normId(c.id), c)
      })
      return Array.from(map.values()).map(c => {
        const m = mockConceptMetricsById(c.id)
        return { ...c, ...m }
      })
    }
  },

  actions: {
    /** ✅ 兼容旧接口：加入自选（收藏） */
    addConceptToMyConcept(conceptOrId) {
      const id = normId(typeof conceptOrId === 'string' ? conceptOrId : conceptOrId?.id)
      if (!id) return
      const idx = (this.conceptList || []).findIndex(c => normId(c.id) === id)
      if (idx < 0) return
      this.conceptList[idx].favorite = true
    },

    /** ✅ 兼容旧接口：取消自选（取消收藏） */
    removeConceptFromMyConcept(conceptOrId) {
      const id = normId(typeof conceptOrId === 'string' ? conceptOrId : conceptOrId?.id)
      if (!id) return
      const idx = (this.conceptList || []).findIndex(c => normId(c.id) === id)
      if (idx < 0) return
      this.conceptList[idx].favorite = false
    },

    /** ✅ 可选：一键切换收藏 */
    toggleFavorite(idOrConcept) {
      const id = normId(typeof idOrConcept === 'string' ? idOrConcept : idOrConcept?.id)
      if (!id) return
      const idx = (this.conceptList || []).findIndex(c => normId(c.id) === id)
      if (idx < 0) return
      this.conceptList[idx].favorite = !this.conceptList[idx].favorite
    },

    /** ✅ 新建自定义概念：editable=true，favorite 默认 false */
    addUserConcept(concept) {
      if (!concept?.id) return
      const id = normId(concept.id)
      if (!id) return

      // 🚫 不允许重复 id
      if ((this.conceptList || []).some(c => normId(c.id) === id)) return

      if (!Array.isArray(this.conceptList)) this.conceptList = []

      this.conceptList.push({
        id,
        name: concept.name,
        description: concept.description || '',
        stockCodes: Array.isArray(concept.stockCodes) ? concept.stockCodes : [],
        algorithm: concept.algorithm || '',
        editable: true,
        favorite: !!concept.favorite
      })
    },

    /** ✅ 更新自定义概念：只允许 editable=true 的条目 */
    updateUserConcept(concept) {
      if (!concept?.id) return
      const id = normId(concept.id)
      if (!id) return

      const idx = (this.conceptList || []).findIndex(c => normId(c.id) === id)
      if (idx < 0) return

      const prev = this.conceptList[idx] || {}
      if (prev.editable === false) return // 🚫 系统概念不允许改

      this.conceptList[idx] = {
        ...prev,
        ...concept,
        id,
        editable: true,
        stockCodes: Array.isArray(concept.stockCodes) ? concept.stockCodes : (prev.stockCodes || []),
        // favorite 不强制覆盖：除非你传了 favorite
        favorite: concept.favorite == null ? prev.favorite : !!concept.favorite
      }
    },

    /** ✅ 删除自定义概念：只删 editable=true */
    deleteUserConcept(id) {
      const sid = normId(id)
      if (!sid) return

      const target = (this.conceptList || []).find(c => normId(c.id) === sid)
      if (!target) return
      if (target.editable === false) return

      this.conceptList = (this.conceptList || []).filter(c => normId(c.id) !== sid)
    }
  }
})