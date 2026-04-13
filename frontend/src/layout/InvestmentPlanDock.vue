<template>
  <div class="plan-dock">
    <div class="plan-head">
      <span class="plan-title">交易方案</span>
      <div class="plan-head-actions">
        <el-button  size="small" type="primary" plain @click="openGenerator">
          生成方案
        </el-button>
        <el-button  size="small" plain :disabled="!savedPlans.length" @click="openManager">
          方案列表
        </el-button>
      </div>
    </div>

    <div class="plan-content scroll-hidden">
      <div v-if="!savedPlans.length && !planPreviewList.length" class="empty-box">
        <div class="empty-title">暂无交易方案</div>
      <div class="empty-sub">点击“生成方案”，支持按交易策略自动推荐。</div>
      </div>

      <div class="saved-list" v-if="savedPlans.length">
        <div class="saved-head">我的方案</div>
        <el-collapse v-model="openSavedGroupKeys" class="saved-collapse">
          <el-collapse-item
            v-for="group in savedPlanGroups"
            :key="group.key"
            :name="group.key"
          >
            <template #title>
              <div class="saved-group-head">
                <div class="saved-group-title">
                  <el-icon ><FolderOpened /></el-icon>
                  <span class="saved-group-name">{{ group.label }}</span>
                </div>
              </div>
            </template>
            <div class="saved-group-list">
              <div
                v-for="p in group.plans"
                :key="p.id"
                class="saved-item"
                :class="{ active: p.id === investmentPlanStore.activePlanId }"
                @click="loadSavedPlan(p.id)"
              >
                <span class="saved-item-rail"></span>
                <el-icon class="saved-item-icon"><Document /></el-icon>
                <div class="saved-item-main">
                  <span class="saved-name">{{ p.name }}</span>
                  <span class="saved-time">{{ formatDateTime(p.updatedAt) }}</span>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <el-dialog v-model="generatorVisible" title="生成交易方案" width="min(1120px, 96vw)" destroy-on-close class="plan-generator-dialog">
      <div class="generator-shell">
        
        <div class="generator-top card-like">
          <div class="g-field g-field-name">
            <div class="g-label">方案名称</div>
            <el-input v-model="draftName" placeholder="例如：4月成长组合" />
          </div>
          <div class="g-field g-field-capital">
            <div class="g-label">总资金(元)</div>
            <el-input-number
              v-model="totalCapitalYuan"
              :min="10000"
              :step="10000"
              controls-position="right"
              placeholder="总资金(元)"
            />
          </div>

          <template v-if="generationSource === 'byStrategy'">
            <div class="g-field g-field-strategy">
              <div class="g-label">交易策略</div>
              <el-select v-model="autoTradeStrategyId" placeholder="选择交易策略">
                <el-option v-for="s in tradeStrategies" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </div>
            <div class="g-field g-field-pool">
              <div class="g-label">股票池</div>
              <el-select v-model="autoCandidateScope" placeholder="选择股票池">
                <el-option label="自选股票池" value="my" />
                <el-option label="全样本股票池" value="all" />
              </el-select>
            </div>
            <div class="g-field g-action g-field-action">
              <div class="g-label">操作</div>
              <el-button type="primary" @click="generateByStrategy" :disabled="!autoTradeStrategyId">自动推荐</el-button>
            </div>
          </template>

        </div>

        <div class="generator-summary">
          <div v-if="generationSource !== 'byStrategy'" class="summary-actions">
            <el-button size="small" plain @click="applyEqualWeight" :disabled="draftStats.buyRows <= 1">买入等权</el-button>
            <el-button size="small" plain @click="recalcDraftByBudget" :disabled="!draftStats.buyRows">按资金重算</el-button>
          </div>
        </div>

        <div v-if="generationSource === 'byStrategy'" class="draft-sections">
          <div v-for="section in strategyDraftSections" :key="section.key" class="draft-section">
            <div class="draft-section-head">
              <span class="draft-section-title">{{ section.title }}</span>
              <span class="draft-section-count">{{ section.rows.length }} 只</span>
            </div>
            <el-table :data="section.rows" size="small" stripe height="200" :row-class-name="draftRowClassName">
              <el-table-column label="股票" min-width="185">
                <template #default="{ row }">
                  <el-select
                    :model-value="row.symbol"
                    filterable
                    placeholder="选择股票"
                    @change="(val) => onDraftStockChange(row, val)"
                  >
                    <el-option
                      v-for="s in tableStockOptions"
                      :key="s.code"
                      :label="`${s.name}(${s.code})`"
                      :value="s.code"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="交易策略" min-width="185">
                <template #default="{ row }">
                  <el-select
                    :model-value="row.strategyId"
                    placeholder="选择策略"
                    @change="(val) => onDraftStrategyChange(row, val)"
                  >
                    <el-option
                      v-for="s in tradeStrategies"
                      :key="s.id"
                      :label="s.name"
                      :value="s.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="动作" width="95">
                <template #default="{ row }">
                  <el-select v-model="row.action" @change="() => onDraftActionChange(row)">
                    <el-option label="买入" value="buy" />
                    <el-option label="卖出" value="sell" />
                    <el-option label="观望" value="hold" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="仓位(%)" width="110">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.targetWeight"
                    :min="0"
                    :max="100"
                    :step="1"
                    controls-position="right"
                    @change="() => onDraftSizingInput(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="金额(元)" width="125">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.budgetYuan"
                    :min="0"
                    :step="1000"
                    controls-position="right"
                    @change="() => onDraftSizingInput(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="买入股数" width="120">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.buyShares"
                    :min="0"
                    :step="100"
                    :disabled="row.action !== 'buy'"
                    controls-position="right"
                    @change="(val) => onDraftSharesChange(row, val)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.reason" />
                </template>
              </el-table-column>
              <el-table-column label="" width="66">
                <template #default="{ row }">
                  <el-button link type="danger" @click="removeDraftRow(row.id)">删除</el-button>
                </template>
              </el-table-column>
              <template #empty>
                <div class="table-empty table-empty-small">
                  <div class="empty-sub">{{ section.emptyText }}</div>
                </div>
              </template>
            </el-table>
          </div>
        </div>

      </div>

      <template #footer>
        <el-button @click="generatorVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmGeneratePlan" :disabled="!canGeneratePlan">
          {{ canGeneratePlan ? '生成到我的方案' : '请先配置候选' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="managerVisible" title="我的交易方案" width="1080px" destroy-on-close>
      <div class="manager-shell">
        <div class="manager-left">
          <div class="manager-left-head">方案列表</div>
          <div class="manager-list scroll-hidden">
            <el-collapse v-model="openSavedGroupKeys" class="manager-plan-collapse">
              <el-collapse-item
                v-for="group in savedPlanGroups"
                :key="`manager-${group.key}`"
                :name="group.key"
              >
                <template #title>
                  <div class="manager-plan-group-head">
                    <div class="saved-group-title">
                      <el-icon class="saved-group-icon"><FolderOpened /></el-icon>
                      <span class="manager-plan-group-name">{{ group.label }}</span>
                    </div>
                    <span class="manager-plan-group-count">{{ group.plans.length }}</span>
                  </div>
                </template>
                <div class="manager-plan-group-list">
                  <div
                    v-for="p in group.plans"
                    :key="p.id"
                    class="manager-plan-item"
                    :class="{ active: p.id === selectedPlanId }"
                    @click="selectPlan(p.id)"
                  >
                    <span class="saved-item-rail"></span>
                    <el-icon class="saved-item-icon"><Document /></el-icon>
                    <div class="manager-plan-item-main">
                      <div class="manager-plan-name">{{ p.name }}</div>
                      <div class="manager-plan-time">{{ formatDateTime(p.updatedAt) }}</div>
                    </div>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>

        <div class="manager-right" v-if="selectedPlan">
          <div class="manager-tools">
            <el-input v-model="editablePlanName" placeholder="方案名称" />
            <el-button type="primary" plain @click="renameSelectedPlan">保存名称</el-button>
            <el-button type="danger" plain @click="removeSelectedPlan">删除方案</el-button>
          </div>

          <el-table :data="selectedPlan.rows" size="small" stripe height="420">
            <el-table-column prop="stockName" label="股票" min-width="110" />
            <el-table-column label="动作" width="90">
              <template #default="{ row }">
                <el-select :model-value="row.action" @change="(val) => updateRow(row.id, { action: val })">
                  <el-option label="买入" value="buy" />
                  <el-option label="卖出" value="sell" />
                  <el-option label="观望" value="hold" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="策略" min-width="160">
              <template #default="{ row }">
                <el-select :model-value="row.strategyId" @change="(val) => onManagerStrategyChange(row, val)">
                  <el-option v-for="s in tradeStrategies" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="仓位(%)" width="105">
              <template #default="{ row }">
                <el-input-number
                  :model-value="row.targetWeight"
                  :min="0"
                  :max="100"
                  :step="1"
                  controls-position="right"
                  @change="(val) => updateRow(row.id, { targetWeight: val })"
                />
              </template>
            </el-table-column>
            <el-table-column label="金额(元)" width="125">
              <template #default="{ row }">
                <el-input-number
                  :model-value="row.budgetYuan"
                  :min="0"
                  :step="1000"
                  controls-position="right"
                  @change="(val) => updateRow(row.id, { budgetYuan: val })"
                />
              </template>
            </el-table-column>
            <el-table-column label="买入股数" width="120">
              <template #default="{ row }">
                <el-input-number
                  :model-value="row.buyShares"
                  :min="0"
                  :step="100"
                  :disabled="row.action !== 'buy'"
                  controls-position="right"
                  @change="(val) => updateRow(row.id, { buyShares: val })"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="140">
              <template #default="{ row }">
                <el-input :model-value="row.reason" @change="(val) => updateRow(row.id, { reason: val })" />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="manager-empty" v-else>
          暂无可管理方案
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FolderOpened, Document } from '@element-plus/icons-vue'
import { useHomeFilterStore } from '@/stores/homeFilter'
import { useStrategyStore } from '@/stores/strategy'
import { useStockStore } from '@/stores/stock'
import { useInvestmentPlanStore } from '@/stores/investmentPlan'
import { evaluateTradeStrategyForQuote } from '@/utils/tradeEngine'

const homeFilter = useHomeFilterStore()
const strategyStore = useStrategyStore()
const stockStore = useStockStore()
const investmentPlanStore = useInvestmentPlanStore()

const LOT_SIZE = 100

const tradeStrategies = computed(() => strategyStore.tradeStrategies || [])
const savedPlans = computed(() => investmentPlanStore.savedPlans || [])
const planPreviewList = computed(() => (investmentPlanStore.plans || []).slice(0, 6))
const currentAppliedTradeId = computed(() => homeFilter.appliedTradeStrategyId || null)
const openSavedGroupKeys = ref([])

const generationSource = ref('byStrategy')
const autoCandidateScope = ref('my')

const stockOptions = computed(() => {
  const favCodes = (stockStore.myStockCodes || []).filter(Boolean)
  const list = favCodes.length ? favCodes : (stockStore.stockBaseList || []).map(x => x.code)
  return list.map((code) => {
    const base = stockStore.getStockBaseByCode?.(code)
    return { code, name: base?.name || code }
  })
})

const allStockOptions = computed(() => {
  const list = (stockStore.stockBaseList || []).map(x => x.code).filter(Boolean)
  const uniq = Array.from(new Set(list))
  return uniq.map((code) => {
    const base = stockStore.getStockBaseByCode?.(code)
    return { code, name: base?.name || code }
  })
})

const tableStockOptions = computed(() => {
  if (generationSource.value === 'byStrategy' && autoCandidateScope.value === 'all') {
    return allStockOptions.value
  }
  return stockOptions.value
})

const findStrategyById = (id) => tradeStrategies.value.find(s => s.id === id) || null
const findStockByCode = (code) => {
  const fromTable = tableStockOptions.value.find(s => s.code === code)
  if (fromTable) return fromTable
  const base = stockStore.getStockBaseByCode?.(code)
  return base ? { code, name: base.name || code } : null
}

const formatDateTime = (ts) => {
  if (!ts) return '--'
  const d = new Date(ts)
  const p2 = (v) => String(v).padStart(2, '0')
  return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const savedPlanGroups = computed(() => {
  const groups = new Map()
  ;(savedPlans.value || []).forEach((plan) => {
    const key = plan.strategyId != null ? `strategy-${plan.strategyId}` : `name-${plan.strategyName || 'ungrouped'}`
    const label = plan.strategyName || '未归类策略'
    if (!groups.has(key)) groups.set(key, { key, label, plans: [] })
    groups.get(key).plans.push(plan)
  })
  return Array.from(groups.values())
})

watch(
  savedPlanGroups,
  (groups) => {
    const keys = groups.map(group => group.key)
    if (!keys.length) {
      openSavedGroupKeys.value = []
      return
    }
    const current = openSavedGroupKeys.value.filter(key => keys.includes(key))
    if (current.length) {
      openSavedGroupKeys.value = current
      return
    }
    openSavedGroupKeys.value = [keys[0]]
  },
  { immediate: true, deep: true }
)

const managerVisible = computed({
  get: () => investmentPlanStore.managerVisible,
  set: (v) => { investmentPlanStore.managerVisible = !!v }
})
const selectedPlanId = ref('')
const editablePlanName = ref('')
const selectedPlan = computed(() => savedPlans.value.find(p => p.id === selectedPlanId.value) || null)

watch(selectedPlan, (val) => {
  editablePlanName.value = val?.name || ''
}, { immediate: true })

const generatorVisible = computed({
  get: () => investmentPlanStore.generatorVisible,
  set: (v) => { investmentPlanStore.generatorVisible = !!v }
})

const generationMode = ref('portfolio')
const draftName = ref('')
const draftRows = ref([])
const totalCapitalYuan = ref(200000)

const autoTradeStrategyId = ref(null)
const buyDraftRows = computed(() => (draftRows.value || []).filter(r => r.action === 'buy'))
const sellDraftRows = computed(() => (draftRows.value || []).filter(r => r.action === 'sell'))
const strategyDraftSections = computed(() => ([
  { key: 'buy', title: '买入候选', rows: buyDraftRows.value, emptyText: '当前暂无买入候选' },
  { key: 'sell', title: '卖出候选', rows: sellDraftRows.value, emptyText: '当前暂无卖出候选' }
]))

const draftStats = computed(() => {
  const rows = draftRows.value || []
  const buyRows = rows.filter(r => r.action === 'buy')
  const sellRows = rows.filter(r => r.action === 'sell')
  const totalBudget = buyRows.reduce((s, r) => s + (Number(r.budgetYuan) || 0), 0)
  const totalWeight = buyRows.reduce((s, r) => s + (Number(r.targetWeight) || 0), 0)
  return {
    totalRows: rows.length,
    buyRows: buyRows.length,
    sellRows: sellRows.length,
    totalBudget: Math.round(totalBudget),
    totalWeight: Number(totalWeight.toFixed(2))
  }
})

const canGeneratePlan = computed(() => {
  return (draftRows.value || []).some(r => r.symbol && r.strategyId)
})

const normalizeShares = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n / LOT_SIZE) * LOT_SIZE
}

const getQuote = (code) => {
  const q = stockStore.getStockByCodeEnriched?.(code)
    || stockStore.quotesByCode?.[code]
    || {}
  return q || {}
}

const calcRetailBuyPlan = ({ price, buyShares, budgetYuan, totalCapital, targetWeight }) => {
  const p = Number(price)
  const capital = Number(totalCapital)
  const weight = Number(targetWeight)
  let shares = normalizeShares(buyShares)
  let budget = Number(budgetYuan)
  let tip = ''

  if (shares > 0) {
    if (Number.isFinite(p) && p > 0) budget = Math.round(shares * p)
    if (Number.isFinite(capital) && capital > 0 && Number.isFinite(budget)) {
      return {
        buyShares: shares,
        buyLots: shares / LOT_SIZE,
        budgetYuan: budget,
        targetWeight: Number(((budget / capital) * 100).toFixed(2)),
        tip
      }
    }
    return {
      buyShares: shares,
      buyLots: shares / LOT_SIZE,
      budgetYuan: Number.isFinite(budget) ? Math.max(0, Math.round(budget)) : null,
      targetWeight: Number.isFinite(weight) ? weight : null,
      tip
    }
  }

  if (!Number.isFinite(budget) || budget <= 0) {
    if (Number.isFinite(capital) && capital > 0 && Number.isFinite(weight) && weight > 0) {
      budget = (capital * weight) / 100
    }
  }

  if (!Number.isFinite(p) || p <= 0) {
    return {
      buyShares: null,
      buyLots: null,
      budgetYuan: Number.isFinite(budget) ? Math.max(0, Math.round(budget)) : null,
      targetWeight: Number.isFinite(weight) ? weight : null,
      tip
    }
  }

  if (!Number.isFinite(budget) || budget <= 0) {
    return {
      buyShares: null,
      buyLots: null,
      budgetYuan: null,
      targetWeight: Number.isFinite(weight) ? weight : null,
      tip
    }
  }

  let lots = Math.floor(budget / (p * LOT_SIZE))
  if (lots < 1) {
    lots = 1
    tip = '预算不足1手，按1手估算'
  }
  shares = lots * LOT_SIZE
  budget = Math.round(shares * p)

  return {
    buyShares: shares,
    buyLots: lots,
    budgetYuan: budget,
    targetWeight: Number.isFinite(capital) && capital > 0
      ? Number(((budget / capital) * 100).toFixed(2))
      : (Number.isFinite(weight) ? weight : null),
    tip
  }
}

const newDraftRow = () => {
  const firstStock = stockOptions.value[0] || null
  const defaultStrategyId = currentAppliedTradeId.value || tradeStrategies.value[0]?.id || null
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: firstStock?.code || '',
    stockName: firstStock?.name || '',
    strategyId: defaultStrategyId,
    action: 'buy',
    targetWeight: 10,
    budgetYuan: null,
    buyShares: null,
    buyLots: null,
    reason: ''
  }
}

const resetDraftRowsByMode = () => {
  if (generationMode.value === 'single') {
    draftRows.value = [newDraftRow()]
    return
  }
  const rows = stockOptions.value.slice(0, 8).map((s, idx) => {
    const base = newDraftRow()
    return {
      ...base,
      id: `draft-${Date.now()}-${idx}`,
      symbol: s.code,
      stockName: s.name
    }
  })
  draftRows.value = rows.length ? rows : [newDraftRow()]
}

const getCandidateCodes = () => {
  if (autoCandidateScope.value === 'all') {
    return Array.from(new Set((stockStore.stockBaseList || []).map(s => s.code).filter(Boolean)))
  }
  const fav = Array.from(new Set((stockStore.myStockCodes || []).filter(Boolean)))
  if (fav.length) return fav
  return Array.from(new Set((stockStore.stockBaseList || []).map(s => s.code).filter(Boolean)))
}

const generateByStrategy = () => {
  const strategy = findStrategyById(autoTradeStrategyId.value)
  if (!strategy?.snapshot) {
    ElMessage.warning('请先选择交易策略')
    return
  }

  const candidates = getCandidateCodes()
  if (!candidates.length) {
    ElMessage.warning('当前没有可用股票池')
    return
  }

  const evaluated = candidates.map((code) => {
    const stock = findStockByCode(code)
    const quote = getQuote(code)
    const result = evaluateTradeStrategyForQuote(strategy.snapshot, quote || {})
    return {
      code,
      name: stock?.name || quote?.name || code,
      quote,
      result
    }
  })

  const picks = evaluated
    .slice()
    .sort((a, b) => Number(b.result?.score || 0) - Number(a.result?.score || 0))

  if (!picks.length) {
    draftRows.value = []
    ElMessage.warning('当前股票池暂无可推荐股票')
    return
  }

  // 自动生成交易方案保留买入和卖出信号，观望不入候选。
  const actionablePicks = picks.filter((item) => {
    const action = item.result?.action || 'hold'
    return action !== 'hold'
  })

  if (!actionablePicks.length) {
    draftRows.value = []
    ElMessage.info('当前策略在该股票池暂无买卖信号')
    return
  }

  const buyCount = actionablePicks.filter(item => item.result?.action === 'buy').length
  const baseInit = Number(strategy.snapshot?.position?.initialValue)
  const equalWeight = buyCount > 0 ? Number((100 / buyCount).toFixed(2)) : 0
  const buyWeight = (baseInit > 0 && buyCount > 0 && baseInit * buyCount <= 100) ? baseInit : equalWeight

  draftRows.value = actionablePicks.map((item, idx) => {
    const action = item.result?.action || 'hold'
    const sizing = action === 'buy'
      ? calcRetailBuyPlan({
        price: item.quote?.price ?? item.quote?.close,
        totalCapital: totalCapitalYuan.value,
        targetWeight: buyWeight
      })
      : { buyShares: 0, buyLots: 0, budgetYuan: 0, targetWeight: 0, tip: '' }

    const reason = item.result?.reason || ''
    const tip = sizing.tip ? `；${sizing.tip}` : ''

    return {
      id: `draft-auto-${Date.now()}-${idx}`,
      symbol: item.code,
      stockName: item.name,
      strategyId: strategy.id,
      action,
      targetWeight: sizing.targetWeight,
      budgetYuan: sizing.budgetYuan,
      buyShares: sizing.buyShares,
      buyLots: sizing.buyLots,
      reason: `系统推荐：${reason}${tip}`,
      score: item.result?.score ?? 0
    }
  })
  ElMessage.success(`已推荐 ${draftRows.value.length} 条方案候选`)
}

const onSourceChange = () => {
  if (generationSource.value === 'byStock') {
    resetDraftRowsByMode()
    return
  }
  draftRows.value = []
}

watch(generationSource, () => {
  onSourceChange()
})

const openGenerator = () => {
  investmentPlanStore.openGenerator?.()
  draftName.value = ''
  generationSource.value = 'byStrategy'
  generationMode.value = 'portfolio'
  autoTradeStrategyId.value = currentAppliedTradeId.value || tradeStrategies.value[0]?.id || null
  autoCandidateScope.value = 'my'
  draftRows.value = []
}

const removeDraftRow = (id) => {
  draftRows.value = draftRows.value.filter(r => r.id !== id)
  if (!draftRows.value.length && generationSource.value === 'byStock') {
    draftRows.value = [newDraftRow()]
  }
}

const onDraftStockChange = (row, code) => {
  const s = findStockByCode(code)
  row.symbol = code
  row.stockName = s?.name || code
}

const onDraftStrategyChange = (row, strategyId) => {
  row.strategyId = strategyId
}

const onDraftActionChange = (row) => {
  if (row.action !== 'buy') {
    row.buyShares = 0
    row.buyLots = 0
    if (row.targetWeight == null) row.targetWeight = 0
    if (row.budgetYuan == null) row.budgetYuan = 0
  }
}

const onDraftSizingInput = (row) => {
  if (row.action !== 'buy') return
  const quote = getQuote(row.symbol)
  const sizing = calcRetailBuyPlan({
    price: quote?.price ?? quote?.close,
    budgetYuan: row.budgetYuan,
    totalCapital: totalCapitalYuan.value,
    targetWeight: row.targetWeight
  })
  row.buyShares = sizing.buyShares
  row.buyLots = sizing.buyLots
  row.budgetYuan = sizing.budgetYuan
  row.targetWeight = sizing.targetWeight
}

const onDraftSharesChange = (row, val) => {
  if (row.action !== 'buy') return
  const quote = getQuote(row.symbol)
  const sizing = calcRetailBuyPlan({
    price: quote?.price ?? quote?.close,
    buyShares: val,
    totalCapital: totalCapitalYuan.value,
    targetWeight: row.targetWeight,
    budgetYuan: row.budgetYuan
  })
  row.buyShares = sizing.buyShares
  row.buyLots = sizing.buyLots
  row.budgetYuan = sizing.budgetYuan
  row.targetWeight = sizing.targetWeight
}

const applyEqualWeight = () => {
  const buyRows = draftRows.value.filter(r => r.action === 'buy')
  if (!buyRows.length) return
  const weight = Number((100 / buyRows.length).toFixed(2))
  buyRows.forEach((row) => {
    row.targetWeight = weight
    onDraftSizingInput(row)
  })
}

const recalcDraftByBudget = () => {
  draftRows.value.forEach((row) => {
    if (row.action === 'buy') onDraftSizingInput(row)
  })
}

const draftRowClassName = ({ row }) => {
  if (row.action === 'buy') return 'row-buy'
  if (row.action === 'sell') return 'row-sell'
  return 'row-hold'
}

const buildPlanRowsFromDraft = () => {
  const rows = []
  for (const r of draftRows.value) {
    if (!r.symbol || !r.strategyId) continue
    const strategy = findStrategyById(r.strategyId)
    if (!strategy?.snapshot) continue

    const quote = getQuote(r.symbol)
    const result = evaluateTradeStrategyForQuote(strategy.snapshot, quote || {})
    const action = r.action || result.action || 'buy'

    let targetWeight = r.targetWeight ?? null
    let budgetYuan = r.budgetYuan ?? null
    let buyShares = r.buyShares ?? null
    let buyLots = r.buyLots ?? null

    if (action === 'buy') {
      const sizing = calcRetailBuyPlan({
        price: quote?.price ?? quote?.close,
        buyShares,
        budgetYuan,
        totalCapital: totalCapitalYuan.value,
        targetWeight
      })
      targetWeight = sizing.targetWeight
      budgetYuan = sizing.budgetYuan
      buyShares = sizing.buyShares
      buyLots = sizing.buyLots
    } else {
      budgetYuan = 0
      targetWeight = 0
      buyShares = 0
      buyLots = 0
    }

    rows.push({
      id: `${r.strategyId}-${r.symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol: r.symbol,
      stockName: r.stockName || r.symbol,
      action,
      score: r.score ?? result.score ?? 0,
      targetWeight,
      budgetYuan,
      buyShares,
      buyLots,
      reason: r.reason || result.reason || '',
      quote: {
        price: quote?.price ?? quote?.close ?? null,
        changePercent: quote?.changePercent ?? quote?.change ?? null,
        volumeRatio: quote?.volumeRatio ?? quote?.volRatio ?? null,
        netInflow: quote?.netInflow ?? null
      },
      generatedAt: Date.now()
    })
  }
  return rows
}

const confirmGeneratePlan = () => {
  const rows = buildPlanRowsFromDraft()
  if (!rows.length) {
    ElMessage.warning('请至少配置一只股票和对应交易策略')
    return
  }

  const strategyName = generationSource.value === 'byStrategy'
    ? (findStrategyById(autoTradeStrategyId.value)?.name || '策略推荐组合')
    : '自定义组合策略'

  const created = investmentPlanStore.createPlan({
    name: draftName.value,
    rows,
    strategyId: generationSource.value === 'byStrategy' ? autoTradeStrategyId.value : null,
    strategyName
  })

  if (!created) {
    ElMessage.warning('生成失败，请检查输入')
    return
  }

  selectedPlanId.value = created.id
  generatorVisible.value = false
  ElMessage.success(`已生成交易方案：${created.name}`)
}

const openManager = () => {
  investmentPlanStore.openManager?.()
  selectedPlanId.value = investmentPlanStore.activePlanId || savedPlans.value[0]?.id || ''
}

const selectPlan = (planId) => {
  selectedPlanId.value = planId
  investmentPlanStore.loadPlan(planId)
}

const loadSavedPlan = (planId) => {
  const loaded = investmentPlanStore.loadPlan(planId)
  if (!loaded) return
  selectedPlanId.value = planId
  ElMessage.success(`已切换到：${loaded.name}`)
}

const renameSelectedPlan = () => {
  if (!selectedPlan.value) return
  investmentPlanStore.renamePlan(selectedPlan.value.id, editablePlanName.value)
  ElMessage.success('方案名称已更新')
}

const removeSelectedPlan = async () => {
  if (!selectedPlan.value) return
  try {
    await ElMessageBox.confirm(`确认删除方案「${selectedPlan.value.name}」？`, '删除方案', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    const removedId = selectedPlan.value.id
    investmentPlanStore.removePlan(removedId)
    selectedPlanId.value = savedPlans.value[0]?.id || ''
    if (selectedPlanId.value) investmentPlanStore.loadPlan(selectedPlanId.value)
    ElMessage.success('已删除方案')
  } catch (err) {
    void err
  }
}

const onManagerStrategyChange = (row, strategyId) => {
  const strategy = findStrategyById(strategyId)
  investmentPlanStore.updatePlanRow({
    planId: selectedPlan.value.id,
    rowId: row.id,
    patch: {
      strategyId,
      strategyName: strategy?.name || ''
    }
  })
}

const updateRow = (rowId, patch) => {
  if (!selectedPlan.value) return
  investmentPlanStore.updatePlanRow({
    planId: selectedPlan.value.id,
    rowId,
    patch
  })
}
</script>

<style scoped>
.plan-generator-dialog :deep(.el-dialog){
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(30, 64, 175, .18);
  box-shadow: 0 28px 64px rgba(15, 23, 42, .24);
  animation: generator-rise .22s ease-out;
}
.plan-generator-dialog :deep(.el-dialog__header){
  padding: 16px 20px 13px;
  border-bottom: 1px solid rgba(148, 163, 184, .25);
  background: #fff;
}
.plan-generator-dialog :deep(.el-dialog__title){
  font-size: 20px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: .4px;
}
.plan-generator-dialog :deep(.el-dialog__body){
  padding: 14px 18px 12px;
  background: #fff;
}
.plan-generator-dialog :deep(.el-dialog__footer){
  padding: 12px 18px 16px;
  border-top: 1px solid rgba(148, 163, 184, .2);
  background: #fff;
}
.plan-generator-dialog :deep(.el-dialog__footer .el-button){
  min-width: 118px;
  height: 36px;
  border-radius: 11px;
  font-weight: 800;
}
.plan-generator-dialog :deep(.el-dialog__footer .el-button--primary){
  border: none;
  background: linear-gradient(135deg, #2b7fff, #1d4ed8);
  box-shadow: 0 8px 16px rgba(29,78,216,.32);
}

.scroll-hidden{ scrollbar-width:none; -ms-overflow-style:none; }
.scroll-hidden::-webkit-scrollbar{ width:0; height:0; }

.plan-dock{
  width: 100%;
  height: 100%;
  min-height: 0;
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
.plan-head-actions{
  display:flex;
  align-items:center;
  gap: 4px;
}
.btn-mini{
  padding: 0 8px !important;
  height: 24px !important;
  border-radius: 12px !important;
  font-weight: 800;
}
.plan-meta{ display:flex; flex-direction:column; gap:2px; }
.plan-sub{ font-weight: 700; font-size: 11px; color:#9ca3af; }

.plan-content{
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-list{
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
.plan-line1{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
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
.plan-line2{ margin-top:6px; display:flex; align-items:center; gap:6px; font-size:11px; overflow:hidden; }
.mini{ font-weight: 900; color:#9ca3af; }
.val{ font-weight: 900; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.saved-list{
  border-top: 1px solid rgba(148,163,184,.18);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.saved-collapse{
  border-top: 0;
}
.saved-collapse :deep(.el-collapse-item){
  margin-bottom: 6px;
  border: 0;
}
.saved-collapse :deep(.el-collapse-item__header){
  width: 240px;
  min-height: 32px;
  line-height: normal;
  border-bottom: 0;
  background: #fff;
  padding: 1px 8px;
  border: 1px solid rgba(148,163,184,.16);
  border-radius: 6px;
  gap: 6px;
  box-shadow: 0 1px 2px rgba(15,23,42,.02);
}
.saved-collapse :deep(.el-collapse-item__wrap){
  border-bottom: 0;
  background: transparent;
}
.saved-collapse :deep(.el-collapse-item__content){
  padding-bottom: 0;
  padding-top: 2px;
}
.saved-collapse :deep(.el-collapse-item__arrow){
  color: #94a3b8;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.saved-head{ font-size: 12px; font-weight: 800; color: #6b7280; }
.saved-group{
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.saved-group-head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.saved-group-title{
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.saved-group-icon{
  font-size: 14px;
  color: #e6a23c;
  flex-shrink: 0;
}
.saved-group-name{
  font-size: 12px;
  font-weight: 800;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.saved-group-count{
  font-size: 11px;
  font-weight: 800;
  color: #9ca3af;
  min-width: 18px;
  text-align: right;
}
.saved-group-list{
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
  position: relative;
}
.saved-group-list::before{
  content: '';
  position: absolute;
  left: 6px;
  top: 4px;
  bottom: 8px;
  width: 1px;
  background: rgba(148,163,184,.24);
}
.saved-item{
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid rgba(148,163,184,.18);
  border-radius: 12px;
  background: #fff;
  padding: 8px 10px;
  box-shadow: 0 4px 10px rgba(15,23,42,.04);
  cursor: pointer;
  transition: border-color .12s ease, box-shadow .12s ease, background .12s ease;
}
.saved-item:hover{
  border-color: rgba(96,165,250,.28);
  box-shadow: 0 8px 16px rgba(15,23,42,.06);
}
.saved-item-rail{
  position: absolute;
  left: -9px;
  top: 15px;
  width: 7px;
  height: 1px;
  background: rgba(148,163,184,.24);
}
.saved-item-icon{
  margin-top: 2px;
  font-size: 13px;
  color: #7b8aa3;
  flex-shrink: 0;
}
.saved-item-main{
  min-width: 0;
  flex: 1 1 auto;
}
.saved-item.active{
  border-color: rgba(96,165,250,.55);
  background: linear-gradient(180deg, rgba(239,246,255,.9) 0%, rgba(247,250,255,.95) 100%);
  box-shadow: 0 8px 18px rgba(96,165,250,.12);
}
.saved-name{
  font-size: 12px;
  font-weight: 900;
  color: #1f2d3d;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.saved-time{
  margin-top: 2px;
  font-size: 11px;
  color: #9ca3af;
  display: block;
}
.manager-plan-group{
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.manager-plan-collapse{
  border-top: 0;
}
.manager-plan-collapse :deep(.el-collapse-item){
  margin-bottom: 6px;
  border: 0;
}
.manager-plan-collapse :deep(.el-collapse-item__header){
  height: auto;
  min-height: 32px;
  line-height: normal;
  border-bottom: 0;
  background: #fff;
  padding: 1px 8px;
  border: 1px solid rgba(148,163,184,.16);
  border-radius: 6px;
  gap: 6px;
  box-shadow: 0 1px 2px rgba(15,23,42,.02);
}
.manager-plan-collapse :deep(.el-collapse-item__wrap){
  border-bottom: 0;
  background: transparent;
}
.manager-plan-collapse :deep(.el-collapse-item__content){
  padding-bottom: 0;
  padding-top: 2px;
}
.manager-plan-collapse :deep(.el-collapse-item__arrow){
  color: #94a3b8;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.manager-plan-group-head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.manager-plan-group-name{
  font-size: 12px;
  font-weight: 800;
  color: #374151;
}
.manager-plan-group-count{
  font-size: 11px;
  font-weight: 800;
  color: #9ca3af;
  min-width: 18px;
  text-align: right;
}
.manager-plan-group-list{
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
  position: relative;
}
.manager-plan-group-list::before{
  content: '';
  position: absolute;
  left: 6px;
  top: 4px;
  bottom: 8px;
  width: 1px;
  background: rgba(148,163,184,.24);
}
.manager-plan-item{
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid rgba(148,163,184,.18);
  border-radius: 12px;
  background: #fff;
  padding: 8px 10px;
  box-shadow: 0 4px 10px rgba(15,23,42,.04);
  cursor: pointer;
  transition: border-color .12s ease, box-shadow .12s ease, background .12s ease;
}
.manager-plan-item:hover{
  border-color: rgba(96,165,250,.28);
  box-shadow: 0 8px 16px rgba(15,23,42,.06);
}
.manager-plan-item.active{
  border-color: rgba(96,165,250,.55);
  background: linear-gradient(180deg, rgba(239,246,255,.9) 0%, rgba(247,250,255,.95) 100%);
  box-shadow: 0 8px 18px rgba(96,165,250,.12);
}
.manager-plan-item-main{
  min-width: 0;
  flex: 1 1 auto;
}

.empty-box{
  border: 1px dashed rgba(0,0,0,.10);
  background: rgba(0,0,0,.02);
  border-radius: 12px;
  padding: 10px;
}
.empty-title{ font-weight: 900; color:#6b7280; font-size: 12px; }
.empty-sub{ margin-top:6px; font-weight:800; color:#9ca3af; font-size:12px; line-height:1.35; }

.generator-hero{
  margin-bottom: 10px;
  border-radius: 14px;
  border: 1px solid rgba(37, 99, 235, .18);
  background:
    radial-gradient(120% 130% at 0% 0%, rgba(37,99,235,.16), transparent 52%),
    linear-gradient(160deg, #ffffff 0%, #f7fbff 100%);
  padding: 10px 12px;
}
.hero-title{
  font-size: 13px;
  font-weight: 900;
  color: #0f172a;
}
.hero-sub{
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 700;
  color: #4b5568;
}

.generator-top{
  display: grid;
  grid-template-columns: minmax(180px, 1.1fr) minmax(130px, .62fr) minmax(180px, 1fr) minmax(150px, .82fr) minmax(120px, .6fr);
  align-items: end;
  gap: 10px;
  margin-bottom: 10px;
}

.source-tabs{
  margin-bottom: 10px;
}
.source-tabs :deep(.el-tabs__header){
  margin-bottom: 8px;
}
.source-tabs :deep(.el-tabs__item){
  font-weight: 900;
  font-size: 15px;
  color: #64748b;
}
.source-tabs :deep(.el-tabs__item.is-active){
  color: #1d4ed8;
}
.source-tabs :deep(.el-tabs__active-bar){
  height: 2px;
  border-radius: 999px;
}

.generator-steps{
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8fa0b7;
  font-size: 12px;
  font-weight: 800;
}

.step-item{
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,.35);
  background: rgba(255,255,255,.8);
}

.step-item.done{
  color: #1d4ed8;
  border-color: rgba(37,99,235,.42);
  background: rgba(37,99,235,.12);
  box-shadow: 0 5px 12px rgba(37,99,235,.14);
}

.step-sep{
  color: #cbd5e1;
}

.generator-subtop{
  margin-bottom: 10px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 12px;
}

.card-like{
  background: #fff;
  border: 1px solid rgba(59,130,246,.18);
  border-radius: 14px;
  padding: 10px 12px;
  box-shadow: 0 8px 24px rgba(15,23,42,.06);
}

.g-field{
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.g-label{
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 800;
  color: #64748b;
}

.g-action{
  justify-content: flex-end;
}

.g-field-name{
  min-width: 0;
}

.g-field-capital{
  min-width: 0;
}

.g-field-strategy{
  min-width: 0;
}

.g-field-pool{
  min-width: 0;
}

.g-field-mode{
  min-width: 0;
}

.g-field-action{
  min-width: 0;
}
.g-field-action :deep(.el-button){
  width: 100%;
  min-width: 0;
}

.g-field :deep(.el-input),
.g-field :deep(.el-select),
.g-field :deep(.el-input-number){
  width: 100%;
}

.g-field :deep(.el-input__wrapper),
.g-field :deep(.el-select__wrapper),
.g-field :deep(.el-input-number){
  min-height: 38px;
}

.generator-summary{
  margin: 2px 0 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-chip{
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,.32);
  background: rgba(255,255,255,.88);
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.summary-chip.buy{
  border-color: rgba(34,197,94,.4);
  background: rgba(34,197,94,.1);
  color: #15803d;
}
.summary-chip.sell{
  border-color: rgba(239,68,68,.35);
  background: rgba(239,68,68,.08);
  color: #b91c1c;
}

.summary-chip.warn{
  border-color: rgba(239,68,68,.35);
  background: rgba(239,68,68,.08);
  color: #b91c1c;
}

.summary-actions{
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.summary-actions :deep(.el-button){
  border-radius: 10px;
  font-weight: 800;
}

.draft-sections{
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.draft-section{
  border: 1px solid rgba(148,163,184,.18);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.draft-section-head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(148,163,184,.16);
  background: #f8fafc;
}
.draft-section-title{
  font-size: 13px;
  font-weight: 900;
  color: #334155;
}
.draft-section-count{
  font-size: 12px;
  font-weight: 800;
  color: #64748b;
}

.draft-table-actions{
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
.draft-table-actions :deep(.el-button){
  border-radius: 10px;
  font-weight: 800;
}

.table-empty{
  padding: 36px 0 40px;
}

.table-empty .empty-main{
  font-size: 18px;
  font-weight: 900;
  color: #475569;
}

.table-empty .empty-sub{
  margin-top: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #94a3b8;
}
.table-empty-small{
  padding: 18px 0 20px;
}
.table-empty-small .empty-sub{
  margin-top: 0;
  font-size: 13px;
}

:deep(.el-table .row-buy td){
  background: rgba(34,197,94,.04);
}
:deep(.el-table .row-sell td){
  background: rgba(239,68,68,.04);
}
:deep(.el-table th.el-table__cell){
  background: #f8fafc !important;
  color: #64748b;
  font-weight: 900;
}
:deep(.el-table td.el-table__cell){
  border-bottom-color: rgba(148,163,184,.18) !important;
}
:deep(.el-table){
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148,163,184,.18);
}

@media (max-width: 1180px){
  .generator-top{
    grid-template-columns: 1fr 1fr;
    row-gap: 10px;
  }
  .g-field-strategy,
  .g-field-pool,
  .g-field-mode{
    grid-column: 1 / 2;
  }
  .g-field-action{
    grid-column: 1 / 3;
  }
  .summary-actions{
    margin-left: 0;
    width: 100%;
  }
}

.manager-shell{ display:grid; grid-template-columns:260px 1fr; gap:12px; }
.manager-left{ border-right:1px solid rgba(0,0,0,.08); padding-right:12px; }
.manager-left-head{ font-weight:800; color:#374151; margin-bottom:8px; }
.manager-list{ max-height:420px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
.manager-plan-item{ border:1px solid rgba(0,0,0,.08); border-radius:10px; padding:8px; cursor:pointer; }
.manager-plan-item.active{ border-color:rgba(64,158,255,.45); background:rgba(64,158,255,.08); }
.manager-plan-name{ font-weight:900; font-size:12px; color:#111827; }
.manager-plan-time{ margin-top:3px; font-size:11px; color:#9ca3af; }
.manager-right{ min-width:0; }
.manager-tools{ display:grid; grid-template-columns:1fr 110px 110px; gap:8px; margin-bottom:10px; }
.manager-empty{ display:flex; align-items:center; justify-content:center; color:#9ca3af; font-weight:800; }

@keyframes generator-rise{
  from{
    opacity: .2;
    transform: translateY(8px) scale(.992);
  }
  to{
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
