// src/stores/concept.js
import { defineStore } from 'pinia'

/**
 * ✅ 指标 mock：用于概念总览/自定义概念展示
 * - 新命名（不带 rt）：change, netInflow, amount, volRatio, strength, spike5m...
 * - 向后兼容：同时保留 rtChange, rtNetInflow, rtAmount... 供旧页面/旧逻辑继续用
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

/**
 * ✅ 更贴近“实盘盘中”股民需要的概念级指标（但命名不强调 rt）
 * 注意：这里仍是 mock。你接真实接口时，只要替换这里的值来源即可。
 */
function mockConceptMetricsById(id) {
  const h = hashNum(id || 'concept-x')

  // 价格变化类（概念层面的“涨跌幅/动量”）
  const change = round(((h % 2400) / 100) - 12, 2)            // 当前涨跌幅（概念）
  const change1m = round((((h >> 1) % 600) / 100) - 3, 2)     // 1分钟动量
  const change5m = round((((h >> 2) % 1000) / 100) - 5, 2)    // 5分钟动量
  const change20d = round((((h >> 3) % 2600) / 100) - 13, 2)  // 20日涨跌（保留你原有）

  // 资金类（净流入/主力）
  const netInflow = ((h % 12000) - 4000) * 10_000            // 净流入（概念）
  const mainInflow = ((h % 6000) - 2000) * 10_000            // 主力净流入（概念）

  // 交易活跃类（成交额/换手/量比）
  const amount = ((h % 45000) + 5000) * 10_000               // 成交额（概念）
  const turnover = round(((h % 800) / 10) + 2, 1)            // 换手率（概念）
  const volRatio = round(((h % 500) / 100) + 0.6, 2)         // 量比（概念）

  // 广度/情绪（上涨占比、涨跌停、强度、异动）
  const upRatio = clamp(round(((h % 100) / 100) * 1.0, 2), 0, 1) // 上涨占比 0~1
  const limitUp = clamp((h % 16) - 3, 0, 14)                    // 涨停数
  const limitDown = clamp((h % 8) - 4, 0, 6)                    // 跌停数

  // 板块强度（0~100）
  const strength = clamp(Math.floor((h % 100)), 0, 100)

  // 异动热度（0~100）
  const spike5m = clamp(Math.floor(((h >> 4) % 120)), 0, 100)

  // 风险波动
  const volatility = round(((h % 400) / 10) + 8, 1)
  const drawdown20d = round(-((h % 1800) / 100), 2)

  return {
    // ✅ 新命名（推荐用）
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

    // ✅ 向后兼容（保留旧字段）
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

export const useConceptStore = defineStore('concept', {
  state: () => ({
    // ===== 系统概念（只存 stockCodes）=====
    conceptList: [
      {
        id: 'semiconductor',
        name: '半导体',
        description: '半导体行业相关股票，涵盖芯片制造与封装等相关领域',
        stockCodes: ['600550', '000063', '600703', '300496', '600804', '300059']
      },
      {
        id: 'ai',
        name: '人工智能',
        description: '人工智能及相关行业，涵盖AI芯片、机器人、智能硬件等',
        stockCodes: ['000063', '002410', '600519', '300459', '300332', '600276']
      },
      {
        id: 'new-energy',
        name: '新能源',
        description: '涉及风能、太阳能、储能电池等清洁能源领域',
        stockCodes: ['600519', '000651', '300750', '300361', '600836', '600028']
      },
      {
        id: 'blockchain',
        name: '区块链',
        description: '区块链技术相关概念股票，涵盖加密货币、金融区块链等应用领域',
        stockCodes: ['000002', '000001', '600360', '600738', '300051', '300042']
      },
      {
        id: '5g',
        name: '5G',
        description: '5G技术相关产业，涵盖通信设备、基站建设、5G芯片等领域',
        stockCodes: ['600698', '000063', '600268', '000333', '600050', '600131']
      },
      {
        id: 'clean-energy',
        name: '清洁能源',
        description: '风能、太阳能、储能电池等清洁能源相关概念',
        stockCodes: ['000027', '300459', '300674', '600423', '600873', '000933']
      },
      {
        id: 'big-consumption',
        name: '大消费',
        description: '包括消费品、消费品零售、餐饮等行业',
        stockCodes: ['600519', '002304', '000858', '600775', '000002', '600276']
      },
      {
        id: 'healthcare',
        name: '医药健康',
        description: '医药、医疗器械及健康产业相关股票',
        stockCodes: ['600276', '300003', '002400', '000999']
      },
      {
        id: 'fintech',
        name: '金融科技',
        description: '金融科技，包括支付、金融软件等',
        stockCodes: ['000063', '002410', '300750', '300332', '600276', '300059']
      },
      {
        id: 'cloud-computing',
        name: '云计算',
        description: '云计算、云服务相关领域',
        stockCodes: ['600536', '600746', '300059']
      },
      {
        id: 'automobile',
        name: '汽车',
        description: '汽车行业，包括电动汽车、传统汽车等',
        stockCodes: ['600104', '600371']
      },
      {
        id: 'retail',
        name: '零售',
        description: '零售行业，包括线上和线下零售商',
        stockCodes: ['600085', '600690']
      },
      {
        id: 'real-estate',
        name: '房地产',
        description: '房地产行业相关股票',
        stockCodes: ['000002']
      }
    ],

    // ===== 概念自选（收藏概念）=====
    myConceptList: [
      {
        id: 'semiconductor',
        name: '半导体',
        description: '半导体行业相关股票，涵盖芯片制造与封装等相关领域',
        stockCodes: ['600550', '000063', '600703', '300496', '600804', '300059']
      },
      {
        id: 'ai',
        name: '人工智能',
        description: '人工智能及相关行业，涵盖AI芯片、机器人、智能硬件等',
        stockCodes: ['000063', '002410', '600519', '300459', '300332', '600276']
      },
      {
        id: 'new-energy',
        name: '新能源',
        description: '涉及风能、太阳能、储能电池等清洁能源领域',
        stockCodes: ['600519', '000651', '300750', '300361', '600836', '600028']
      },
      {
        id: 'healthcare',
        name: '医药健康',
        description: '医药、医疗器械及健康产业相关股票',
        stockCodes: ['600276', '300003', '002400', '000999']
      }
    ],

    /**
     * ✅ 自定义概念库（概念管理页的数据源）
     * ✅ 这里加入一批初始“自定义概念数据”
     * - id：建议用 user- 前缀，避免与系统概念冲突
     * - algorithm：weighted / percentage / ''（未选择）
     */
    userConceptList: [
      {
        id: 'user-ai-hardware',
        name: 'AI 硬件链',
        description: '偏硬件：算力/服务器/高速连接等，跟踪盘中强势方向',
        stockCodes: ['000063', '300059', '600050', '300496'],
        algorithm: 'percentage'
      },
      {
        id: 'user-defense',
        name: '军工主线',
        description: '军工链路自定义集合：便于观察板块强度与异动',
        stockCodes: ['600703', '300332', '600268'],
        algorithm: 'weighted'
      },
      {
        id: 'user-dividend',
        name: '高股息防守',
        description: '偏防守：回撤可控、适合低波动观察（示例）',
        stockCodes: ['600519', '600104', '600690'],
        algorithm: 'weighted'
      },
      {
        id: 'user-trend-breakout',
        name: '趋势突破观察',
        description: '做短线观察用：看异动(spike)和强度(strength)组合',
        stockCodes: ['300459', '300361', '600536', '600746'],
        algorithm: 'percentage'
      }
    ]
  }),

  getters: {
    getConceptById: (state) => (id) => state.conceptList.find(c => c.id === id),
    getMyConceptById: (state) => (id) => state.myConceptList.find(c => c.id === id),
    isConceptFavorite: (state) => (id) => state.myConceptList.some(c => c.id === id),

    /** ✅ 概念管理页用：自定义概念列表 */
    userConcepts: (state) => Array.isArray(state.userConceptList) ? state.userConceptList : [],

    /**
     * ✅ 系统概念总览：补齐指标（给 HomeView/概念卡片/侧边切换栏用）
     * 返回对象：既有新字段，也有旧字段
     */
    conceptOverviewList: (state) => (state.conceptList || []).map(c => {
      const m = mockConceptMetricsById(c.id)
      return { ...c, ...m }
    }),

    /**
     * ✅ 系统+自定义 合并总览（HomeView 如果要把自定义也一起展示，用这个）
     */
    conceptOverviewAll() {
      const sys = this.conceptOverviewList || []
      const user = (this.userConceptList || []).map(c => {
        const m = mockConceptMetricsById(c.id)
        return { ...c, ...m }
      })

      // ✅ 去重（自定义 id 理论不与系统冲突，但保险）
      const map = new Map()
      ;[...sys, ...user].forEach(x => map.set(x.id, x))
      return Array.from(map.values())
    }
  },

  actions: {
    /** 收藏系统概念到自选 */
    addConceptToMyConcept(concept) {
      if (!concept?.id) return
      if (this.myConceptList.some(c => c.id === concept.id)) return
      this.myConceptList.push({
        id: concept.id,
        name: concept.name,
        description: concept.description || '',
        stockCodes: concept.stockCodes || []
      })
    },

    removeConceptFromMyConcept(conceptOrId) {
      const id = typeof conceptOrId === 'string' ? conceptOrId : conceptOrId?.id
      if (!id) return
      this.myConceptList = this.myConceptList.filter(c => c.id !== id)
    },

    /** ✅ 新建自定义概念（概念管理页用） */
    addUserConcept(concept) {
      if (!concept?.id) return
      if (!Array.isArray(this.userConceptList)) this.userConceptList = []
      if (this.userConceptList.some(c => c.id === concept.id)) return
      this.userConceptList.push({
        id: concept.id,
        name: concept.name,
        description: concept.description || '',
        stockCodes: concept.stockCodes || [],
        algorithm: concept.algorithm || ''
      })
    },

    updateUserConcept(concept) {
      if (!concept?.id) return
      if (!Array.isArray(this.userConceptList)) this.userConceptList = []
      const idx = this.userConceptList.findIndex(c => c.id === concept.id)
      if (idx < 0) return
      this.userConceptList[idx] = {
        ...this.userConceptList[idx],
        ...concept,
        stockCodes: concept.stockCodes || this.userConceptList[idx].stockCodes || []
      }
    },

    deleteUserConcept(id) {
      if (!id) return
      this.userConceptList = (this.userConceptList || []).filter(c => c.id !== id)
    }
  }
})
