// src/stores/strategy.js
import { defineStore } from 'pinia'

/**
 * ✅ “概念层”策略（更贴近股民终端思路）
 * snapshot.filters 里的单位口径：
 * - minNetInflowY / minAmountY：亿元
 * - minChange：%
 * - maxDrawdown20d：%（负数，比如 -8）
 */
const PRESET_SELECT_STRATEGIES = [
  {
    id: 1001,
    name: '强势主线',
    desc: '涨跌、资金、活跃度综合筛选（Pareto排序）',
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
    desc: '上涨占比为主，验证板块扩散',
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
    desc: '强度不弱 + 波动受控 + 回撤不深',
    enabled: true,
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: ['strength', 'amount'],
      filters: { minStrength: 55, maxVolatility: 22, maxDrawdown20d: -8, minAmountY: 8 }
    }
  }
]

export const useStrategyStore = defineStore('strategy', {
  state: () => ({
    /** ✅ 选概念/关注策略（=老师说的选股策略，先停留在概念层） */
    selectStrategies: PRESET_SELECT_STRATEGIES,

    /** 交易策略（老师说先不用做） */
    tradeStrategies: []
  }),

  getters: {
    enabledSelectStrategies: (state) => state.selectStrategies.filter(s => s.enabled),
    enabledTradeStrategies: (state) => state.tradeStrategies.filter(s => s.enabled)
  },

  actions: {
    /** ✅ 从当前筛选快照创建策略（核心：导出筛选条件） */
    addSelectStrategyFromSnapshot({ name, desc, snapshot }) {
      this.selectStrategies.unshift({
        id: Date.now(),
        enabled: true,
        name: name?.trim() || '未命名策略',
        desc: desc?.trim() || '保存了一组筛选/排序条件',
        snapshot: snapshot || null
      })
    },

    updateStrategy(type, id, patch) {
      const list = type === 'select' ? this.selectStrategies : this.tradeStrategies
      const target = list.find(s => s.id === id)
      if (target) Object.assign(target, patch)
    },

    removeStrategy(type, id) {
      if (type === 'select') {
        this.selectStrategies = this.selectStrategies.filter(s => s.id !== id)
      } else {
        this.tradeStrategies = this.tradeStrategies.filter(s => s.id !== id)
      }
    },

    toggleStrategy(type, id) {
      const list = type === 'select' ? this.selectStrategies : this.tradeStrategies
      const target = list.find(s => s.id === id)
      if (target) target.enabled = !target.enabled
    }
  }
})
