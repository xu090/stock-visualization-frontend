<template>
  <div class="plan-dock">
    <div class="plan-head">
      <span class="plan-title">投资方案</span>
      <div class="plan-head-actions">
        <span class="plan-sub">买入 {{ buyPlanCount }} / 卖出 {{ sellPlanCount }}</span>
        <el-button
          class="btn-mini"
          size="small"
          plain
          :disabled="!currentAppliedTradeId"
          @click="regeneratePlansByAppliedTrade"
        >
          刷新
        </el-button>
      </div>
    </div>

    <div class="plan-list scroll-hidden" v-if="planPreviewList.length">
      <div
        v-for="p in planPreviewList"
        :key="p.id"
        class="plan-item"
        :class="`act-${p.action}`"
      >
        <div class="plan-line1">
          <span class="plan-symbol">{{ p.stockName }}</span>
          <span class="plan-action">{{ actionText(p.action) }}</span>
        </div>
        <div class="plan-line2">
          <span class="mini">策略</span>
          <span class="val">{{ p.strategyName }}</span>
        </div>
        <div class="plan-line2">
          <span class="mini">建议</span>
          <span class="val">仓位 {{ formatPct(p.targetWeight) }} / 分数 {{ p.score }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-box">
      <div class="empty-title">暂无投资方案</div>
      <div class="empty-sub">应用交易策略后，会基于股票自选生成候选方案。</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useHomeFilterStore } from '@/stores/homeFilter'
import { useStrategyStore } from '@/stores/strategy'
import { useStockStore } from '@/stores/stock'
import { useInvestmentPlanStore } from '@/stores/investmentPlan'

const homeFilter = useHomeFilterStore()
const strategyStore = useStrategyStore()
const stockStore = useStockStore()
const investmentPlanStore = useInvestmentPlanStore()

const currentAppliedTradeId = computed(() => homeFilter.appliedTradeStrategyId || null)
const planPreviewList = computed(() => (investmentPlanStore.plans || []).slice(0, 6))
const buyPlanCount = computed(() => (investmentPlanStore.buyPlans || []).length)
const sellPlanCount = computed(() => (investmentPlanStore.sellPlans || []).length)

const actionText = (action) => {
  if (action === 'buy') return '买入'
  if (action === 'sell') return '卖出'
  return '观望'
}

const formatPct = (v) => {
  if (v == null || v === '') return '--'
  const n = Number(v)
  if (!Number.isFinite(n)) return '--'
  return `${n}%`
}

const regeneratePlansByAppliedTrade = () => {
  const id = currentAppliedTradeId.value
  if (!id) return
  const strategy = (strategyStore.tradeStrategies || []).find(s => s.id === id)
  if (!strategy) return
  const codes = (stockStore.myStockCodes || []).filter(Boolean)
  if (!codes.length) {
    investmentPlanStore.clear()
    ElMessage.warning('当前没有自选股票，无法生成投资方案')
    return
  }
  stockStore.initMockQuotes?.(codes)
  investmentPlanStore.generateFromTradeStrategy({ strategy, stockStore })
  ElMessage.success('已刷新投资方案')
}
</script>

<style scoped>
.scroll-hidden{ scrollbar-width:none; -ms-overflow-style:none; }
.scroll-hidden::-webkit-scrollbar{ width:0; height:0; }

.plan-dock{
  width: 212px;
  height: 100%;
  background: transparent;
  padding: 8px;
  display:flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 12px;
}
.plan-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 8px;
}
.plan-title{
  font-weight: 700;
  font-size: 15px;
  color:#111827;
}
.plan-sub{
  font-weight: 700;
  font-size: 11px;
  color:#9ca3af;
}
.plan-head-actions{
  display:flex;
  align-items:center;
  gap: 6px;
}
.btn-mini{
  padding: 0 8px !important;
  height: 24px !important;
  border-radius: 12px !important;
  font-weight: 800;
}

.plan-list{
  flex: 1 1 auto;
  overflow-y: auto;
  display:flex;
  flex-direction: column;
  gap: 8px;
}
.plan-item{
  background:#fff;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 8px 14px rgba(0,0,0,.04);
  padding: 8px;
}
.plan-item.act-buy{ border-left: 3px solid rgba(34,197,94,.9); }
.plan-item.act-sell{ border-left: 3px solid rgba(239,68,68,.9); }
.plan-item.act-hold{ border-left: 3px solid rgba(148,163,184,.9); }

.plan-line1{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 8px;
}
.plan-symbol{
  font-size: 12px;
  font-weight: 900;
  color:#111827;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan-action{
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 900;
  color:#374151;
  background: rgba(148,163,184,.14);
  border: 1px solid rgba(148,163,184,.28);
  border-radius: 999px;
  padding: 1px 6px;
}
.plan-line2{
  margin-top: 6px;
  display:flex;
  align-items:center;
  gap: 6px;
  font-size: 11px;
  overflow:hidden;
}
.mini{ font-weight: 900; color:#9ca3af; }
.val{
  font-weight: 900;
  color:#374151;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-box{
  border: 1px dashed rgba(0,0,0,.10);
  background: rgba(0,0,0,.02);
  border-radius: 12px;
  padding: 10px;
}
.empty-title{ font-weight: 900; color:#6b7280; font-size: 12px; }
.empty-sub{
  margin-top: 6px;
  font-weight: 800;
  color:#9ca3af;
  font-size: 12px;
  line-height: 1.35;
}
</style>
