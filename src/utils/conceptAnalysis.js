function hashNum(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function round(n, d = 2) {
  const num = Number(n)
  if (!Number.isFinite(num)) return 0
  const p = Math.pow(10, d)
  return Math.round(num * p) / p
}

function mean(list = []) {
  if (!list.length) return 0
  return list.reduce((sum, n) => sum + Number(n || 0), 0) / list.length
}

function calcMa(list = [], period = 5) {
  return list.map((_, index) => {
    if (index + 1 < period) return null
    const window = list.slice(index + 1 - period, index + 1)
    return round(mean(window), 2)
  })
}

function pearsonCorrelation(xs = [], ys = []) {
  const size = Math.min(xs.length, ys.length)
  if (size < 2) return 0

  const xMean = mean(xs.slice(0, size))
  const yMean = mean(ys.slice(0, size))

  let numerator = 0
  let xDenominator = 0
  let yDenominator = 0

  for (let i = 0; i < size; i++) {
    const dx = Number(xs[i]) - xMean
    const dy = Number(ys[i]) - yMean
    numerator += dx * dy
    xDenominator += dx * dx
    yDenominator += dy * dy
  }

  const denominator = Math.sqrt(xDenominator * yDenominator)
  if (!denominator) return 0
  return round(numerator / denominator, 4)
}

function formatDayLabel(offset) {
  const date = new Date()
  date.setDate(date.getDate() - offset)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${month}-${day}`
}

function generateTrendSeries(seed, days = 30, options = {}) {
  const h = hashNum(seed)
  const base = options.base ?? (80 + (h % 900) / 10)
  const slope = options.slope ?? ((((h >> 2) % 240) - 120) / 900)
  const wave = options.wave ?? (((h >> 3) % 7) + 3)
  const drift = options.drift ?? ((((h >> 5) % 200) - 100) / 120)

  const close = []
  const dates = []
  let price = base

  for (let i = days - 1; i >= 0; i--) {
    const dayIndex = days - 1 - i
    const periodic = Math.sin((dayIndex + (h % 5)) / wave) * (1 + (h % 3) * 0.35)
    const noise = (((h >> (dayIndex % 16)) % 13) - 6) * 0.08
    price = Math.max(5, price + slope + periodic * 0.45 + noise + drift * 0.02)
    close.push(round(price, 2))
    dates.push(formatDayLabel(i))
  }

  return {
    dates,
    close,
    ma5: calcMa(close, 5),
    ma10: calcMa(close, 10),
    ma20: calcMa(close, 20)
  }
}

function buildStockSeriesFromConcept(conceptSeries, stockSeed) {
  const h = hashNum(stockSeed)
  const closes = conceptSeries.close.map((conceptClose, index) => {
    const amplitude = (((h >> (index % 12)) % 11) - 5) * 0.012
    const periodic = Math.cos((index + (h % 7)) / (3 + (h % 4))) * 0.018
    const bias = (((h >> 4) % 17) - 8) * 0.002
    const multiplier = 1 + amplitude + periodic + bias
    const scaled = conceptClose * (0.72 + (h % 40) / 100) * multiplier
    return round(Math.max(3, scaled), 2)
  })

  return {
    dates: conceptSeries.dates.slice(),
    close: closes,
    ma5: calcMa(closes, 5),
    ma10: calcMa(closes, 10),
    ma20: calcMa(closes, 20)
  }
}

function classifyCorrelation(correlation) {
  if (correlation >= 0.8) {
    return { key: 'strong-positive', label: '正相关', type: 'danger' }
  }
  if (correlation >= 0.35) {
    return { key: 'weak-positive', label: '弱相关', type: 'warning' }
  }
  if (correlation > -0.35) {
    return { key: 'neutral', label: '不相关', type: 'info' }
  }
  return { key: 'negative', label: '负相关', type: 'success' }
}

function classifyTrendDirection(series = []) {
  if (!series.length) return 'flat'
  const start = Number(series[0]) || 0
  const end = Number(series[series.length - 1]) || 0
  const pct = start ? ((end - start) / start) * 100 : 0
  if (pct > 2) return 'up'
  if (pct < -2) return 'down'
  return 'flat'
}

function classifyMaPattern(series) {
  const last = series.close.length - 1
  const ma5 = Number(series.ma5[last])
  const ma10 = Number(series.ma10[last])
  const ma20 = Number(series.ma20[last])
  const prev5 = Number(series.ma5[last - 1])
  const prev10 = Number(series.ma10[last - 1])

  if ([ma5, ma10, ma20].every(Number.isFinite)) {
    if (ma5 > ma10 && ma10 > ma20) {
      return { key: 'bullish-stack', label: '多头排列', type: 'danger' }
    }
    if (ma5 < ma10 && ma10 < ma20) {
      return { key: 'bearish-stack', label: '空头排列', type: 'success' }
    }
    if (Number.isFinite(prev5) && Number.isFinite(prev10) && prev5 <= prev10 && ma5 > ma10) {
      return { key: 'golden-cross', label: '黄金交叉', type: 'warning' }
    }
    if (Number.isFinite(prev5) && Number.isFinite(prev10) && prev5 >= prev10 && ma5 < ma10) {
      return { key: 'death-cross', label: '死亡交叉', type: 'info' }
    }
  }

  return { key: 'mixed', label: '均线缠绕', type: 'info' }
}

function classifyRole({ correlation, stockChange, conceptChange }) {
  if (correlation >= 0.8 && stockChange >= conceptChange) return '核心联动股'
  if (stockChange - conceptChange >= 3) return '领涨股'
  if (correlation <= -0.35 || stockChange * conceptChange < 0) return '背离股'
  return '跟随股'
}

function safeLast(list = []) {
  return list.length ? list[list.length - 1] : null
}

function normalizeSeriesToBase100(series = []) {
  const base = Number(series[0]) || 1
  return series.map(v => round((Number(v) / base) * 100, 2))
}

export function buildConceptAnalysisPayload(concept, stocks = [], options = {}) {
  const days = Number(options.days) || 30
  const conceptSeed = `${concept?.id || concept?.name || 'concept'}:${days}`
  const conceptSeries = generateTrendSeries(conceptSeed, days, {
    base: 900 + (hashNum(conceptSeed) % 260),
    slope: ((((hashNum(conceptSeed) >> 2) % 120) - 50) / 40)
  })

  const conceptDirection = classifyTrendDirection(conceptSeries.close)
  const conceptChangePct = round(((safeLast(conceptSeries.close) - conceptSeries.close[0]) / conceptSeries.close[0]) * 100, 2)

  const stockAnalysisList = (stocks || []).map((stock) => {
    const series = buildStockSeriesFromConcept(conceptSeries, `${conceptSeed}:${stock.code}`)
    const stockChangePct = round(((safeLast(series.close) - series.close[0]) / series.close[0]) * 100, 2)
    const correlation = pearsonCorrelation(conceptSeries.close, series.close)
    const correlationMeta = classifyCorrelation(correlation)
    const maPattern = classifyMaPattern(series)
    const direction = classifyTrendDirection(series.close)
    const roleLabel = classifyRole({
      correlation,
      stockChange: stockChangePct,
      conceptChange: conceptChangePct
    })

    return {
      ...stock,
      history: series,
      correlation,
      correlationLabel: correlationMeta.label,
      correlationType: correlationMeta.type,
      correlationCategory: correlationMeta.key,
      maPattern: maPattern.label,
      maPatternType: maPattern.type,
      maPatternKey: maPattern.key,
      trendDirection: direction,
      trendLabel: direction === 'up' ? '上涨' : direction === 'down' ? '下跌' : '震荡',
      roleLabel,
      recentChangePct: stockChangePct
    }
  }).sort((a, b) => {
    if (b.correlation !== a.correlation) return b.correlation - a.correlation
    return (b.recentChangePct || 0) - (a.recentChangePct || 0)
  })

  return {
    days,
    conceptSeries,
    conceptDirection,
    conceptChangePct,
    conceptMaPattern: classifyMaPattern(conceptSeries),
    conceptNormalized: normalizeSeriesToBase100(conceptSeries.close),
    stocks: stockAnalysisList
  }
}

export function buildConceptCompareSeries(payload, selectedCode) {
  const selected = (payload?.stocks || []).find(item => item.code === selectedCode) || payload?.stocks?.[0] || null
  if (!selected) {
    return {
      selected: null,
      dates: payload?.conceptSeries?.dates || [],
      conceptClose: [],
      conceptMa10: [],
      stockClose: [],
      stockMa10: []
    }
  }

  return {
    selected,
    dates: payload.conceptSeries.dates,
    conceptClose: payload.conceptNormalized,
    conceptMa10: normalizeSeriesToBase100(payload.conceptSeries.ma10.map(v => v ?? payload.conceptSeries.close[0])),
    stockClose: normalizeSeriesToBase100(selected.history.close),
    stockMa10: normalizeSeriesToBase100(selected.history.ma10.map(v => v ?? selected.history.close[0]))
  }
}
