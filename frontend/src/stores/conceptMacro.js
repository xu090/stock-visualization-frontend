import { defineStore } from 'pinia'
import { useConceptStore } from '@/stores/concept'

const DEFAULT_WINDOW_DAYS = 20

function macroPointsForDays(days = DEFAULT_WINDOW_DAYS) {
  const normalizedDays = Math.min(Math.max(Number(days) || DEFAULT_WINDOW_DAYS, 1), 120)
  return Math.min(1000, Math.max(60, normalizedDays * 24))
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value))
}

function lastFinite(list = []) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const value = Number(list[i])
    if (Number.isFinite(value)) return value
  }
  return 0
}

function quantile(values = [], q = 0.5) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return 0
  const pos = (clean.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = clean[base + 1]
  return next == null ? clean[base] : clean[base] + rest * (next - clean[base])
}

function median(values = []) {
  return quantile(values, 0.5)
}

function robustScale(matrix = []) {
  if (!matrix.length) return []
  const width = matrix[0]?.length || 0
  const centers = []
  const scales = []

  for (let col = 0; col < width; col += 1) {
    const values = matrix.map(row => Number(row[col])).filter(Number.isFinite)
    const center = median(values)
    const q1 = quantile(values, 0.25)
    const q3 = quantile(values, 0.75)
    const iqr = q3 - q1
    const mad = median(values.map(value => Math.abs(value - center)))
    centers[col] = center
    scales[col] = Math.abs(iqr) > 1e-9 ? iqr : Math.abs(mad) > 1e-9 ? mad * 1.4826 : 1
  }

  return matrix.map(row => row.map((value, col) => {
    const scaled = (Number(value || 0) - centers[col]) / scales[col]
    return Math.max(-6, Math.min(6, scaled))
  }))
}

function normalizeCurveRows(curve = []) {
  return (curve || [])
    .filter(item => item && item.ts && isFiniteNumber(item.close))
    .map(item => ({
      ts: Number(item.ts),
      close: Number(item.close),
      change: isFiniteNumber(item.change) ? Number(item.change) : 0,
      amount: isFiniteNumber(item.amount) ? Number(item.amount) : 0,
      weightedIndex: isFiniteNumber(item.weightedIndex) ? Number(item.weightedIndex) : null,
      equalIndex: isFiniteNumber(item.equalIndex) ? Number(item.equalIndex) : null,
      weightedReturn: isFiniteNumber(item.weightedReturn) ? Number(item.weightedReturn) : 0,
      equalReturn: isFiniteNumber(item.equalReturn) ? Number(item.equalReturn) : 0,
      indexSpread: isFiniteNumber(item.indexSpread) ? Number(item.indexSpread) : 0,
      upRatio: isFiniteNumber(item.upRatio) ? Number(item.upRatio) : null
    }))
    .sort((a, b) => a.ts - b.ts)
}

function buildAxisTimestamps(curves, points) {
  const all = new Set()
  ;(curves || []).forEach(curve => {
    curve.forEach(item => {
      if (item?.ts) all.add(Number(item.ts))
    })
  })
  return [...all].sort((a, b) => a - b).slice(-points)
}

function buildAlignedCloseSeries(curve = [], axisTimestamps = []) {
  if (!curve.length || !axisTimestamps.length) return []

  const result = []
  let rowIndex = 0
  let latestClose = null

  for (const axisTs of axisTimestamps) {
    while (rowIndex < curve.length && Number(curve[rowIndex].ts) <= axisTs) {
      latestClose = Number(curve[rowIndex].close)
      rowIndex += 1
    }
    result.push(Number.isFinite(latestClose) ? latestClose : null)
  }

  return result
}

function buildAlignedFieldSeries(curve = [], axisTimestamps = [], field = 'close') {
  if (!curve.length || !axisTimestamps.length) return []

  const result = []
  let rowIndex = 0
  let latestValue = null

  for (const axisTs of axisTimestamps) {
    while (rowIndex < curve.length && Number(curve[rowIndex].ts) <= axisTs) {
      const value = Number(curve[rowIndex][field])
      latestValue = Number.isFinite(value) ? value : latestValue
      rowIndex += 1
    }
    result.push(Number.isFinite(latestValue) ? latestValue : null)
  }

  return result
}

function toPercentSeries(closeSeries = []) {
  const base = closeSeries.find(value => isFiniteNumber(value) && Number(value) > 0)
  if (!isFiniteNumber(base) || Number(base) <= 0) return closeSeries.map(() => null)

  return closeSeries.map(value => {
    if (!isFiniteNumber(value)) return null
    return round2(((Number(value) - Number(base)) / Number(base)) * 100)
  })
}

function avgSeries(seriesList = []) {
  if (!seriesList.length) return []
  const len = Math.max(...seriesList.map(item => item.length))
  const out = new Array(len).fill(null)

  for (let index = 0; index < len; index += 1) {
    const values = seriesList
      .map(series => Number(series[index]))
      .filter(Number.isFinite)
    out[index] = values.length ? round2(values.reduce((sum, item) => sum + item, 0) / values.length) : null
  }

  return out
}

function fillNullSeries(series = []) {
  const result = []
  let latest = null
  for (const value of series) {
    const number = Number(value)
    if (Number.isFinite(number)) latest = number
    result.push(Number.isFinite(latest) ? latest : 0)
  }
  const first = result.find(Number.isFinite) ?? 0
  return result.map(value => (Number.isFinite(value) ? value : first))
}

function diffSeries(series = []) {
  const values = fillNullSeries(series)
  const out = []
  for (let i = 1; i < values.length; i += 1) out.push(values[i] - values[i - 1])
  return out
}

function stdev(values = []) {
  const clean = values.map(Number).filter(Number.isFinite)
  if (clean.length < 2) return 0
  const avg = clean.reduce((sum, item) => sum + item, 0) / clean.length
  const variance = clean.reduce((sum, item) => sum + (item - avg) ** 2, 0) / (clean.length - 1)
  return Math.sqrt(Math.max(variance, 0))
}

function linearSlope(series = []) {
  const values = fillNullSeries(series)
  if (values.length < 2) return 0
  const xMean = (values.length - 1) / 2
  const yMean = values.reduce((sum, item) => sum + item, 0) / values.length
  let numerator = 0
  let denominator = 0
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean)
    denominator += (index - xMean) ** 2
  })
  return denominator ? numerator / denominator : 0
}

function maxDrawdown(series = []) {
  const values = fillNullSeries(series)
  let peak = values[0] ?? 0
  let drawdown = 0
  values.forEach(value => {
    peak = Math.max(peak, value)
    drawdown = Math.min(drawdown, value - peak)
  })
  return drawdown
}

function recoveryFromLow(series = []) {
  const values = fillNullSeries(series)
  if (!values.length) return 0
  return values[values.length - 1] - Math.min(...values)
}

function pearsonDistance(a = [], b = []) {
  const xs = fillNullSeries(a)
  const ys = fillNullSeries(b)
  const size = Math.min(xs.length, ys.length)
  if (size < 2) return 1
  const xValues = xs.slice(-size)
  const yValues = ys.slice(-size)
  const xMean = xValues.reduce((sum, item) => sum + item, 0) / size
  const yMean = yValues.reduce((sum, item) => sum + item, 0) / size
  let numerator = 0
  let xDen = 0
  let yDen = 0
  for (let i = 0; i < size; i += 1) {
    const dx = xValues[i] - xMean
    const dy = yValues[i] - yMean
    numerator += dx * dy
    xDen += dx * dx
    yDen += dy * dy
  }
  if (xDen <= 1e-9 || yDen <= 1e-9) return 1
  const corr = numerator / Math.sqrt(xDen * yDen)
  return Math.max(0, Math.min(2, 1 - corr))
}

function euclidean(a = [], b = []) {
  const size = Math.min(a.length, b.length)
  if (!size) return 0
  let sum = 0
  for (let i = 0; i < size; i += 1) sum += (Number(a[i] || 0) - Number(b[i] || 0)) ** 2
  return Math.sqrt(sum) / Math.sqrt(size)
}

function matVec(matrix = [], vector = []) {
  return matrix.map(row => row.reduce((sum, value, index) => sum + value * Number(vector[index] || 0), 0))
}

function normalizeVector(vector = []) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return norm > 1e-9 ? vector.map(value => value / norm) : vector.map(() => 0)
}

function pcaProject(matrix = [], maxComponents = 4) {
  if (matrix.length < 3 || !matrix[0]?.length) return matrix
  const rows = matrix.length
  const cols = matrix[0].length
  const components = Math.min(maxComponents, cols, rows - 1)
  if (components >= cols) return matrix

  let covariance = Array.from({ length: cols }, () => new Array(cols).fill(0))
  for (let i = 0; i < cols; i += 1) {
    for (let j = i; j < cols; j += 1) {
      const value = matrix.reduce((sum, row) => sum + Number(row[i] || 0) * Number(row[j] || 0), 0) / Math.max(rows - 1, 1)
      covariance[i][j] = value
      covariance[j][i] = value
    }
  }

  const vectors = []
  for (let component = 0; component < components; component += 1) {
    let vector = normalizeVector(new Array(cols).fill(0).map((_, index) => (index === component ? 1 : 0.3)))
    for (let iter = 0; iter < 32; iter += 1) vector = normalizeVector(matVec(covariance, vector))
    const eigenValue = vector.reduce((sum, value, index) => sum + value * matVec(covariance, vector)[index], 0)
    if (!Number.isFinite(eigenValue) || Math.abs(eigenValue) <= 1e-9) break
    vectors.push(vector)
    covariance = covariance.map((row, i) => row.map((value, j) => value - eigenValue * vector[i] * vector[j]))
  }

  if (!vectors.length) return matrix
  return matrix.map(row => vectors.map(vector => row.reduce((sum, value, index) => sum + value * vector[index], 0)))
}

function formatAxisLabel(ts, axisTimestamps = []) {
  const value = Number(ts)
  if (!Number.isFinite(value) || value <= 0) return ''

  const date = new Date(value)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')

  const first = Number(axisTimestamps[0] || value)
  const sameDay = new Date(first).toDateString() === date.toDateString()
  return sameDay ? `${hours}:${minutes}` : `${month}-${day} ${hours}:${minutes}`
}

function buildFeatureVector(item = {}) {
  const weightedCurve = fillNullSeries(item.weightedCurve || [])
  const equalCurve = fillNullSeries(item.equalCurve || [])
  const spreadCurve = fillNullSeries(item.spreadCurve || [])
  const returns = diffSeries(weightedCurve)
  const end = lastFinite(weightedCurve)
  const equalEnd = lastFinite(equalCurve)
  const spreadEnd = lastFinite(spreadCurve)
  const recentBase = weightedCurve[Math.max(0, weightedCurve.length - 6)] ?? weightedCurve[0] ?? 0
  const recentReturn = end - recentBase

  return [
    end,
    equalEnd,
    spreadEnd,
    recentReturn,
    linearSlope(weightedCurve),
    linearSlope(equalCurve),
    maxDrawdown(weightedCurve),
    recoveryFromLow(weightedCurve),
    stdev(returns),
    Number(item.upRatio || 0),
    Math.log1p(Math.max(Number(item.amount || 0), 0)) / Math.log(10),
    Number(item.volatility || 0)
  ]
}

function buildDistanceMatrix(items = [], projectedFeatures = []) {
  const size = items.length
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0))
  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      const curveDistance = (
        pearsonDistance(items[i].weightedCurve, items[j].weightedCurve) * 0.65 +
        pearsonDistance(items[i].equalCurve, items[j].equalCurve) * 0.35
      )
      const featureDistance = euclidean(projectedFeatures[i], projectedFeatures[j])
      const distance = 0.6 * curveDistance + 0.4 * featureDistance
      matrix[i][j] = distance
      matrix[j][i] = distance
    }
  }
  return matrix
}

function nearestMedoid(index, medoids = [], distances = []) {
  let bestCluster = 0
  let bestDistance = Number.POSITIVE_INFINITY
  medoids.forEach((medoid, clusterIndex) => {
    const distance = distances[index][medoid]
    if (distance < bestDistance) {
      bestDistance = distance
      bestCluster = clusterIndex
    }
  })
  return bestCluster
}

function initializeMedoids(distances = [], k = 3) {
  const size = distances.length
  if (!size) return []
  const medoids = []
  let first = 0
  let bestAvg = Number.POSITIVE_INFINITY
  for (let i = 0; i < size; i += 1) {
    const avg = distances[i].reduce((sum, value) => sum + value, 0) / Math.max(size - 1, 1)
    if (avg < bestAvg) {
      bestAvg = avg
      first = i
    }
  }
  medoids.push(first)

  while (medoids.length < Math.min(k, size)) {
    let candidate = 0
    let farthest = -1
    for (let i = 0; i < size; i += 1) {
      if (medoids.includes(i)) continue
      const distance = Math.min(...medoids.map(medoid => distances[i][medoid]))
      if (distance > farthest) {
        farthest = distance
        candidate = i
      }
    }
    medoids.push(candidate)
  }

  return medoids
}

function assignClusters(distances = [], medoids = []) {
  return distances.map((_, index) => nearestMedoid(index, medoids, distances))
}

function updateMedoids(distances = [], assignments = [], k = 3) {
  const medoids = []
  for (let cluster = 0; cluster < k; cluster += 1) {
    const members = assignments
      .map((itemCluster, index) => (itemCluster === cluster ? index : null))
      .filter(item => item != null)
    if (!members.length) {
      medoids.push(null)
      continue
    }
    let bestMedoid = members[0]
    let bestCost = Number.POSITIVE_INFINITY
    members.forEach(candidate => {
      const cost = members.reduce((sum, member) => sum + distances[candidate][member], 0)
      if (cost < bestCost) {
        bestCost = cost
        bestMedoid = candidate
      }
    })
    medoids.push(bestMedoid)
  }
  return medoids
}

function repairEmptyMedoids(distances = [], medoids = [], assignments = []) {
  const used = new Set(medoids.filter(item => item != null))
  return medoids.map(medoid => {
    if (medoid != null) return medoid
    let candidate = 0
    let farthest = -1
    for (let i = 0; i < distances.length; i += 1) {
      if (used.has(i)) continue
      const cluster = assignments[i] ?? 0
      const ownMedoid = medoids[cluster]
      const distance = ownMedoid == null ? 0 : distances[i][ownMedoid]
      if (distance > farthest) {
        farthest = distance
        candidate = i
      }
    }
    used.add(candidate)
    return candidate
  })
}

function runKMedoids(distances = [], k = 3) {
  if (!distances.length) return { assignments: [], medoids: [] }
  let medoids = initializeMedoids(distances, k)
  let assignments = assignClusters(distances, medoids)

  for (let iter = 0; iter < 24; iter += 1) {
    let nextMedoids = updateMedoids(distances, assignments, medoids.length)
    nextMedoids = repairEmptyMedoids(distances, nextMedoids, assignments)
    const nextAssignments = assignClusters(distances, nextMedoids)
    if (nextMedoids.join(',') === medoids.join(',') && nextAssignments.join(',') === assignments.join(',')) break
    medoids = nextMedoids
    assignments = nextAssignments
  }

  return { assignments, medoids }
}

function clusterProfile(items = [], representativeCurve = []) {
  const avg = key => items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / Math.max(items.length, 1)
  return {
    end: lastFinite(representativeCurve),
    weighted: avg('weightedReturn'),
    equal: avg('equalReturn'),
    spread: avg('leaderSpread'),
    recent: avg('recentReturn'),
    slope: avg('slope'),
    equalSlope: avg('equalSlope'),
    drawdown: avg('maxDrawdown'),
    recovery: avg('recoveryFromLow'),
    volatility: avg('returnVolatility'),
    upRatio: avg('upRatio')
  }
}

// eslint-disable-next-line no-unused-vars
function nameFixedClusters(groups = []) {
  const labels = ['强势领涨', '修复跟随', '震荡中性', '弱势回撤']
  const remaining = groups.map((group, index) => ({ ...group, index }))
  const names = new Array(groups.length).fill('')

  const pickBest = (label, scorer) => {
    if (!remaining.length) return
    let bestIndex = 0
    let bestScore = Number.NEGATIVE_INFINITY
    remaining.forEach((group, index) => {
      const score = scorer(group.profile)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })
    const [picked] = remaining.splice(bestIndex, 1)
    names[picked.index] = label
  }

  pickBest('强势领涨', profile => profile.end + profile.excess * 1.2 + profile.slope * 8 + Math.max(profile.recent, 0))
  pickBest('弱势回撤', profile => -profile.end + Math.abs(Math.min(profile.drawdown, 0)) + Math.max(-profile.excess, 0) * 1.2)
  pickBest('修复跟随', profile => profile.recovery + Math.max(profile.recent, 0) + profile.slope * 5 - Math.abs(profile.end) * 0.2)
  remaining.forEach(group => {
    names[group.index] = '震荡中性'
  })

  return names.map((name, index) => name || labels[index] || '震荡中性')
}

function nameIndexClusters(groups = []) {
  return groups.map(group => {
    const profile = group.profile || {}
    const weighted = Number(profile.weighted || 0)
    const equal = Number(profile.equal || 0)
    const spread = Number(profile.spread || 0)

    if (weighted <= 0 && equal <= 0) return '弱势回落'
    if (weighted > 0 && equal > 0) return '共振走强'
    if (weighted > 0 && (equal <= 0 || spread > 0.2)) return '龙头拉动'
    return '弱势回落'
  })
}

function curveKeyByMode(curveMode = 'weighted') {
  if (curveMode === 'equal') return 'equalCurve'
  if (curveMode === 'spread') return 'spreadCurve'
  if (curveMode === 'relative') return 'relativeCurve'
  return 'weightedCurve'
}

function autoClusterCount(items = []) {
  return items.length > 1 ? 2 : 1
}

function clusterConcepts(items = [], curveMode = 'weighted', clusterCount = 'auto') {
  if (!items.length) return []
  if (items.length <= 2) {
    const curveKey = curveKeyByMode(curveMode)
    const representativeCurve = avgSeries(items.map(item => item[curveKey]))
    return [{
      id: 'cluster-1',
      name: '样本较少',
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        change: item.change,
        weightedReturn: item.weightedReturn,
        equalReturn: item.equalReturn,
        leaderSpread: item.leaderSpread,
        curve: item[curveKey]
      })),
      count: items.length,
      representativeCurve,
      avgChange: round2(items.reduce((sum, item) => sum + Number(item.weightedReturn || 0), 0) / items.length),
      avgEqualChange: round2(items.reduce((sum, item) => sum + Number(item.equalReturn || 0), 0) / items.length),
      avgSpread: round2(items.reduce((sum, item) => sum + Number(item.leaderSpread || 0), 0) / items.length)
    }]
  }

  const featureMatrix = items.map(item => item.features)
  const scaledFeatures = robustScale(featureMatrix)
  const projectedFeatures = pcaProject(scaledFeatures, 4)
  const distances = buildDistanceMatrix(items, projectedFeatures)
  const requestedK = clusterCount === 'auto'
    ? autoClusterCount(items)
    : Number(clusterCount)
  const targetK = Math.min(Math.max(Number.isFinite(requestedK) ? requestedK : autoClusterCount(items), 1), items.length)
  const result = runKMedoids(distances, targetK)
  const curveKey = curveKeyByMode(curveMode)
  const groups = new Map()

  result.assignments.forEach((cluster, index) => {
    if (!groups.has(cluster)) groups.set(cluster, [])
    groups.get(cluster).push(items[index])
  })

  const preparedGroups = [...groups.entries()]
    .map(([cluster, groupItems], index) => {
      const representativeCurve = avgSeries(groupItems.map(item => item[curveKey]))
      return {
        id: `cluster-${cluster + 1}`,
        index,
        profile: clusterProfile(groupItems, representativeCurve),
        items: groupItems.map(item => ({
          id: item.id,
          name: item.name,
          change: item.change,
          weightedReturn: item.weightedReturn,
          equalReturn: item.equalReturn,
          leaderSpread: item.leaderSpread,
          curve: item[curveKey]
        })),
        count: groupItems.length,
        representativeCurve,
        avgChange: round2(groupItems.reduce((sum, item) => sum + Number(item.weightedReturn || 0), 0) / groupItems.length),
        avgEqualChange: round2(groupItems.reduce((sum, item) => sum + Number(item.equalReturn || 0), 0) / groupItems.length),
        avgSpread: round2(groupItems.reduce((sum, item) => sum + Number(item.leaderSpread || 0), 0) / groupItems.length)
      }
    })
    .sort((a, b) => Number(b.avgChange || 0) - Number(a.avgChange || 0))

  const names = nameIndexClusters(preparedGroups)
  const namedGroups = preparedGroups.map((group, index) => {
    const rest = { ...group }
    delete rest.profile
    delete rest.index
    return {
      ...rest,
      name: `第${index + 1}类·${names[index]}`
    }
  })
  return namedGroups
}

export const useConceptMacroStore = defineStore('conceptMacro', {
  state: () => ({
    curveMode: 'weighted',
    windowDays: DEFAULT_WINDOW_DAYS,
    clusterCount: 'auto',
    selectedCategoryId: '',
    detailSearch: '',
    detailSort: 'changeDesc',
    macroById: {},
    loading: false,
    loaded: false,
    error: ''
  }),

  getters: {
    overviewItems() {
      const conceptStore = useConceptStore()
      return conceptStore.conceptOverviewAll || []
    },

    samplePoints() {
      return macroPointsForDays(this.windowDays)
    },

    rawCurveRows() {
      const result = {}

      ;(this.overviewItems || []).forEach(item => {
        const id = String(item?.id || '')
        if (!id) return
        const curve = normalizeCurveRows(this.macroById[id]?.curve || []).slice(-this.samplePoints)
        if (curve.length) result[id] = curve
      })

      return result
    },

    axisTimestamps() {
      return buildAxisTimestamps(Object.values(this.rawCurveRows || {}), this.samplePoints)
    },

    xAxisLabels() {
      return (this.axisTimestamps || []).map(ts => formatAxisLabel(ts, this.axisTimestamps))
    },

    conceptCurves() {
      const axisTimestamps = this.axisTimestamps || []
      const list = (this.overviewItems || []).map(item => {
        const id = String(item?.id || '')
        const rawCurve = this.rawCurveRows[id] || []
        if (!id || !rawCurve.length || !axisTimestamps.length) return null

        const alignedCloseSeries = buildAlignedCloseSeries(rawCurve, axisTimestamps)
        const weightedIndexSeries = buildAlignedFieldSeries(rawCurve, axisTimestamps, 'weightedIndex')
        const equalIndexSeries = buildAlignedFieldSeries(rawCurve, axisTimestamps, 'equalIndex')
        const weightedCurve = weightedIndexSeries.some(isFiniteNumber)
          ? toPercentSeries(weightedIndexSeries)
          : toPercentSeries(alignedCloseSeries)
        const equalCurve = equalIndexSeries.some(isFiniteNumber)
          ? toPercentSeries(equalIndexSeries)
          : toPercentSeries(alignedCloseSeries)
        const spreadCurve = weightedCurve.map((value, index) => {
          const weighted = Number(value)
          const equal = Number(equalCurve[index])
          if (!Number.isFinite(weighted) || !Number.isFinite(equal)) return null
          return round2(weighted - equal)
        })
        const weightedReturn = lastFinite(weightedCurve)
        const equalReturn = lastFinite(equalCurve)

        return {
          id,
          name: item.name,
          weightedCurve,
          equalCurve,
          spreadCurve,
          weightedReturn,
          equalReturn,
          leaderSpread: round2(weightedReturn - equalReturn),
          latestChange: Number(item.change || 0),
          amount: Number(item.amount || 0),
          upRatio: Number(item.upRatio || 0),
          volatility: Number(item.volatility || 0),
          drawdown20d: Number(item.drawdown20d || 0)
        }
      }).filter(Boolean)

      const benchmark = avgSeries(list.map(item => item.weightedCurve))
      const map = {}

      list.forEach(item => {
        map[item.id] = {
          ...item,
          relativeCurve: item.weightedCurve.map((value, index) => {
            const benchmarkValue = Number(benchmark[index])
            const currentValue = Number(value)
            if (!Number.isFinite(currentValue) || !Number.isFinite(benchmarkValue)) return null
            return round2(currentValue - benchmarkValue)
          })
        }
      })

      return map
    },

    categories() {
      const items = []
      ;(this.overviewItems || []).forEach(item => {
        const id = String(item?.id || '')
        const curve = this.conceptCurves[id]
        if (!curve) return

        const clusterItem = {
          id,
          name: item.name,
          change: Number(item.change || 0),
          amount: Number(item.amount || 0),
          upRatio: Number(item.upRatio || 0),
          volatility: Number(item.volatility || 0),
          drawdown20d: Number(item.drawdown20d || 0),
          weightedReturn: curve.weightedReturn,
          equalReturn: curve.equalReturn,
          leaderSpread: curve.leaderSpread,
          weightedCurve: curve.weightedCurve,
          equalCurve: curve.equalCurve,
          spreadCurve: curve.spreadCurve,
          relativeCurve: curve.relativeCurve
        }
        const features = buildFeatureVector(clusterItem)
        Object.assign(clusterItem, {
          features,
          periodReturn: features[0],
          equalPeriodReturn: features[1],
          leaderSpreadFeature: features[2],
          recentReturn: features[3],
          slope: features[4],
          equalSlope: features[5],
          maxDrawdown: features[6],
          recoveryFromLow: features[7],
          returnVolatility: features[8]
        })
        items.push(clusterItem)
      })

      return clusterConcepts(items, this.curveMode, this.clusterCount)
    },

    selectedCategory() {
      const all = this.categories || []
      return all.find(item => item.id === this.selectedCategoryId) || all[0] || null
    },

    categoryChartSeries() {
      return (this.categories || []).map(category => ({
        id: category.id,
        name: `${category.name} (${category.count})`,
        data: category.representativeCurve
      }))
    },

    detailItems() {
      const category = this.selectedCategory
      if (!category) return []

      let list = category.items.slice()
      const keyword = String(this.detailSearch || '').trim().toLowerCase()
      if (keyword) {
        list = list.filter(item => String(item.name || '').toLowerCase().includes(keyword))
      }

      if (this.detailSort === 'changeAsc') {
        list.sort((a, b) => Number(a.weightedReturn || 0) - Number(b.weightedReturn || 0))
      } else if (this.detailSort === 'nameAsc') {
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      } else if (this.detailSort === 'spreadDesc') {
        list.sort((a, b) => Number(b.leaderSpread || 0) - Number(a.leaderSpread || 0))
      } else if (this.detailSort === 'equalDesc') {
        list.sort((a, b) => Number(b.equalReturn || 0) - Number(a.equalReturn || 0))
      } else {
        list.sort((a, b) => Number(b.weightedReturn || 0) - Number(a.weightedReturn || 0))
      }

      return list
    },

    detailChartSeries() {
      return (this.detailItems || []).map(item => ({
        id: item.id,
        name: item.name,
        data: item.curve
      }))
    }
  },

  actions: {
    async fetchMacroData() {
      const conceptStore = useConceptStore()
      this.loading = true
      this.error = ''

      try {
        await conceptStore.ensureLoaded?.(true)
        const targets = (conceptStore.conceptOverviewAll || [])
          .map(item => String(item?.id || ''))
          .filter(Boolean)

        const results = await Promise.allSettled(
          targets.map(async id => {
            const row = await conceptStore.fetchConceptMacro(id, this.samplePoints, this.windowDays)
            return [id, row]
          })
        )

        const nextMap = {}
        results.forEach(result => {
          if (result.status !== 'fulfilled') return
          const [id, row] = result.value || []
          if (!id || !row) return
          nextMap[id] = row
        })

        this.macroById = nextMap
        this.loaded = true
        this.ensureSelectedCategory()
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    ensureSelectedCategory() {
      if (!this.categories.length) {
        this.selectedCategoryId = ''
        return
      }
      const found = this.categories.some(item => item.id === this.selectedCategoryId)
      if (!found) this.selectedCategoryId = this.categories[0].id
    },

    setCategoryByChartName(name) {
      const hit = (this.categories || []).find(item => `${item.name} (${item.count})` === name)
      if (hit) this.selectedCategoryId = hit.id
    },

    setWindowDays(days) {
      const nextDays = Math.min(Math.max(Number(days) || DEFAULT_WINDOW_DAYS, 1), 120)
      if (nextDays === this.windowDays) return
      this.windowDays = nextDays
      this.loaded = false
      this.macroById = {}
      this.selectedCategoryId = ''
    },

  }
})
