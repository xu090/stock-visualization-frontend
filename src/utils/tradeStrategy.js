const toNullableNumber = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const toCleanString = (v) => String(v ?? '').trim()

const normalizeCode = (raw) => {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH)$/i, '')
  s = s.replace(/^(sz|sh)/i, '')
  return s
}

const normalizeCodeList = (arr) => {
  if (!Array.isArray(arr)) return []
  return Array.from(new Set(arr.map(normalizeCode).filter(Boolean)))
}

export const STOCK_FIELD_OPTIONS = [
  { key: 'price', label: '最新价' },
  { key: 'open', label: '开盘价' },
  { key: 'close', label: '收盘价' },
  { key: 'high', label: '最高价' },
  { key: 'low', label: '最低价' },
  { key: 'changePercent', label: '涨跌幅' },
  { key: 'changeAmount', label: '涨跌额' },
  { key: 'volume', label: '成交量' },
  { key: 'amount', label: '成交额' },
  { key: 'turnover', label: '换手率' },
  { key: 'amplitude', label: '振幅' },
  { key: 'netInflow', label: '净流入' },
  { key: 'mainInflow', label: '主力净流入' },
  { key: 'volumeRatio', label: '量比' },
  { key: 'orderImbalance', label: '委比' },
  { key: 'mktCap', label: '总市值' },
  { key: 'pe', label: 'PE' },
  { key: 'pb', label: 'PB' },
  { key: 'change5d', label: '5日涨跌幅' },
  { key: 'change20d', label: '20日涨跌幅' },
  { key: 'industry', label: '行业' },
  { key: 'limitUp', label: '涨停标记' },
  { key: 'limitDown', label: '跌停标记' }
]

const STOCK_FIELD_SET = new Set(STOCK_FIELD_OPTIONS.map(x => x.key))
const STOCK_FIELD_LABEL_MAP = Object.fromEntries(STOCK_FIELD_OPTIONS.map(x => [x.key, x.label]))

export const TRADE_CONDITION_FIELD_OPTIONS = [
  { key: 'changePercent', label: '涨跌幅', unit: '%' },
  { key: 'changeAmount', label: '涨跌额', unit: '' },
  { key: 'price', label: '最新价', unit: '' },
  { key: 'close', label: '收盘价', unit: '' },
  { key: 'volume', label: '成交量', unit: '' },
  { key: 'amount', label: '成交额', unit: '' },
  { key: 'turnover', label: '换手率', unit: '%' },
  { key: 'amplitude', label: '振幅', unit: '%' },
  { key: 'volumeRatio', label: '量比', unit: '' },
  { key: 'netInflow', label: '净流入', unit: '' },
  { key: 'mainInflow', label: '主力净流入', unit: '' },
  { key: 'orderImbalance', label: '委比', unit: '' },
  { key: 'mktCap', label: '总市值', unit: '' }
]

const TRADE_CONDITION_FIELD_SET = new Set(TRADE_CONDITION_FIELD_OPTIONS.map(x => x.key))
const FIELD_UNIT_MAP = Object.fromEntries(TRADE_CONDITION_FIELD_OPTIONS.map(x => [x.key, x.unit || '']))

export const TRADE_CONDITION_OPERATORS = [
  { value: '>', label: '大于' },
  { value: '>=', label: '大于等于' },
  { value: '<', label: '小于' },
  { value: '<=', label: '小于等于' },
  { value: '==', label: '等于' },
  { value: '!=', label: '不等于' }
]
const OP_SET = new Set(TRADE_CONDITION_OPERATORS.map(x => x.value))
const OP_LABEL_MAP = Object.fromEntries(TRADE_CONDITION_OPERATORS.map(x => [x.value, x.label]))
const STRATEGY_TYPE_LABEL = {
  trend: '趋势',
  'mean-reversion': '均值回归',
  breakout: '突破',
  momentum: '动量'
}
const PARAM_LABEL_MAP = {
  maFast: '快线窗口',
  maSlow: '慢线窗口',
  takeProfitPct: '止盈比例(%)',
  stopLossPct: '止损比例(%)',
  volumeRatioThreshold: '量比阈值',
  netInflowYiThreshold: '净流入阈值'
}

const normalizeParam = (p = {}, fallback = {}) => ({
  value: toNullableNumber(p.value ?? fallback.value),
  min: toNullableNumber(p.min ?? fallback.min),
  max: toNullableNumber(p.max ?? fallback.max),
  step: toNullableNumber(p.step ?? fallback.step),
  sourceField: String(p.sourceField ?? fallback.sourceField ?? '').trim() || null
})

const normalizeConditionItem = (item = {}, fallbackConnector = 'AND') => {
  const field = String(item.field ?? '').trim()
  const op = String(item.op ?? '').trim()
  return {
    field: TRADE_CONDITION_FIELD_SET.has(field) ? field : 'changePercent',
    op: OP_SET.has(op) ? op : '>=',
    value: toNullableNumber(item.value),
    connector: String(item.connector ?? fallbackConnector).toUpperCase() === 'OR' ? 'OR' : 'AND'
  }
}

const normalizeConditionList = (arr = []) => {
  if (!Array.isArray(arr)) return []
  return arr.map((x, idx) => normalizeConditionItem(x, idx === 0 ? 'AND' : x?.connector)).filter(x => x.value != null)
}

const conditionToHumanText = (cond = {}) => {
  const fieldLabel = STOCK_FIELD_LABEL_MAP[cond.field] || cond.field || '字段'
  const opLabel = OP_LABEL_MAP[cond.op] || cond.op || '>='
  const unit = FIELD_UNIT_MAP[cond.field] || ''
  const value = cond.value == null ? '--' : cond.value
  return `${fieldLabel}${opLabel}${value}${unit}`
}

const conditionToExpr = (cond = {}) => {
  const field = cond.field || 'changePercent'
  const op = cond.op || '>='
  const value = cond.value == null ? 0 : cond.value
  return `${field}${op}${value}`
}

const conditionListToExpr = (arr = []) => {
  if (!arr.length) return ''
  return arr
    .map((c, idx) => (idx === 0 ? conditionToExpr(c) : `${c.connector || 'AND'} ${conditionToExpr(c)}`))
    .join(' ')
}

const conditionListToHuman = (arr = []) => {
  if (!arr.length) return ''
  return arr
    .map((c, idx) => `${idx + 1}. ${conditionToHumanText(c)}${idx > 0 ? `（${c.connector}）` : ''}`)
    .join('；')
}

export const createDefaultTradeSnapshot = () => ({
  metadata: {
    strategyType: 'trend',
    marketScope: 'A-share',
    instrumentType: 'stock',
    timeframe: '1d',
    linkedStockCodes: [],
    linkedConceptIds: []
  },
  dataBinding: {
    source: 'stockStore.quotesByCode',
    fields: ['close', 'volume', 'amount', 'changePercent', 'volumeRatio', 'netInflow', 'mktCap']
  },
  entry: {
    expression: '',
    triggerMode: 'close',
    signalRefs: ['close', 'volume', 'volumeRatio'],
    conditions: [
      { field: 'changePercent', op: '>=', value: 1.5, connector: 'AND' },
      { field: 'volumeRatio', op: '>=', value: 1.6, connector: 'AND' }
    ]
  },
  exit: {
    takeProfitPct: 8,
    stopLossPct: 3,
    exitSignal: '',
    conditions: [
      { field: 'changePercent', op: '<=', value: -2, connector: 'OR' },
      { field: 'mainInflow', op: '<', value: 0, connector: 'OR' }
    ]
  },
  position: {
    initialMode: 'percent',
    initialValue: 20,
    maxPositionPct: 60,
    addPositionCondition: '',
    addPositionMaxPct: 20,
    reducePositionCondition: ''
  },
  risk: {
    maxDrawdownPct: 12,
    maxSingleLossPct: 3,
    maxTradesPerDay: 3,
    blacklist: {
      excludeST: true,
      excludeSmallCap: false,
      minMarketCapYi: 50
    }
  },
  params: {
    maFast: { value: 5, min: 2, max: 60, step: 1, sourceField: 'close' },
    maSlow: { value: 20, min: 5, max: 120, step: 1, sourceField: 'close' },
    takeProfitPct: { value: 8, min: 1, max: 30, step: 0.5, sourceField: 'changePercent' },
    stopLossPct: { value: 3, min: 0.5, max: 15, step: 0.5, sourceField: 'changePercent' },
    volumeRatioThreshold: { value: 1.5, min: 0.8, max: 5, step: 0.1, sourceField: 'volumeRatio' },
    netInflowYiThreshold: { value: 0.3, min: -20, max: 20, step: 0.1, sourceField: 'netInflow' }
  },
  rules: {
    buyCondition: '',
    sellCondition: '',
    stopLossPct: 3,
    takeProfitPct: 8,
    maxPositionPct: 60
  }
})

export const normalizeTradeSnapshot = (snapshot) => {
  const defaults = createDefaultTradeSnapshot()
  const legacyRules = snapshot?.rules || {}
  const rawMeta = snapshot?.metadata || snapshot?.meta || {}
  const rawDataBinding = snapshot?.dataBinding || {}
  const rawEntry = snapshot?.entry || {}
  const rawExit = snapshot?.exit || {}
  const rawPosition = snapshot?.position || {}
  const rawRisk = snapshot?.risk || {}
  const rawBlacklist = rawRisk.blacklist || {}
  const rawParams = snapshot?.params || {}

  const buyConditions = normalizeConditionList(rawEntry.conditions ?? legacyRules.buyConditions)
  const sellConditions = normalizeConditionList(rawExit.conditions ?? legacyRules.sellConditions)

  const normalized = {
    metadata: {
      strategyType: toCleanString(rawMeta.strategyType) || defaults.metadata.strategyType,
      marketScope: toCleanString(rawMeta.marketScope) || defaults.metadata.marketScope,
      instrumentType: toCleanString(rawMeta.instrumentType) || defaults.metadata.instrumentType,
      timeframe: toCleanString(rawMeta.timeframe) || defaults.metadata.timeframe,
      linkedStockCodes: normalizeCodeList(rawMeta.linkedStockCodes ?? snapshot?.linkedStockCodes),
      linkedConceptIds: Array.isArray(rawMeta.linkedConceptIds ?? snapshot?.linkedConceptIds)
        ? Array.from(new Set((rawMeta.linkedConceptIds ?? snapshot?.linkedConceptIds).map(x => String(x)).filter(Boolean)))
        : []
    },
    dataBinding: {
      source: toCleanString(rawDataBinding.source) || defaults.dataBinding.source,
      fields: Array.from(
        new Set(
          (Array.isArray(rawDataBinding.fields) ? rawDataBinding.fields : defaults.dataBinding.fields)
            .map(x => String(x).trim())
            .filter(x => STOCK_FIELD_SET.has(x))
        )
      )
    },
    entry: {
      expression: toCleanString(legacyRules.buyCondition ?? legacyRules.entry ?? rawEntry.expression),
      triggerMode: toCleanString(rawEntry.triggerMode) || defaults.entry.triggerMode,
      signalRefs: Array.from(
        new Set(
          (Array.isArray(rawEntry.signalRefs) ? rawEntry.signalRefs : defaults.entry.signalRefs)
            .map(x => String(x).trim())
            .filter(x => STOCK_FIELD_SET.has(x))
        )
      ),
      conditions: buyConditions.length ? buyConditions : defaults.entry.conditions
    },
    exit: {
      takeProfitPct: toNullableNumber(legacyRules.takeProfitPct ?? legacyRules?.risk?.takeProfitPct ?? rawExit.takeProfitPct),
      stopLossPct: toNullableNumber(legacyRules.stopLossPct ?? legacyRules?.risk?.stopLossPct ?? rawExit.stopLossPct),
      exitSignal: toCleanString(legacyRules.sellCondition ?? legacyRules.exit ?? rawExit.exitSignal),
      conditions: sellConditions.length ? sellConditions : defaults.exit.conditions
    },
    position: {
      initialMode: toCleanString(rawPosition.initialMode) || defaults.position.initialMode,
      initialValue: toNullableNumber(rawPosition.initialValue ?? defaults.position.initialValue),
      maxPositionPct: toNullableNumber(legacyRules.maxPositionPct ?? legacyRules?.position?.maxPct ?? rawPosition.maxPositionPct),
      addPositionCondition: toCleanString(rawPosition.addPositionCondition),
      addPositionMaxPct: toNullableNumber(rawPosition.addPositionMaxPct),
      reducePositionCondition: toCleanString(rawPosition.reducePositionCondition)
    },
    risk: {
      maxDrawdownPct: toNullableNumber(rawRisk.maxDrawdownPct),
      maxSingleLossPct: toNullableNumber(rawRisk.maxSingleLossPct),
      maxTradesPerDay: toNullableNumber(rawRisk.maxTradesPerDay),
      blacklist: {
        excludeST: rawBlacklist.excludeST == null ? defaults.risk.blacklist.excludeST : !!rawBlacklist.excludeST,
        excludeSmallCap: rawBlacklist.excludeSmallCap == null ? defaults.risk.blacklist.excludeSmallCap : !!rawBlacklist.excludeSmallCap,
        minMarketCapYi: toNullableNumber(rawBlacklist.minMarketCapYi ?? defaults.risk.blacklist.minMarketCapYi)
      }
    },
    params: {
      maFast: normalizeParam(rawParams.maFast, defaults.params.maFast),
      maSlow: normalizeParam(rawParams.maSlow, defaults.params.maSlow),
      takeProfitPct: normalizeParam(rawParams.takeProfitPct, defaults.params.takeProfitPct),
      stopLossPct: normalizeParam(rawParams.stopLossPct, defaults.params.stopLossPct),
      volumeRatioThreshold: normalizeParam(rawParams.volumeRatioThreshold, defaults.params.volumeRatioThreshold),
      netInflowYiThreshold: normalizeParam(rawParams.netInflowYiThreshold, defaults.params.netInflowYiThreshold)
    }
  }

  normalized.exit.takeProfitPct = normalized.exit.takeProfitPct ?? normalized.params.takeProfitPct.value
  normalized.exit.stopLossPct = normalized.exit.stopLossPct ?? normalized.params.stopLossPct.value
  normalized.position.maxPositionPct = normalized.position.maxPositionPct ?? defaults.position.maxPositionPct

  if (!normalized.entry.expression) normalized.entry.expression = conditionListToExpr(normalized.entry.conditions)
  if (!normalized.exit.exitSignal) normalized.exit.exitSignal = conditionListToExpr(normalized.exit.conditions)

  normalized.rules = {
    buyCondition: conditionListToHuman(normalized.entry.conditions) || normalized.entry.expression,
    sellCondition: conditionListToHuman(normalized.exit.conditions) || normalized.exit.exitSignal,
    buyConditions: normalized.entry.conditions,
    sellConditions: normalized.exit.conditions,
    stopLossPct: normalized.exit.stopLossPct,
    takeProfitPct: normalized.exit.takeProfitPct,
    maxPositionPct: normalized.position.maxPositionPct
  }

  return normalized
}

export const tradeSnapshotToLegacyRules = (snapshot) => {
  const normalized = normalizeTradeSnapshot(snapshot)
  return { ...normalized.rules }
}

const hasValue = (v) => v != null && String(v).trim() !== ''

export const getTradeStrategyCompletion = (snapshot) => {
  const s = normalizeTradeSnapshot(snapshot)
  const configured = [
    hasValue(s.metadata.strategyType) && hasValue(s.metadata.timeframe),
    hasValue(s.entry.expression),
    hasValue(s.exit.exitSignal) || s.exit.stopLossPct != null || s.exit.takeProfitPct != null,
    s.position.initialValue != null || s.position.maxPositionPct != null || hasValue(s.position.addPositionCondition) || hasValue(s.position.reducePositionCondition),
    s.risk.maxDrawdownPct != null || s.risk.maxSingleLossPct != null || s.risk.maxTradesPerDay != null || !!s.risk.blacklist.excludeST || !!s.risk.blacklist.excludeSmallCap,
    Object.values(s.params || {}).some(p => p?.value != null)
  ].filter(Boolean).length
  return { configured, total: 6 }
}

export const summarizeTradeStrategy = (snapshot, { maxParts = 6 } = {}) => {
  const s = normalizeTradeSnapshot(snapshot)
  const parts = []
  parts.push(`元信息: ${s.metadata.strategyType}/${s.metadata.marketScope}/${s.metadata.instrumentType}/${s.metadata.timeframe}`)
  parts.push(`入场: ${s.entry.expression || '未设置'} (${s.entry.triggerMode || 'close'})`)
  parts.push(`出场: 止盈${s.exit.takeProfitPct ?? '--'}% 止损${s.exit.stopLossPct ?? '--'}% ${s.exit.exitSignal || ''}`.trim())
  parts.push(`仓位: 初始${s.position.initialValue ?? '--'}% 上限${s.position.maxPositionPct ?? '--'}%`)
  parts.push(`风控: 回撤${s.risk.maxDrawdownPct ?? '--'}% 单笔${s.risk.maxSingleLossPct ?? '--'}% 日内${s.risk.maxTradesPerDay ?? '--'}次`)
  const fieldLabels = (s.dataBinding.fields || [])
    .map(k => STOCK_FIELD_OPTIONS.find(x => x.key === k)?.label || k)
    .slice(0, 4)
  parts.push(`参数/数据源: ${fieldLabels.join('/') || '默认字段'}`)
  return parts.slice(0, Math.max(1, maxParts))
}

export const getTradeDisplayLines = (snapshot) => {
  const s = normalizeTradeSnapshot(snapshot)
  const fieldLabels = (s.dataBinding.fields || [])
    .map(k => STOCK_FIELD_OPTIONS.find(x => x.key === k)?.label || k)
    .slice(0, 8)

  const paramEntries = Object.entries(s.params || {})
    .map(([k, p]) => `${PARAM_LABEL_MAP[k] || k}：默认${p?.value ?? '--'}，范围[${p?.min ?? '--'}, ${p?.max ?? '--'}]`)
    .slice(0, 6)

  return [
    `买入条件：${conditionListToHuman(s.entry.conditions) || '未设置'}（${s.entry.triggerMode === 'intraday' ? '盘中触发' : '收盘触发'}）`,
    `卖出条件：${conditionListToHuman(s.exit.conditions) || '未设置'}`,
    `止盈止损：止盈${s.exit.takeProfitPct ?? '--'}% / 止损${s.exit.stopLossPct ?? '--'}% / 退出信号：${s.exit.exitSignal || '未设置'}`,
    `仓位管理：初始${s.position.initialValue ?? '--'}% / 上限${s.position.maxPositionPct ?? '--'}% / 加仓${s.position.addPositionMaxPct ?? '--'}%`,
    `风控约束：最大回撤${s.risk.maxDrawdownPct ?? '--'}% / 单笔亏损${s.risk.maxSingleLossPct ?? '--'}% / 日内${s.risk.maxTradesPerDay ?? '--'}次`,
    `参数设置：${paramEntries.join('；') || '未设置'}`,
    `数据绑定：${fieldLabels.join('、') || '默认字段'}`,
    `策略类型：${STRATEGY_TYPE_LABEL[s.metadata.strategyType] || s.metadata.strategyType}/${s.metadata.marketScope}/${s.metadata.instrumentType}/${s.metadata.timeframe}`
  ]
}

export const getTradeDisplayEntries = (snapshot) => {
  const s = normalizeTradeSnapshot(snapshot)
  const triggerText = s.entry.triggerMode === 'intraday' ? '盘中触发' : '收盘触发'
  const buyText = conditionListToHuman(s.entry.conditions) || '未设置'
  const sellText = conditionListToHuman(s.exit.conditions) || '未设置'

  return [
    {
      key: '买卖条件',
      value: `触发方式：${triggerText}；买入条件：${buyText}；卖出条件：${sellText}`
    },
    {
      key: '风险和仓位',
      value: `止损：${s.exit.stopLossPct ?? '--'}%；止盈：${s.exit.takeProfitPct ?? '--'}%；仓位上限：${s.position.maxPositionPct ?? '--'}%`
    }
  ]
}
