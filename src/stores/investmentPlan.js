import { defineStore } from 'pinia'
import { evaluateTradeStrategyForQuote } from '@/utils/tradeEngine'
import { normalizeTradeSnapshot } from '@/utils/tradeStrategy'

const actionRank = { buy: 0, sell: 1, hold: 2 }

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

export const useInvestmentPlanStore = defineStore('investmentPlan', {
  state: () => ({
    activeStrategyId: null,
    plans: [],
    lastGeneratedAt: null
  }),

  getters: {
    buyPlans: (state) => state.plans.filter(p => p.action === 'buy'),
    sellPlans: (state) => state.plans.filter(p => p.action === 'sell')
  },

  actions: {
    clear() {
      this.activeStrategyId = null
      this.plans = []
      this.lastGeneratedAt = null
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
      return rows
    }
  }
})

