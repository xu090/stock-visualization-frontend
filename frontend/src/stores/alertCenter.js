import { defineStore } from 'pinia'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { evaluateConceptAlert, evaluateStockAlert } from '@/utils/alertEngine'

const normalizeCode = (raw) => {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH)$/i, '')
  s = s.replace(/^(sz|sh)/i, '')
  return s
}

const targetKey = (type, id) => `${type}:${id}`

const removeTargetAlerts = (alerts, type, id) => alerts.filter(x => !(x.targetType === type && String(x.targetId) === String(id)))

export const useAlertCenterStore = defineStore('alertCenter', {
  state: () => ({
    alerts: [],
    baselineByTarget: {},
    lastStateByTarget: {}
  }),

  getters: {
    unreadCount: (state) => state.alerts.filter(x => !x.read).length,
    latestAlerts: (state) => state.alerts.slice(0, 8),
    activeAlerts: (state) => state.alerts.filter(x => !x.dismissed),
    latestAlertByTarget: (state) => {
      const map = Object.create(null)
      state.alerts.forEach((alert) => {
        if (alert.dismissed) return
        const key = targetKey(alert.targetType, alert.targetId)
        if (!map[key]) map[key] = alert
      })
      return map
    }
  },

  actions: {
    clearTargetState(type, id) {
      const key = targetKey(type, id)
      delete this.baselineByTarget[key]
      delete this.lastStateByTarget[key]
      this.alerts = removeTargetAlerts(this.alerts, type, id)
    },

    captureStockBaseline(code) {
      const c = normalizeCode(code)
      if (!c) return
      const key = targetKey('stock', c)

      const conceptStore = useConceptStore()
      const stockStore = useStockStore()
      const currentQuote = stockStore.getStockByCodeEnriched?.(c) || {}
      const relatedConceptIds = (conceptStore.conceptList || [])
        .filter(cpt => (cpt.stockCodes || []).some(codeItem => normalizeCode(typeof codeItem === 'object' ? codeItem?.code : codeItem) === c))
        .map(cpt => String(cpt.id))

      this.baselineByTarget[key] = {
        type: 'stock',
        targetId: c,
        createdAt: Date.now(),
        quoteBaseline: { ...currentQuote },
        conceptIds: relatedConceptIds,
        simulationMode: 'live'
      }
    },

    ensureStockBaseline(code) {
      const c = normalizeCode(code)
      if (!c) return
      const key = targetKey('stock', c)
      if (this.baselineByTarget[key]) return
      this.captureStockBaseline(c)
    },

    captureConceptBaseline(id) {
      const sid = String(id || '').trim()
      if (!sid) return
      const key = targetKey('concept', sid)

      const conceptStore = useConceptStore()
      const concept = conceptStore.getConceptById?.(sid)
      const metrics = (conceptStore.conceptOverviewAll || []).find(x => String(x.id) === sid) || concept || {}

      this.baselineByTarget[key] = {
        type: 'concept',
        targetId: sid,
        createdAt: Date.now(),
        metricsBaseline: {
          change: metrics.change ?? 0,
          netInflow: metrics.netInflow ?? 0,
          upRatio: metrics.upRatio ?? 0,
          strength: metrics.strength ?? 0,
          spike5m: metrics.spike5m ?? 0
        },
        simulationMode: 'live'
      }
    },

    ensureConceptBaseline(id) {
      const sid = String(id || '').trim()
      if (!sid) return
      const key = targetKey('concept', sid)
      if (this.baselineByTarget[key]) return
      this.captureConceptBaseline(sid)
    },

    syncBaselines() {
      const stockStore = useStockStore()
      const conceptStore = useConceptStore()
      const stockKeys = new Set((stockStore.myStockCodes || []).map(code => targetKey('stock', normalizeCode(code))).filter(Boolean))
      const conceptKeys = new Set((conceptStore.myConceptList || []).map(c => targetKey('concept', String(c.id))).filter(Boolean))

      ;(stockStore.myStockCodes || []).forEach(code => this.ensureStockBaseline(code))
      ;(conceptStore.myConceptList || []).forEach(c => this.ensureConceptBaseline(c.id))

      Object.keys(this.baselineByTarget).forEach((key) => {
        if (key.startsWith('stock:') && !stockKeys.has(key)) {
          delete this.baselineByTarget[key]
          delete this.lastStateByTarget[key]
          this.alerts = removeTargetAlerts(this.alerts, 'stock', key.slice(6))
        }
        if (key.startsWith('concept:') && !conceptKeys.has(key)) {
          delete this.baselineByTarget[key]
          delete this.lastStateByTarget[key]
          this.alerts = removeTargetAlerts(this.alerts, 'concept', key.slice(8))
        }
      })
    },

    pushAggregatedAlert({ targetType, targetId, targetName, level, summary, signature, items }) {
      if (!signature) return
      const alert = {
        id: `${targetType}-${targetId}-${Date.now()}`,
        targetType,
        targetId: String(targetId),
        targetName: targetName || String(targetId),
        level,
        summary,
        signature,
        items: Array.isArray(items) ? items.slice(0, 6) : [],
        read: false,
        dismissed: false,
        createdAt: Date.now()
      }
      this.alerts.unshift(alert)
      this.alerts = this.alerts.slice(0, 120)
    },

    scanStocks() {
      const stockStore = useStockStore()
      ;(stockStore.myStockCodes || []).forEach((code) => {
        const c = normalizeCode(code)
        if (!c) return
        const key = targetKey('stock', c)
        const baseline = this.baselineByTarget[key] || null
        const quote = stockStore.getStockByCodeEnriched?.(c) || null
        if (!quote) return
        const result = evaluateStockAlert({
          quote,
          baseline
        })
        const prevSignature = this.lastStateByTarget[key]?.signature || ''
        if (result.signature && result.signature !== prevSignature) {
          this.pushAggregatedAlert({
            targetType: 'stock',
            targetId: c,
            targetName: quote.name || c,
            level: result.level,
            summary: result.summary,
            signature: result.signature,
            items: result.items
          })
        }
        this.lastStateByTarget[key] = {
          signature: result.signature,
          scannedAt: Date.now(),
          level: result.level
        }
      })
    },

    scanConcepts() {
      const conceptStore = useConceptStore()
      const stockStore = useStockStore()
      ;(conceptStore.myConceptList || []).forEach((concept) => {
        const sid = String(concept.id)
        const key = targetKey('concept', sid)
        const metrics = (conceptStore.conceptOverviewAll || []).find(x => String(x.id) === sid) || concept || {}
        const rawCodes = Array.isArray(concept.stockCodes) ? concept.stockCodes : []
        const memberCodes = rawCodes.map(x => normalizeCode(typeof x === 'object' ? x?.code : x)).filter(Boolean)
        const memberStocks = stockStore.getStocksByCodesEnriched?.(memberCodes, concept.name || '') || []
        const result = evaluateConceptAlert({
          concept,
          metrics,
          memberStocks,
          baseline: this.baselineByTarget[key] || null
        })
        const prevSignature = this.lastStateByTarget[key]?.signature || ''
        if (result.signature && result.signature !== prevSignature) {
          this.pushAggregatedAlert({
            targetType: 'concept',
            targetId: sid,
            targetName: concept.name || sid,
            level: result.level,
            summary: result.summary,
            signature: result.signature,
            items: result.items
          })
        }
        this.lastStateByTarget[key] = {
          signature: result.signature,
          scannedAt: Date.now(),
          level: result.level
        }
      })
    },

    scanAll() {
      this.syncBaselines()
      this.scanStocks()
      this.scanConcepts()
    },

    resetStockBaseline(code) {
      const c = normalizeCode(code)
      if (!c) return
      this.clearTargetState('stock', c)
      this.captureStockBaseline(c)
    },

    resetConceptBaseline(id) {
      const sid = String(id || '').trim()
      if (!sid) return
      this.clearTargetState('concept', sid)
      this.captureConceptBaseline(sid)
    },

    markAlertRead(id) {
      const target = this.alerts.find(x => x.id === id)
      if (target) target.read = true
    },

    markTargetRead(type, id) {
      this.alerts.forEach((alert) => {
        if (alert.targetType === type && String(alert.targetId) === String(id)) alert.read = true
      })
    },

    markAllRead() {
      this.alerts.forEach(alert => { alert.read = true })
    },

    dismissAlert(id) {
      const target = this.alerts.find(x => x.id === id)
      if (target) target.dismissed = true
    }
  }
})
