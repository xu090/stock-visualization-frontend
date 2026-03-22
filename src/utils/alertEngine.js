import { evaluateTradeStrategyForQuote } from '@/utils/tradeEngine'

const toNumber = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const signChanged = (prev, next) => {
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return false
  if (prev === 0 || next === 0) return false
  return (prev > 0 && next < 0) || (prev < 0 && next > 0)
}

const buildSignature = (items = []) => items.map(x => x.code).sort().join('|')

const pushItem = (items, code, text, level = 'medium') => {
  items.push({ code, text, level })
}

export const evaluateSelectSnapshotMatch = (snapshot, metrics = {}) => {
  const filters = snapshot?.filters || {}
  const fails = []
  const netInflowYi = toNumber(metrics.netInflow) / 1e8
  const amountYi = toNumber(metrics.amount) / 1e8

  if (filters.minChange != null && toNumber(metrics.change, NaN) < Number(filters.minChange)) fails.push('change below threshold')
  if (filters.maxChange != null && toNumber(metrics.change, NaN) > Number(filters.maxChange)) fails.push('change above limit')
  if (filters.minNetInflowY != null && netInflowYi < Number(filters.minNetInflowY)) fails.push('net inflow below threshold')
  if (filters.maxNetInflowY != null && netInflowYi > Number(filters.maxNetInflowY)) fails.push('net inflow above limit')
  if (filters.minAmountY != null && amountYi < Number(filters.minAmountY)) fails.push('amount below threshold')
  if (filters.maxAmountY != null && amountYi > Number(filters.maxAmountY)) fails.push('amount above limit')
  if (filters.minVolRatio != null && toNumber(metrics.volRatio, NaN) < Number(filters.minVolRatio)) fails.push('volume ratio below threshold')
  if (filters.maxVolRatio != null && toNumber(metrics.volRatio, NaN) > Number(filters.maxVolRatio)) fails.push('volume ratio above limit')
  if (filters.minUpRatio != null && toNumber(metrics.upRatio, NaN) < Number(filters.minUpRatio)) fails.push('up ratio below threshold')
  if (filters.maxUpRatio != null && toNumber(metrics.upRatio, NaN) > Number(filters.maxUpRatio)) fails.push('up ratio above limit')
  if (filters.minStrength != null && toNumber(metrics.strength, NaN) < Number(filters.minStrength)) fails.push('strength below threshold')
  if (filters.minSpike5m != null && toNumber(metrics.spike5m, NaN) < Number(filters.minSpike5m)) fails.push('spike heat below threshold')
  if (filters.maxVolatility != null && toNumber(metrics.volatility, NaN) > Number(filters.maxVolatility)) fails.push('volatility above limit')
  if (filters.maxDrawdown20d != null && toNumber(metrics.drawdown20d, NaN) < Number(filters.maxDrawdown20d)) fails.push('drawdown weaker than required')

  return {
    matched: fails.length === 0,
    fails
  }
}

export const evaluateStockAlert = ({ quote = {}, baseline = null, tradeSnapshot = null } = {}) => {
  const items = []
  const changePercent = toNumber(quote.changePercent ?? quote.change)
  const netInflow = toNumber(quote.netInflow)
  const mainInflow = toNumber(quote.mainInflow)
  const baselineChange = toNumber(baseline?.quoteBaseline?.changePercent ?? baseline?.quoteBaseline?.change, NaN)
  const prevNetInflow = toNumber(baseline?.quoteBaseline?.netInflow, NaN)
  const prevMainInflow = toNumber(baseline?.quoteBaseline?.mainInflow, NaN)

  if (signChanged(baselineChange, changePercent)) {
    pushItem(items, 'price-reversal', changePercent >= 0 ? '价格由跌转涨' : '价格由涨转跌', 'high')
  }
  if (signChanged(prevNetInflow, netInflow)) {
    pushItem(items, 'net-inflow-flip', netInflow >= 0 ? '净流入由流出转流入' : '净流入由流入转流出', 'high')
  }
  if (signChanged(prevMainInflow, mainInflow)) {
    pushItem(items, 'main-inflow-flip', mainInflow >= 0 ? '主力资金由流出转流入' : '主力资金由流入转流出', 'high')
  }

  let tradeEval = null
  if (tradeSnapshot) {
    tradeEval = evaluateTradeStrategyForQuote(tradeSnapshot, quote || {})
    if (tradeEval.action !== 'buy') {
      pushItem(items, 'trade-drift', '策略偏离', 'medium')
    }
  }

  const level = items.some(x => x.level === 'high') ? 'high' : (items.length ? 'medium' : 'none')
  return {
    level,
    items,
    summary: items.slice(0, 2).map(x => x.text).join('; '),
    signature: buildSignature(items),
    tradeEval
  }
}

export const evaluateConceptAlert = ({ metrics = {}, baseline = null } = {}) => {
  const items = []
  const change = toNumber(metrics.change)
  const netInflow = toNumber(metrics.netInflow)
  const baselineChange = toNumber(baseline?.metricsBaseline?.change, NaN)
  const prevNetInflow = toNumber(baseline?.metricsBaseline?.netInflow, NaN)

  if (signChanged(baselineChange, change)) {
    pushItem(items, 'concept-reversal', change >= 0 ? '概念由跌转涨' : '概念由涨转跌', 'high')
  }
  if (signChanged(prevNetInflow, netInflow)) pushItem(items, 'concept-inflow-flip', netInflow >= 0 ? '概念资金由流出转流入' : '概念资金由流入转流出', 'high')

  const selectMatch = evaluateSelectSnapshotMatch(baseline?.selectSnapshot, {
    ...metrics,
    volatility: metrics.volatility ?? metrics.rtVolatility,
    drawdown20d: metrics.drawdown20d ?? metrics.rtDrawdown20d
  })
  if (baseline?.selectSnapshot && !selectMatch.matched) {
    pushItem(items, 'select-drift', '策略偏离', 'high')
  }

  const level = items.some(x => x.level === 'high') ? 'high' : (items.length ? 'medium' : 'none')
  return {
    level,
    items,
    summary: items.slice(0, 2).map(x => x.text).join('; '),
    signature: buildSignature(items),
    selectMatch
  }
}
