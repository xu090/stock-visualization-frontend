import { defineStore } from 'pinia'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { useStrategyStore } from '@/stores/strategy'
import { useHomeFilterStore } from '@/stores/homeFilter'
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

const createDemoTradeSnapshot = () => ({
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
    fields: ['changePercent', 'netInflow', 'mainInflow']
  },
  entry: {
    expression: '',
    triggerMode: 'close',
    signalRefs: ['changePercent', 'netInflow'],
    conditions: [
      { field: 'changePercent', op: '>=', value: 1, connector: 'AND' },
      { field: 'netInflow', op: '>', value: 0, connector: 'AND' }
    ]
  },
  exit: {
    takeProfitPct: 8,
    stopLossPct: 3,
    exitSignal: '',
    conditions: [
      { field: 'changePercent', op: '<', value: 0, connector: 'OR' },
      { field: 'netInflow', op: '<', value: 0, connector: 'OR' }
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
  params: {}
})

const createDemoSelectSnapshot = () => ({
  scope: 'all',
  searchQuery: '',
  selectedMetrics: ['change', 'netInflow'],
  filters: {
    minChange: 1,
    minNetInflowY: 0.1,
    minUpRatio: 0.5
  }
})

const buildDemoStockQuoteBaseline = (quote = {}, profile = 'reversal-and-drift') => {
  const currentChange = Number(quote.change ?? quote.changePercent ?? 0) || 0
  const currentNetInflow = Number(quote.netInflow ?? 0) || 0
  const currentMainInflow = Number(quote.mainInflow ?? 0) || 0

  if (profile === 'quiet') {
    return {
      ...quote,
      change: currentChange,
      changePercent: Number(quote.changePercent ?? quote.change ?? 0) || currentChange,
      netInflow: currentNetInflow,
      mainInflow: currentMainInflow
    }
  }

  if (profile === 'drift-only') {
    return {
      ...quote,
      change: currentChange <= 0 ? -Math.max(1, Math.abs(currentChange) || 1) : Math.max(1, Math.abs(currentChange) || 1),
      changePercent: currentChange <= 0 ? -Math.max(1, Math.abs(Number(quote.changePercent ?? currentChange) || 1)) : Math.max(1, Math.abs(Number(quote.changePercent ?? currentChange) || 1)),
      netInflow: currentNetInflow <= 0 ? -Math.max(80_000_000, Math.abs(currentNetInflow) || 80_000_000) : Math.max(80_000_000, Math.abs(currentNetInflow) || 80_000_000),
      mainInflow: currentMainInflow <= 0 ? -Math.max(50_000_000, Math.abs(currentMainInflow) || 50_000_000) : Math.max(50_000_000, Math.abs(currentMainInflow) || 50_000_000)
    }
  }

  return {
    ...quote,
    change: Math.max(2, Math.abs(currentChange) || 2),
    changePercent: Math.max(2, Math.abs(Number(quote.changePercent ?? currentChange) || 2)),
    netInflow: Math.max(80_000_000, Math.abs(currentNetInflow) || 80_000_000),
    mainInflow: Math.max(50_000_000, Math.abs(currentMainInflow) || 50_000_000)
  }
}

const pickDemoStockProfile = (stockCodes = [], code = '') => {
  const idx = (stockCodes || []).findIndex(x => normalizeCode(x) === normalizeCode(code))
  if (idx === 1) return 'quiet'
  if (idx === 2) return 'drift-only'
  return 'reversal-and-drift'
}

const buildDemoConceptMetricsBaseline = (metrics = {}) => ({
  change: Math.max(2, Math.abs(Number(metrics.change ?? 0)) || 2),
  netInflow: Math.max(120_000_000, Math.abs(Number(metrics.netInflow ?? 0)) || 120_000_000),
  upRatio: Math.max(0.62, Number(metrics.upRatio ?? 0.55) || 0.62),
  strength: Math.max(60, Number(metrics.strength ?? 0) || 60),
  spike5m: Math.max(55, Number(metrics.spike5m ?? 0) || 55)
})

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
    captureStockBaseline(code) {
      const c = normalizeCode(code)
      if (!c) return
      const key = targetKey('stock', c)

      const stockStore = useStockStore()
      const conceptStore = useConceptStore()
      const strategyStore = useStrategyStore()
      const homeFilter = useHomeFilterStore()
      const useDemoBaseline = !!stockStore.useMock
      const demoProfile = pickDemoStockProfile(stockStore.myStockCodes || [], c)
      const appliedTradeId = homeFilter.appliedTradeStrategyId || null
      const appliedTrade = (strategyStore.tradeStrategies || []).find(s => s.id === appliedTradeId) || null
      const currentQuote = stockStore.getStockByCodeEnriched?.(c) || {}
      const relatedConceptIds = (conceptStore.conceptList || [])
        .filter(cpt => (cpt.stockCodes || []).some(codeItem => normalizeCode(typeof codeItem === 'object' ? codeItem?.code : codeItem) === c))
        .map(cpt => String(cpt.id))

      this.baselineByTarget[key] = {
        type: 'stock',
        targetId: c,
        createdAt: Date.now(),
        quoteBaseline: useDemoBaseline
          ? buildDemoStockQuoteBaseline(currentQuote, demoProfile)
          : { ...currentQuote },
        selectSnapshot: homeFilter.toSnapshot?.() || (useDemoBaseline ? createDemoSelectSnapshot() : null),
        tradeStrategyId: appliedTradeId,
        tradeSnapshot: appliedTrade?.snapshot
          ? JSON.parse(JSON.stringify(appliedTrade.snapshot))
          : (useDemoBaseline && demoProfile !== 'quiet' ? createDemoTradeSnapshot() : null),
        conceptIds: relatedConceptIds,
        simulationMode: useDemoBaseline ? demoProfile : 'live'
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
      const stockStore = useStockStore()
      const homeFilter = useHomeFilterStore()
      const useDemoBaseline = !!stockStore.useMock
      const concept = conceptStore.getConceptById?.(sid)
      const metrics = (conceptStore.conceptOverviewAll || []).find(x => String(x.id) === sid) || concept || {}

      this.baselineByTarget[key] = {
        type: 'concept',
        targetId: sid,
        createdAt: Date.now(),
        selectSnapshot: homeFilter.toSnapshot?.() || (useDemoBaseline ? createDemoSelectSnapshot() : null),
        metricsBaseline: useDemoBaseline
          ? buildDemoConceptMetricsBaseline(metrics)
          : {
              change: metrics.change ?? 0,
              netInflow: metrics.netInflow ?? 0,
              upRatio: metrics.upRatio ?? 0,
              strength: metrics.strength ?? 0,
              spike5m: metrics.spike5m ?? 0
            },
        simulationMode: useDemoBaseline ? 'demo-reversal' : 'live'
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
          baseline,
          tradeSnapshot: baseline?.tradeSnapshot || null
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
