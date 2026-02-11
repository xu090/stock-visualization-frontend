// src/stores/homeFilter.js
import { defineStore } from 'pinia'

/**
 * filters 说明（概念层指标）：
 * - minChange: 概念涨跌幅下限（%）
 * - minNetInflowY: 概念净流入下限（亿元）
 * - minAmountY: 概念成交额下限（亿元）
 * - minVolRatio: 概念量比下限
 * - minUpRatio: 上涨占比下限（0~1）
 * - minStrength: 强度下限（0~100）
 * - minSpike5m: 异动热度下限（0~100）
 * - maxVolatility: 波动率上限（越小越稳）
 * - maxDrawdown20d: 20日最大回撤下限（例如 -8 表示回撤不能小于 -8%）
 */

export const useHomeFilterStore = defineStore('homeFilter', {
  state: () => ({
    scope: 'all', // 预留：all | fav
    searchQuery: '',
    selectedMetrics: ['change'],

    // ✅ 专业化：可组合筛选阈值
    filters: {
      minChange: null,
      minNetInflowY: null,
      minAmountY: null,
      minVolRatio: null,
      minUpRatio: null,
      minStrength: null,
      minSpike5m: null,
      maxVolatility: null,
      maxDrawdown20d: null
    }
  }),

  actions: {
    reset() {
      this.scope = 'all'
      this.searchQuery = ''
      this.selectedMetrics = ['change']
      this.filters = {
        minChange: null,
        minNetInflowY: null,
        minAmountY: null,
        minVolRatio: null,
        minUpRatio: null,
        minStrength: null,
        minSpike5m: null,
        maxVolatility: null,
        maxDrawdown20d: null
      }
    },

    /** ✅ 导出快照：策略=筛选条件+排序 */
    toSnapshot() {
      return {
        scope: this.scope,
        searchQuery: this.searchQuery,
        selectedMetrics: [...(this.selectedMetrics || [])],
        filters: { ...(this.filters || {}) }
      }
    },

    /** ✅ 应用快照：策略应用=恢复筛选条件+排序 */
    applySnapshot(snapshot) {
      if (!snapshot) return
      this.scope = snapshot.scope ?? this.scope
      this.searchQuery = snapshot.searchQuery ?? ''
      this.selectedMetrics = Array.isArray(snapshot.selectedMetrics)
        ? snapshot.selectedMetrics.slice(0, 3)
        : []
      this.filters = { ...this.filters, ...(snapshot.filters || {}) }
    }
  }
})
