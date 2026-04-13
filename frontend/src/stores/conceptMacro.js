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
  return Math.round(n * 100) / 100
}

function avgCurve(curves) {
  if (!curves.length) return []
  const len = curves[0].length
  const out = new Array(len).fill(0)
  curves.forEach(curve => {
    for (let i = 0; i < len; i++) out[i] += Number(curve[i] || 0)
  })
  return out.map(v => round2(v / curves.length))
}

function buildIndexCurveFromMetrics(item, points) {
  const p = Math.max(2, Number(points) || 20)
  const total20d = Number(item?.change20d || 0)
  const day1 = Number(item?.change || 0)
  const m5 = Number(item?.change5m || 0)
  const m1 = Number(item?.change1m || 0)
  const strength = Number(item?.strength || 50)
  const drawdown20d = Number(item?.drawdown20d || 0)

  // 20日是已有字段，40/60日按同一特征做尺度扩展（仍仅使用现有字段）
  const periodScale = Math.pow(p / 20, 0.72)
  const target = total20d * periodScale

  const strengthBias = (strength - 50) / 50
  const drawdownBias = Math.min(Math.abs(drawdown20d) / 20, 1)
  const tailMomentum = (day1 * 0.65 + m5 * 0.25 + m1 * 0.1)

  const curve = []
  for (let i = 0; i < p; i++) {
    const t = i / (p - 1)
    const linear = target * t
    const belly = t * (1 - t) * (strengthBias * 4 - drawdownBias * 2)
    const tail = Math.pow(t, 6) * tailMomentum * 0.8
    curve.push(round2(linear + belly + tail))
  }
  return curve
}

function toCategoryId(item, indexCurve) {
  const change = Number(item?.change || 0)
  const strength = Number(item?.strength || 0)
  const drawdown20d = Number(item?.drawdown20d || 0)
  const end = Number(indexCurve?.[indexCurve.length - 1] || 0)
  const minPoint = Math.min(...(indexCurve || [0]))
  const curveDrawdown = end - minPoint

  // 以曲线终点方向为主，保证“强势上行”与图形观感一致
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
    detailSort: 'changeDesc'
  }),

  getters: {
    overviewItems() {
      const conceptStore = useConceptStore()
      return conceptStore.conceptOverviewAll || []
    },

    xAxisLabels() {
      const points = PERIOD_POINTS[this.period] || 40
      return Array.from({ length: points }, (_, i) => `T-${points - i - 1}`)
    },

    conceptCurves() {
      const points = PERIOD_POINTS[this.period] || 40
      const list = (this.overviewItems || []).map(item => {
        const id = String(item.id)
        const indexCurve = buildIndexCurveFromMetrics(item, points)
        return {
          id,
          name: item.name,
          categoryId: toCategoryId(item, indexCurve),
          indexCurve,
          latestChange: Number(item.change || 0)
        }
      })

      const benchmark = avgCurve(list.map(x => x.indexCurve))
      const map = {}
      list.forEach(item => {
        map[item.id] = {
          ...item,
          excessCurve: item.indexCurve.map((v, idx) => round2(v - Number(benchmark[idx] || 0)))
        }
      })
      return map
    },

    categories() {
      const groups = CATEGORY_DEFS.map(x => ({ ...x, items: [] }))
      const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))

      ;(this.overviewItems || []).forEach(item => {
        const id = String(item.id)
        const curve = this.conceptCurves[id]
        if (!curve) return
        const gid = curve.categoryId
        if (!groupMap[gid]) return
        groupMap[gid].items.push({
          id,
          name: item.name,
          change: Number(item.change || 0),
          curve: this.curveMode === 'excess' ? curve.excessCurve : curve.indexCurve
        })
      })

      return groups
        .filter(g => g.items.length > 0)
        .map(g => ({
          ...g,
          count: g.items.length,
          representativeCurve: avgCurve(g.items.map(i => i.curve)),
          avgChange: round2(g.items.reduce((s, x) => s + Number(x.change || 0), 0) / g.items.length)
        }))
    },

    selectedCategory() {
      const all = this.categories || []
      return all.find(x => x.id === this.selectedCategoryId) || all[0] || null
    },

    categoryChartSeries() {
      return (this.categories || []).map(cat => ({
        id: cat.id,
        name: `${cat.name} (${cat.count})`,
        data: cat.representativeCurve
      }))
    },

    detailItems() {
      const category = this.selectedCategory
      if (!category) return []

      let list = category.items.slice()
      const kw = String(this.detailSearch || '').trim().toLowerCase()
      if (kw) list = list.filter(x => String(x.name || '').toLowerCase().includes(kw))

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
    ensureSelectedCategory() {
      if (!this.categories.length) {
        this.selectedCategoryId = ''
        return
      }
      const found = this.categories.some(x => x.id === this.selectedCategoryId)
      if (!found) this.selectedCategoryId = this.categories[0].id
    },
    setCategoryByChartName(name) {
      const hit = (this.categories || []).find(x => `${x.name} (${x.count})` === name)
      if (hit) this.selectedCategoryId = hit.id
    },
    setPeriod(period) {
      if (!PERIOD_POINTS[period]) return
      this.period = period
    }
  }
})
