import { defineStore } from 'pinia'
import { useConceptStore } from '@/stores/concept'

const CATEGORY_DEFS = [
  { id: 'leaders', name: '强势上行' },
  { id: 'rebound', name: '修复反弹' },
  { id: 'consolidation', name: '震荡整理' },
  { id: 'weak', name: '弱势回撤' }
]

const PERIOD_POINTS = {
  '20d': 20,
  '40d': 40,
  '60d': 60
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

function normalizeCurveRows(curve = []) {
  return (curve || [])
    .filter(item => item && item.ts && isFiniteNumber(item.close))
    .map(item => ({
      ts: Number(item.ts),
      close: Number(item.close),
      change: isFiniteNumber(item.change) ? Number(item.change) : 0
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

function toCategoryId(item, indexCurve) {
  const change = Number(item?.change || 0)
  const strength = Number(item?.strength || 0)
  const drawdown20d = Number(item?.drawdown20d || 0)
  const end = lastFinite(indexCurve)
  const finiteValues = indexCurve.map(Number).filter(Number.isFinite)
  const minPoint = finiteValues.length ? Math.min(...finiteValues) : 0
  const curveDrawdown = end - minPoint

  if (end >= 2 && change >= 0 && strength >= 55) return 'leaders'
  if (end <= -6 || (change <= -1.2 && drawdown20d <= -10)) return 'weak'
  if (Math.abs(end) <= 2 || (curveDrawdown > 2.5 && strength < 55)) return 'consolidation'
  return 'rebound'
}

export const useConceptMacroStore = defineStore('conceptMacro', {
  state: () => ({
    period: '40d',
    curveMode: 'index',
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

    rawCurveRows() {
      const points = PERIOD_POINTS[this.period] || 40
      const result = {}

      ;(this.overviewItems || []).forEach(item => {
        const id = String(item?.id || '')
        if (!id) return
        const curve = normalizeCurveRows(this.macroById[id]?.curve || []).slice(-points)
        if (curve.length) result[id] = curve
      })

      return result
    },

    axisTimestamps() {
      const points = PERIOD_POINTS[this.period] || 40
      return buildAxisTimestamps(Object.values(this.rawCurveRows || {}), points)
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
        const indexCurve = toPercentSeries(alignedCloseSeries)

        return {
          id,
          name: item.name,
          categoryId: toCategoryId(item, indexCurve),
          indexCurve,
          latestChange: Number(item.change || 0)
        }
      }).filter(Boolean)

      const benchmark = avgSeries(list.map(item => item.indexCurve))
      const map = {}

      list.forEach(item => {
        map[item.id] = {
          ...item,
          excessCurve: item.indexCurve.map((value, index) => {
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
      const groups = CATEGORY_DEFS.map(item => ({ ...item, items: [] }))
      const groupMap = Object.fromEntries(groups.map(group => [group.id, group]))

      ;(this.overviewItems || []).forEach(item => {
        const id = String(item?.id || '')
        const curve = this.conceptCurves[id]
        if (!curve) return

        const group = groupMap[curve.categoryId]
        if (!group) return

        group.items.push({
          id,
          name: item.name,
          change: Number(item.change || 0),
          curve: this.curveMode === 'excess' ? curve.excessCurve : curve.indexCurve
        })
      })

      return groups
        .filter(group => group.items.length > 0)
        .map(group => ({
          ...group,
          count: group.items.length,
          representativeCurve: avgSeries(group.items.map(item => item.curve)),
          avgChange: round2(group.items.reduce((sum, item) => sum + Number(item.change || 0), 0) / group.items.length)
        }))
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
        list.sort((a, b) => Number(a.change || 0) - Number(b.change || 0))
      } else if (this.detailSort === 'nameAsc') {
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      } else {
        list.sort((a, b) => Number(b.change || 0) - Number(a.change || 0))
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
            const row = await conceptStore.fetchConceptMacro(id, PERIOD_POINTS['60d'])
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

    setPeriod(period) {
      if (!PERIOD_POINTS[period]) return
      this.period = period
    }
  }
})
