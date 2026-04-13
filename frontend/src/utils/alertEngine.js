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

// Baseline comes from the value captured when the item was favorited/added.
// Later, with real-time data, keep feeding the latest change value here.
const pushDirectionAlert = (items, baselineValue, currentValue) => {
  if (!signChanged(baselineValue, currentValue)) return
  pushItem(items, 'price-direction', currentValue > 0 ? 'price-up' : 'price-down', 'high')
}

export const evaluateStockAlert = ({ quote = {}, baseline = null } = {}) => {
  const items = []
  const currentChange = toNumber(quote.changePercent ?? quote.change, NaN)
  const baselineChange = toNumber(
    baseline?.quoteBaseline?.changePercent ?? baseline?.quoteBaseline?.change,
    NaN
  )

  pushDirectionAlert(items, baselineChange, currentChange)

  const level = items.some(x => x.level === 'high') ? 'high' : (items.length ? 'medium' : 'none')
  return {
    level,
    items,
    summary: items.map(x => x.text).join('; '),
    signature: buildSignature(items)
  }
}

export const evaluateConceptAlert = ({ metrics = {}, baseline = null } = {}) => {
  const items = []
  const currentChange = toNumber(metrics.change, NaN)
  const baselineChange = toNumber(baseline?.metricsBaseline?.change, NaN)

  pushDirectionAlert(items, baselineChange, currentChange)

  const level = items.some(x => x.level === 'high') ? 'high' : (items.length ? 'medium' : 'none')
  return {
    level,
    items,
    summary: items.map(x => x.text).join('; '),
    signature: buildSignature(items)
  }
}
