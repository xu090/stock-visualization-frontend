import { defineStore } from 'pinia'
import { normalizeTradeSnapshot } from '@/utils/tradeStrategy'

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

const PRESET_TRADE_STRATEGIES = [
  {
    id: 2001,
    name: '趋势突破-放量确认',
    desc: '适用于A股个股，收盘突破+放量入场',
    isFavorite: true,
    enabled: true,
    snapshot: {
      metadata: {
        strategyType: 'breakout',
        marketScope: 'A-share',
        instrumentType: 'stock',
        timeframe: '1d',
        linkedStockCodes: ['600519', '300750', '000858'],
        linkedConceptIds: []
      },
      dataBinding: {
        source: 'stockStore.quotesByCode',
        fields: ['close', 'changePercent', 'volumeRatio', 'amount', 'netInflow', 'mktCap']
      },
      entry: {
        expression: 'close > ma20 AND volumeRatio >= 1.6 AND changePercent >= 1.5',
        triggerMode: 'close',
        signalRefs: ['close', 'volumeRatio', 'changePercent'],
        conditions: [
          { field: 'changePercent', op: '>=', value: 1.5, connector: 'AND' },
          { field: 'volumeRatio', op: '>=', value: 1.6, connector: 'AND' },
          { field: 'netInflow', op: '>', value: 0, connector: 'AND' }
        ]
      },
      exit: {
        takeProfitPct: 10,
        stopLossPct: 3.5,
        exitSignal: 'close < ma10 OR netInflow < 0',
        conditions: [
          { field: 'changePercent', op: '<=', value: -2, connector: 'OR' },
          { field: 'netInflow', op: '<', value: 0, connector: 'OR' }
        ]
      },
      position: {
        initialMode: 'percent',
        initialValue: 20,
        maxPositionPct: 60,
        addPositionCondition: 'close > ma20 AND volumeRatio >= 2.0',
        addPositionMaxPct: 20,
        reducePositionCondition: 'changePercent < -2'
      },
      risk: {
        maxDrawdownPct: 12,
        maxSingleLossPct: 3.5,
        maxTradesPerDay: 2,
        blacklist: {
          excludeST: true,
          excludeSmallCap: true,
          minMarketCapYi: 80
        }
      },
      params: {
        maFast: { value: 10, min: 5, max: 30, step: 1, sourceField: 'close' },
        maSlow: { value: 20, min: 10, max: 120, step: 1, sourceField: 'close' },
        takeProfitPct: { value: 10, min: 3, max: 25, step: 0.5, sourceField: 'changePercent' },
        stopLossPct: { value: 3.5, min: 1, max: 10, step: 0.5, sourceField: 'changePercent' },
        volumeRatioThreshold: { value: 1.6, min: 1, max: 4, step: 0.1, sourceField: 'volumeRatio' },
        netInflowYiThreshold: { value: 0.2, min: -5, max: 20, step: 0.1, sourceField: 'netInflow' }
      }
    }
  },
  {
    id: 2002,
    name: '均值回归-超跌反弹',
    desc: '短线超跌回弹，强调止损纪律',
    enabled: true,
    snapshot: {
      metadata: {
        strategyType: 'mean-reversion',
        marketScope: 'A-share',
        instrumentType: 'stock',
        timeframe: '1d',
        linkedStockCodes: ['000001', '000333', '600276'],
        linkedConceptIds: []
      },
      dataBinding: {
        source: 'stockStore.quotesByCode',
        fields: ['changePercent', 'amplitude', 'turnover', 'volumeRatio', 'netInflow', 'mktCap']
      },
      entry: {
        expression: 'changePercent <= -3 AND amplitude >= 4 AND turnover >= 3',
        triggerMode: 'intraday',
        signalRefs: ['changePercent', 'amplitude', 'turnover'],
        conditions: [
          { field: 'changePercent', op: '<=', value: -3, connector: 'AND' },
          { field: 'amplitude', op: '>=', value: 4, connector: 'AND' },
          { field: 'turnover', op: '>=', value: 3, connector: 'AND' }
        ]
      },
      exit: {
        takeProfitPct: 6,
        stopLossPct: 2.5,
        exitSignal: 'changePercent >= 3 OR volumeRatio < 1',
        conditions: [
          { field: 'changePercent', op: '>=', value: 3, connector: 'OR' },
          { field: 'volumeRatio', op: '<', value: 1, connector: 'OR' }
        ]
      },
      position: {
        initialMode: 'percent',
        initialValue: 15,
        maxPositionPct: 40,
        addPositionCondition: 'netInflow > 0 AND changePercent > 0',
        addPositionMaxPct: 10,
        reducePositionCondition: 'changePercent < -2'
      },
      risk: {
        maxDrawdownPct: 8,
        maxSingleLossPct: 2.5,
        maxTradesPerDay: 3,
        blacklist: {
          excludeST: true,
          excludeSmallCap: false,
          minMarketCapYi: 50
        }
      },
      params: {
        maFast: { value: 5, min: 2, max: 15, step: 1, sourceField: 'close' },
        maSlow: { value: 13, min: 8, max: 30, step: 1, sourceField: 'close' },
        takeProfitPct: { value: 6, min: 2, max: 15, step: 0.5, sourceField: 'changePercent' },
        stopLossPct: { value: 2.5, min: 1, max: 8, step: 0.5, sourceField: 'changePercent' },
        volumeRatioThreshold: { value: 1.2, min: 0.8, max: 3.5, step: 0.1, sourceField: 'volumeRatio' },
        netInflowYiThreshold: { value: 0.1, min: -5, max: 20, step: 0.1, sourceField: 'netInflow' }
      }
    }
  },
  {
    id: 2003,
    name: '资金趋势-主力净流入',
    desc: '以主力/净流入和量比做趋势跟随',
    enabled: true,
    snapshot: {
      metadata: {
        strategyType: 'trend',
        marketScope: 'A-share',
        instrumentType: 'stock',
        timeframe: '60m',
        linkedStockCodes: ['002410', '300059', '600050'],
        linkedConceptIds: []
      },
      dataBinding: {
        source: 'stockStore.quotesByCode',
        fields: ['netInflow', 'mainInflow', 'volumeRatio', 'changePercent', 'amount', 'orderImbalance']
      },
      entry: {
        expression: 'netInflow > 0 AND mainInflow > 0 AND volumeRatio >= 1.4',
        triggerMode: 'intraday',
        signalRefs: ['netInflow', 'mainInflow', 'volumeRatio'],
        conditions: [
          { field: 'netInflow', op: '>', value: 0, connector: 'AND' },
          { field: 'mainInflow', op: '>', value: 0, connector: 'AND' },
          { field: 'volumeRatio', op: '>=', value: 1.4, connector: 'AND' }
        ]
      },
      exit: {
        takeProfitPct: 9,
        stopLossPct: 3,
        exitSignal: 'mainInflow < 0 OR orderImbalance < -20',
        conditions: [
          { field: 'mainInflow', op: '<', value: 0, connector: 'OR' },
          { field: 'orderImbalance', op: '<', value: -20, connector: 'OR' }
        ]
      },
      position: {
        initialMode: 'percent',
        initialValue: 20,
        maxPositionPct: 70,
        addPositionCondition: 'changePercent > 1 AND amount > 800000000',
        addPositionMaxPct: 25,
        reducePositionCondition: 'orderImbalance < -20'
      },
      risk: {
        maxDrawdownPct: 10,
        maxSingleLossPct: 3,
        maxTradesPerDay: 3,
        blacklist: {
          excludeST: true,
          excludeSmallCap: true,
          minMarketCapYi: 100
        }
      },
      params: {
        maFast: { value: 8, min: 3, max: 30, step: 1, sourceField: 'close' },
        maSlow: { value: 21, min: 8, max: 80, step: 1, sourceField: 'close' },
        takeProfitPct: { value: 9, min: 3, max: 20, step: 0.5, sourceField: 'changePercent' },
        stopLossPct: { value: 3, min: 1, max: 10, step: 0.5, sourceField: 'changePercent' },
        volumeRatioThreshold: { value: 1.4, min: 1, max: 4, step: 0.1, sourceField: 'volumeRatio' },
        netInflowYiThreshold: { value: 0.3, min: -5, max: 20, step: 0.1, sourceField: 'netInflow' }
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
    selectStrategies: PRESET_SELECT_STRATEGIES.map(item => normalizeStrategy(item, { isCustom: false })),
    tradeStrategies: PRESET_TRADE_STRATEGIES
      .map(item => normalizeStrategy(item, { isCustom: false }))
      .map(item => ({ ...item, snapshot: normalizeTradeSnapshot(item.snapshot) }))
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
