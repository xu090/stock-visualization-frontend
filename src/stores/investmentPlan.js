import { defineStore } from 'pinia'
import { evaluateTradeStrategyForQuote } from '@/utils/tradeEngine'
import { normalizeTradeSnapshot } from '@/utils/tradeStrategy'

const actionRank = { buy: 0, sell: 1, hold: 2 }
const MAX_POSITION_PCT = 100
const MIN_POSITION_PCT = 0

const toPlanRow = ({ strategy, code, stockName, quote, result }) => {
  const snapshot = normalizeTradeSnapshot(strategy.snapshot)
  const targetWeight = result.action === 'buy'
    ? (snapshot.position.initialValue ?? 0)
    : (result.action === 'sell' ? 0 : null)

  return {
    id: `${strategy.id}-${code}`,
    strategyId: strategy.id,
    strategyName: strategy.name,
    symbol: code,
    stockName: stockName || code,
    action: result.action,
    score: result.score,
    targetWeight,
    stopLossPct: snapshot.exit.stopLossPct ?? null,
    takeProfitPct: snapshot.exit.takeProfitPct ?? null,
    maxPositionPct: snapshot.position.maxPositionPct ?? null,
    reason: result.reason,
    quote: {
      price: quote?.price ?? quote?.close ?? null,
      changePercent: quote?.changePercent ?? quote?.change ?? null,
      volumeRatio: quote?.volumeRatio ?? quote?.volRatio ?? null,
      netInflow: quote?.netInflow ?? null
    },
    generatedAt: Date.now()
  }
}

const cloneRows = (rows = []) => rows.map(row => ({ ...row, quote: { ...(row.quote || {}) } }))

const normalizeWeight = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(MIN_POSITION_PCT, Math.min(MAX_POSITION_PCT, Number(n.toFixed(2))))
}

const buildDefaultPlanName = () => {
  const d = new Date()
  const p2 = (v) => String(v).padStart(2, '0')
  return `投资方案-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`
}

const buildPlanId = () => `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const useInvestmentPlanStore = defineStore('investmentPlan', {
  state: () => ({
    activeStrategyId: null,
    plans: [],
    lastGeneratedAt: null,
    savedPlans: [],
    activePlanId: null,
    generatorVisible: false,
    managerVisible: false
  }),

  getters: {
    buyPlans: (state) => state.plans.filter(p => p.action === 'buy'),
    sellPlans: (state) => state.plans.filter(p => p.action === 'sell'),
    activeSavedPlan: (state) => state.savedPlans.find(p => p.id === state.activePlanId) || null
  },

  actions: {
    clear() {
      this.activeStrategyId = null
      this.plans = []
      this.lastGeneratedAt = null
      this.activePlanId = null
    },

    openGenerator() {
      this.generatorVisible = true
    },

    closeGenerator() {
      this.generatorVisible = false
    },

    openManager() {
      this.managerVisible = true
    },

    closeManager() {
      this.managerVisible = false
    },

    closePlanDialogs() {
      this.generatorVisible = false
      this.managerVisible = false
    },

    generateFromTradeStrategy({ strategy, stockStore }) {
      if (!strategy?.id || !strategy?.snapshot || !stockStore) {
        this.clear()
        return []
      }

      const codes = Array.from(new Set((stockStore.myStockCodes || []).filter(Boolean)))
      const rows = codes.map((code) => {
        const c = String(code)
        const base = stockStore.getStockBaseByCode?.(c) || null
        const quote = stockStore.quotesByCode?.[c] || stockStore.getStockByCodeEnriched?.(c) || null
        const result = evaluateTradeStrategyForQuote(strategy.snapshot, quote || {})
        return toPlanRow({
          strategy,
          code: c,
          stockName: base?.name || quote?.name || c,
          quote,
          result
        })
      })

      rows.sort((a, b) => {
        if (actionRank[a.action] !== actionRank[b.action]) return actionRank[a.action] - actionRank[b.action]
        return b.score - a.score
      })

      this.activeStrategyId = strategy.id
      this.plans = rows
      this.lastGeneratedAt = Date.now()
      this.activePlanId = null
      return rows
    },

    saveCurrentPlan({ name, strategy } = {}) {
      if (!Array.isArray(this.plans) || this.plans.length === 0) return null

      const now = Date.now()
      const nextPlan = {
        id: `plan-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name: name?.trim() || buildDefaultPlanName(),
        strategyId: strategy?.id ?? this.activeStrategyId ?? null,
        strategyName: strategy?.name || this.plans[0]?.strategyName || '',
        createdAt: now,
        updatedAt: now,
        rows: cloneRows(this.plans)
      }

      this.savedPlans.unshift(nextPlan)
      this.activePlanId = nextPlan.id
      return nextPlan
    },

    loadPlan(planId) {
      const plan = this.savedPlans.find(p => p.id === planId)
      if (!plan) return null
      this.activePlanId = plan.id
      this.activeStrategyId = plan.strategyId ?? null
      this.plans = cloneRows(plan.rows)
      this.lastGeneratedAt = Date.now()
      return plan
    },

    renamePlan(planId, name) {
      const target = this.savedPlans.find(p => p.id === planId)
      if (!target) return
      const nextName = String(name || '').trim()
      if (!nextName) return
      target.name = nextName
      target.updatedAt = Date.now()
    },

    removePlan(planId) {
      const idx = this.savedPlans.findIndex(p => p.id === planId)
      if (idx < 0) return
      this.savedPlans.splice(idx, 1)
      if (this.activePlanId === planId) {
        this.activePlanId = null
      }
    },

    updatePlanRow({ planId, rowId, patch } = {}) {
      if (!planId || !rowId || !patch) return
      const plan = this.savedPlans.find(p => p.id === planId)
      if (!plan) return
      const row = plan.rows.find(r => r.id === rowId)
      if (!row) return

      if ('action' in patch) row.action = patch.action
      if ('targetWeight' in patch) row.targetWeight = normalizeWeight(patch.targetWeight)
      if ('budgetYuan' in patch) {
        const n = Number(patch.budgetYuan)
        row.budgetYuan = Number.isFinite(n) ? Math.max(0, Math.round(n)) : null
      }
      if ('buyShares' in patch) {
        const n = Number(patch.buyShares)
        if (Number.isFinite(n) && n > 0) {
          const shares = Math.floor(n / 100) * 100
          row.buyShares = shares
          row.buyLots = shares / 100
          const p = Number(row?.quote?.price)
          if (Number.isFinite(p) && p > 0) row.budgetYuan = Math.round(shares * p)
        } else {
          row.buyShares = 0
          row.buyLots = 0
          if (row.action === 'buy') row.budgetYuan = 0
        }
      }
      if ('buyLots' in patch) {
        const n = Number(patch.buyLots)
        if (Number.isFinite(n) && n > 0) {
          const lots = Math.floor(n)
          row.buyLots = lots
          row.buyShares = lots * 100
        } else {
          row.buyLots = 0
          row.buyShares = 0
        }
      }
      if ('strategyId' in patch) row.strategyId = patch.strategyId
      if ('strategyName' in patch) row.strategyName = String(patch.strategyName || '').trim()
      if ('reason' in patch) row.reason = String(patch.reason || '').trim()
      plan.updatedAt = Date.now()

      if (this.activePlanId === planId) {
        const activeRow = this.plans.find(r => r.id === rowId)
        if (activeRow) {
          Object.assign(activeRow, {
            action: row.action,
            targetWeight: row.targetWeight,
            budgetYuan: row.budgetYuan,
            buyShares: row.buyShares,
            buyLots: row.buyLots,
            strategyId: row.strategyId,
            strategyName: row.strategyName,
            reason: row.reason
          })
        }
      }
    },

    setCurrentPlans({ rows = [], strategyId = null } = {}) {
      this.activeStrategyId = strategyId
      this.plans = cloneRows(rows)
      this.lastGeneratedAt = Date.now()
      this.activePlanId = null
      return this.plans
    },

    createPlan({ name, rows = [], strategyId = null, strategyName = '' } = {}) {
      if (!Array.isArray(rows) || rows.length === 0) return null
      const now = Date.now()
      const nextPlan = {
        id: buildPlanId(),
        name: name?.trim() || buildDefaultPlanName(),
        strategyId,
        strategyName: strategyName || rows[0]?.strategyName || '',
        createdAt: now,
        updatedAt: now,
        rows: cloneRows(rows)
      }
      this.savedPlans.unshift(nextPlan)
      this.activePlanId = nextPlan.id
      this.activeStrategyId = strategyId
      this.plans = cloneRows(rows)
      this.lastGeneratedAt = now
      return nextPlan
    }
  }
})
