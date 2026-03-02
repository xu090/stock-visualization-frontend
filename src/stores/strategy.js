import { defineStore } from 'pinia'

const PRESET_SELECT_STRATEGIES = [
  {
    id: 1001,
    name: '强势主线',
    desc: '涨跌、资金、活跃度综合筛选（Pareto 排序）',
    isFavorite: true,
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['change', 'netInflow', 'amount'],
      filters: {
        minChange: 2,
        minNetInflowY: 0.1,
        minAmountY: 10,
        minVolRatio: 1.2,
        minUpRatio: 0.55
      }
    }
  },
  {
    id: 1002,
    name: '资金优先',
    desc: '以净流入为核心，兼顾成交额',
    isFavorite: true,
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['netInflow', 'amount'],
      filters: {
        minNetInflowY: 3,
        minAmountY: 15,
        minUpRatio: 0.5
      }
    }
  },
  {
    id: 1003,
    name: '放量突破',
    desc: '量比 + 涨跌，筛出放量上攻',
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['volRatio', 'change'],
      filters: { minVolRatio: 1.6, minChange: 1, minAmountY: 8 }
    }
  },
  {
    id: 1004,
    name: '广度确认',
    desc: '以上涨占比为主，验证板块扩散',
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['upRatio', 'change'],
      filters: { minUpRatio: 0.65, minChange: 0.5 }
    }
  },
  {
    id: 1005,
    name: '异动追踪',
    desc: '短线异动热度为主，辅助量比',
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['spike5m', 'volRatio'],
      filters: { minSpike5m: 70, minVolRatio: 1.3, minAmountY: 6 }
    }
  },
  {
    id: 1006,
    name: '稳健回撤',
    desc: '强度不弱 + 波动可控 + 回撤不过深',
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['strength', 'amount'],
      filters: { minStrength: 55, maxVolatility: 22, maxDrawdown20d: -8, minAmountY: 8 }
    }
  },
  {
    id: 1007,
    name: '自定义模板',
    desc: '示例自定义策略，可在编辑中按需调整',
    isCustom: true,
    isFavorite: false,
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['change', 'volRatio'],
      filters: {
        minChange: 1,
        minVolRatio: 1.3,
        minAmountY: 6
      }
    }
  }
]

const normalizeStrategy = (item, { isCustom = false } = {}) => ({
  ...item,
  isFavorite: item?.isFavorite ?? isCustom,
  isCustom: item?.isCustom ?? isCustom
})

const toNullableNumber = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const normalizeTradeSnapshot = (snapshot) => {
  const rules = snapshot?.rules || {}
  return {
    rules: {
      buyCondition: String(rules.buyCondition ?? rules.entry ?? '').trim(),
      sellCondition: String(rules.sellCondition ?? rules.exit ?? '').trim(),
      stopLossPct: toNullableNumber(rules.stopLossPct ?? rules?.risk?.stopLossPct ?? rules?.risk?.stopLoss),
      takeProfitPct: toNullableNumber(rules.takeProfitPct ?? rules?.risk?.takeProfitPct ?? rules?.risk?.takeProfit),
      maxPositionPct: toNullableNumber(rules.maxPositionPct ?? rules?.position?.maxPositionPct ?? rules?.position?.maxPct)
    }
  }
}

export const useStrategyStore = defineStore('strategy', {
  state: () => ({
    selectStrategies: PRESET_SELECT_STRATEGIES.map(item => normalizeStrategy(item, { isCustom: false })),
    tradeStrategies: []
  }),

  actions: {
    addSelectStrategyFromSnapshot({ name, desc, snapshot, isFavorite = false, isCustom = true } = {}) {
      this.selectStrategies.unshift({
        id: Date.now(),
        enabled: true,
        name: name?.trim() || '未命名策略',
        desc: desc?.trim() || '保存了一组筛选与排序条件',
        snapshot: snapshot || null,
        isFavorite: !!isFavorite,
        isCustom: !!isCustom
      })
    },

    addTradeStrategyFromSnapshot({ name, desc, snapshot, isFavorite = false, isCustom = true } = {}) {
      this.tradeStrategies.unshift({
        id: Date.now(),
        enabled: true,
        name: name?.trim() || '未命名策略',
        desc: desc?.trim() || '保存了一组交易规则',
        snapshot: normalizeTradeSnapshot(snapshot),
        isFavorite: !!isFavorite,
        isCustom: !!isCustom
      })
    },

    updateStrategy(type, id, patch) {
      const list = type === 'select' ? this.selectStrategies : this.tradeStrategies
      const target = list.find(s => s.id === id)
      if (!target) return
      if (type === 'trade' && patch?.snapshot) {
        Object.assign(target, { ...patch, snapshot: normalizeTradeSnapshot(patch.snapshot) })
        return
      }
      Object.assign(target, patch)
    },

    removeStrategy(type, id) {
      if (type === 'select') {
        this.selectStrategies = this.selectStrategies.filter(s => s.id !== id)
      } else {
        this.tradeStrategies = this.tradeStrategies.filter(s => s.id !== id)
      }
    },

    toggleFavorite(type, id) {
      const list = type === 'select' ? this.selectStrategies : this.tradeStrategies
      const target = list.find(s => s.id === id)
      if (target) target.isFavorite = !target.isFavorite
    }
  }
})
