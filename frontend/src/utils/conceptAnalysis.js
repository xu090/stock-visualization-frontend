function asNum(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeCode(raw) {
  if (raw == null) return ''
  return String(raw).trim().replace(/\.(SZ|SH|BJ)$/i, '').replace(/^(sz|sh|bj)/i, '')
}

function emptySeries() {
  return {
    dates: [],
    close: [],
    ma5: [],
    ma10: [],
    ma20: [],
    ma30: []
  }
}

function normalizeSeries(series = {}) {
  const dates = Array.isArray(series.dates) ? series.dates : []
  const close = Array.isArray(series.close) ? series.close.map(value => (value == null ? null : asNum(value, null))) : []
  return {
    dates,
    close,
    ma5: Array.isArray(series.ma5) ? series.ma5.map(value => (value == null ? null : asNum(value, null))) : [],
    ma10: Array.isArray(series.ma10) ? series.ma10.map(value => (value == null ? null : asNum(value, null))) : [],
    ma20: Array.isArray(series.ma20) ? series.ma20.map(value => (value == null ? null : asNum(value, null))) : [],
    ma30: Array.isArray(series.ma30) ? series.ma30.map(value => (value == null ? null : asNum(value, null))) : [],
  }
}

function normalizeMaPattern(value = {}) {
  return {
    key: value.key || 'mixed',
    label: value.label || '暂无数据',
    type: value.type || 'info',
  }
}

function normalizeAnalysisStock(row = {}, baseStock = {}) {
  const code = normalizeCode(row.code || baseStock.code)
  return {
    ...baseStock,
    ...row,
    code,
    name: row.name || baseStock.name || code,
    history: normalizeSeries(row.history),
    correlation: asNum(row.correlation, 0),
    correlationLabel: row.correlationLabel || '暂无数据',
    correlationType: row.correlationType || 'info',
    correlationCategory: row.correlationCategory || 'neutral',
    beta: asNum(row.beta, 0),
    rSquared: asNum(row.rSquared, 0),
    agreementRatio: asNum(row.agreementRatio, 0),
    trackingError: asNum(row.trackingError, 0),
    trackingErrorRatio: asNum(row.trackingErrorRatio, 0),
    excessReturn5d: asNum(row.excessReturn5d, 0),
    maPattern: row.maPattern || '暂无数据',
    maPatternType: row.maPatternType || 'info',
    maPatternKey: row.maPatternKey || 'mixed',
    trendDirection: row.trendDirection || 'flat',
    trendLabel: row.trendLabel || '震荡',
    roleLabel: row.roleLabel || '暂无数据',
    recentChangePct: asNum(row.recentChangePct, 0),
  }
}

export function buildConceptAnalysisPayload(concept, stocks = [], options = {}) {
  const analysisData = options.analysisData || null
  const stockMap = new Map((stocks || []).map(item => [normalizeCode(item.code), item]))
  const analysisStocks = Array.isArray(analysisData?.stocks) ? analysisData.stocks : []

  return {
    id: analysisData?.id || concept?.id || '',
    name: analysisData?.name || concept?.name || '',
    days: asNum(analysisData?.days, asNum(options.days, 30)),
    conceptDirection: analysisData?.conceptDirection || 'flat',
    conceptChangePct: asNum(analysisData?.conceptChangePct, 0),
    conceptMaPattern: normalizeMaPattern(analysisData?.conceptMaPattern),
    conceptSeries: normalizeSeries(analysisData?.conceptSeries || emptySeries()),
    stocks: analysisStocks.map(row => normalizeAnalysisStock(row, stockMap.get(normalizeCode(row.code)) || {})),
  }
}

export function buildConceptCompareSeries(payload, selectedCode) {
  const selected = (payload?.stocks || []).find(item => item.code === normalizeCode(selectedCode)) || payload?.stocks?.[0] || null
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
    conceptClose: payload.conceptSeries.close,
    conceptMa10: payload.conceptSeries.ma10,
    stockClose: selected.history.close,
    stockMa10: selected.history.ma10
  }
}
