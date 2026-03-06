import { normalizeTradeSnapshot } from '@/utils/tradeStrategy'

const toNumber = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const buildQuoteContext = (quote = {}) => ({
  ...quote,
  changePercent: toNumber(quote.changePercent ?? quote.change),
  changeAmount: toNumber(quote.changeAmount),
  price: toNumber(quote.price ?? quote.close),
  close: toNumber(quote.close ?? quote.price),
  volume: toNumber(quote.volume),
  amount: toNumber(quote.amount),
  turnover: toNumber(quote.turnover),
  amplitude: toNumber(quote.amplitude),
  volumeRatio: toNumber(quote.volumeRatio ?? quote.volRatio),
  netInflow: toNumber(quote.netInflow),
  mainInflow: toNumber(quote.mainInflow),
  orderImbalance: toNumber(quote.orderImbalance),
  mktCap: toNumber(quote.mktCap),
  ma5: toNumber(quote.ma5),
  ma10: toNumber(quote.ma10),
  ma20: toNumber(quote.ma20),
  ma60: toNumber(quote.ma60),
  rsi14: toNumber(quote.rsi14),
  atr14Pct: toNumber(quote.atr14Pct),
  volatility20d: toNumber(quote.volatility20d),
  drawdown20d: toNumber(quote.drawdown20d),
  relativeStrength20d: toNumber(quote.relativeStrength20d)
})

const compare = (left, op, right) => {
  switch (op) {
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '==':
      return left === right
    case '!=':
      return left !== right
    default:
      return false
  }
}

const evalCondition = (cond = {}, ctx = {}) => {
  const field = cond.field || 'changePercent'
  const left = toNumber(ctx[field], NaN)
  const right = toNumber(cond.value, NaN)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  return compare(left, cond.op || '>=', right)
}

const evalConditionList = (conditions = [], ctx = {}) => {
  if (!Array.isArray(conditions) || !conditions.length) return false
  return conditions.reduce((acc, cond, idx) => {
    const passed = evalCondition(cond, ctx)
    if (idx === 0) return passed
    return String(cond?.connector || 'AND').toUpperCase() === 'OR' ? acc || passed : acc && passed
  }, false)
}

export const evaluateTradeStrategyForQuote = (snapshot, quote) => {
  const normalized = normalizeTradeSnapshot(snapshot)
  const ctx = buildQuoteContext(quote)

  const passEntry = evalConditionList(normalized.entry.conditions, ctx)
  const passExit = evalConditionList(normalized.exit.conditions, ctx)
  const action = passExit ? 'sell' : (passEntry ? 'buy' : 'hold')

  const entryTotal = normalized.entry.conditions?.length || 0
  const exitTotal = normalized.exit.conditions?.length || 0
  const matchedEntry = (normalized.entry.conditions || []).filter(c => evalCondition(c, ctx)).length
  const matchedExit = (normalized.exit.conditions || []).filter(c => evalCondition(c, ctx)).length
  const score = Math.round((((matchedEntry + (exitTotal - matchedExit)) / Math.max(1, entryTotal + exitTotal)) * 100))

  const reason = [
    `入场匹配 ${matchedEntry}/${entryTotal}`,
    `出场匹配 ${matchedExit}/${exitTotal}`,
    `触发方式 ${normalized.entry.triggerMode === 'intraday' ? '盘中' : '收盘'}`
  ]

  return {
    action,
    passEntry,
    passExit,
    score,
    reason
  }
}

