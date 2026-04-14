import { defineStore } from 'pinia'

const PRESET_SELECT_STRATEGIES = [
  {
    id: 1001,
    name: '强势主线',
    desc: '涨跌、资金、活跃度综合筛选（Pareto排序）',
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
    desc: '量比 + 涨跌幅，筛出放量上攻',
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

export const useStrategyStore = defineStore('strategy', {
  state: () => ({
    selectStrategies: PRESET_SELECT_STRATEGIES.map(item => normalizeStrategy(item, { isCustom: false }))
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

    updateStrategy(_type, id, patch) {
      const target = this.selectStrategies.find(s => s.id === id)
      if (!target) return
      Object.assign(target, patch)
    },

    removeStrategy(_type, id) {
      this.selectStrategies = this.selectStrategies.filter(s => s.id !== id)
    },

    toggleFavorite(_type, id) {
      const target = this.selectStrategies.find(s => s.id === id)
      if (target) target.isFavorite = !target.isFavorite
    }
  }
})
