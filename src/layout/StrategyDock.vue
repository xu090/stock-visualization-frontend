<template>
  <div class="strategy-dock" id="tour-strategy">
    <!-- 顶部：标题 + 保存入口 -->
    <div class="strategy-header">
      <div class="h-top">
        <span class="strategy-title">策略中心</span>

        <div class="h-top-actions" id="tour-strategy-save">
          <el-button class="btn-mini" size="small" plain @click="allDialogVisible = true">
            全部策略
          </el-button>
          <el-button class="btn-mini" size="small" type="primary" plain @click="openCreate('select')">
            保存选股
          </el-button>
          <el-button class="btn-mini" size="small" plain @click="openCreate('trade')">
            保存交易
          </el-button>
        </div>
      </div>

      <!-- 当前应用 -->
      <div class="h-current" id="tour-strategy-current">
        <div class="cur-row">
          <span class="cur-label">选股</span>
          <span
            class="cur-name"
            :class="{ clickable: !!currentAppliedSelectId }"
            :title="currentAppliedSelectName || '无'"
            @click="jumpToApplied('select')"
          >
            {{ currentAppliedSelectName || '无' }}
          </span>
          <el-button
            class="btn-mini btn-clear"
            size="small"
            plain
            :disabled="!currentAppliedSelectId"
            @click="clearApplied('select')"
          >
            清空
          </el-button>
        </div>

        <div class="cur-row">
          <span class="cur-label">交易</span>
          <span
            class="cur-name"
            :class="{ clickable: !!currentAppliedTradeId }"
            :title="currentAppliedTradeName || '无'"
            @click="jumpToApplied('trade')"
          >
            {{ currentAppliedTradeName || '无' }}
          </span>
          <el-button
            class="btn-mini btn-clear"
            size="small"
            plain
            :disabled="!currentAppliedTradeId"
            @click="clearApplied('trade')"
          >
            清空
          </el-button>
        </div>
      </div>
    </div>

    <!-- 列表区域 -->
    <div class="strategy-body scroll-hidden" ref="bodyRef">
      <!-- 选股策略 -->
      <div class="section">
        <div class="section-head">
          <span class="section-title">选股策略</span>
          <span class="section-sub">收藏 {{ selectFavoriteCount }} / 自定义 {{ selectCustomCount }}</span>
        </div>

        <div class="strategy-list" v-if="selectMineStrategies.length">
          <el-popover
            v-for="s in selectMineStrategies"
            :key="`sel-${s.id}`"
            placement="right-start"
            :width="360"
            trigger="click"
            :show-arrow="true"
            :popper-options="fixedPopperOptions"
            :popper-class="'strategy-popover'"
            @show="setActivePopover('select', s, getSelEl(s.id))"
            @hide="clearActivePopover"
          >
            <template #reference>
              <div
                class="strategy-item"
                :ref="(el) => setSelRef(s.id, el)"
                :class="{
                  applied: s.id === currentAppliedSelectId
                }"
              >
                <!-- 点击卡片：打开 Popover（reference） -->
                <div class="s-main">
                  <div class="s-line1">
                    <span class="s-name" :title="s.name">{{ s.name }}</span>
                    <span v-if="s.isCustom" class="tag custom inline-tag">自定义</span>
                    <span v-if="s.id === currentAppliedSelectId" class="badge">应用</span>
                    <button
                      class="star-btn"
                      type="button"
                      :title="s.isFavorite ? '取消收藏' : '收藏'"
                      @click.stop="toggleFavorite('select', s)"
                    >
                      <el-icon class="star-icon" :class="{ on: s.isFavorite }">
                        <StarFilled v-if="s.isFavorite" />
                        <Star v-else />
                      </el-icon>
                    </button>
                    
                  </div>

                  <div class="s-line2" v-if="s.snapshot">
                    <span class="mini">排序</span>
                    <span class="val">{{ metricsTextShort(s.snapshot) }}</span>
                  </div>
                  <div class="s-line2" v-if="s.snapshot">
                    <span class="mini">筛选</span>
                    <span class="val">{{ filtersTextShort(s.snapshot) }}</span>
                  </div>
                  <div class="s-line2" v-if="!s.snapshot">
                    <span class="val">无快照</span>
                  </div>
                </div>

                <!-- 卡片按钮区：保持原功能 -->
                <div class="s-actions" @click.stop>
                  <el-button
                    class="btn-act"
                    size="small"
                    type="primary"
                    :plain="s.id !== currentAppliedSelectId"
                    @click="toggleApply('select', s)"
                  >
                    {{ s.id === currentAppliedSelectId ? '取消' : '应用' }}
                  </el-button>

                  <el-button class="btn-act" size="small" plain @click="openEdit('select', s)">
                    编辑
                  </el-button>

                  <el-button class="btn-act" size="small" plain type="danger" @click="removeStrategySafe('select', s)">
                    删除
                  </el-button>
                </div>
              </div>
            </template>

            <!-- Popover 内容：只留“关闭/应用”，条件正常一段话展示 -->
            <div class="pop-body" v-if="activeStrategy">
              <div class="pop-title">选股策略：{{ activeStrategy.name }}</div>

              <div class="pop-grid">
                <div class="pop-row" v-if="activeStrategy.desc">
                  <div class="k">描述</div>
                  <div class="v">{{ activeStrategy.desc }}</div>
                </div>

                <div class="pop-row">
                  <div class="k">排序</div>
                  <div class="v">{{ detailSortText }}</div>
                </div>

                <div class="pop-row">
                  <div class="k">筛选</div>
                  <div class="v">{{ detailFilterText }}</div>
                </div>
              </div>

              <div class="pop-actions">
                <el-button size="small" @click="closeActivePopover()">关闭</el-button>
                <el-button
                  size="small"
                  type="primary"
                  :disabled="activeApplyDisabled"
                  @click="applyFromPopoverAndClose()"
                >
                  {{ activeApplyText }}
                </el-button>
              </div>
            </div>
          </el-popover>
        </div>

        <div v-else class="empty-trade">
          <div class="empty-title">暂无选股策略</div>
          <div class="empty-sub">当前只展示“收藏”或“自建”策略，可在“全部策略”中收藏。</div>
        </div>
      </div>

      <!-- 交易策略 -->
      <div class="section">
        <div class="section-head">
          <span class="section-title">交易策略</span>
        </div>

        <div class="strategy-list" v-if="tradeMineStrategies.length">
          <el-popover
            v-for="s in tradeMineStrategies"
            :key="`tr-${s.id}`"
            placement="right-start"
            :width="360"
            trigger="click"
            :show-arrow="true"
            :popper-options="fixedPopperOptions"
            :popper-class="'strategy-popover'"
            @show="setActivePopover('trade', s, getTrEl(s.id))"
            @hide="clearActivePopover"
          >
            <template #reference>
              <div
                class="strategy-item"
                :ref="(el) => setTrRef(s.id, el)"
                :class="{
                  applied: s.id === currentAppliedTradeId
                }"
              >
                <div class="s-main">
                  <div class="s-line1">
                    <span class="s-name" :title="s.name">{{ s.name }}</span>
                    <span v-if="s.isCustom" class="tag custom inline-tag">自定义</span>
                    <span v-if="s.id === currentAppliedTradeId" class="badge">应用</span>
                    <button
                      class="star-btn"
                      type="button"
                      :title="s.isFavorite ? '取消收藏' : '收藏'"
                      @click.stop="toggleFavorite('trade', s)"
                    >
                      <el-icon class="star-icon" :class="{ on: s.isFavorite }">
                        <StarFilled v-if="s.isFavorite" />
                        <Star v-else />
                      </el-icon>
                    </button>
                    
                  </div>

                  <div class="s-line2" v-if="s.snapshot">
                    <span class="mini">规则</span>
                    <span class="val">{{ tradeRulesTextShort(s.snapshot) }}</span>
                  </div>
                  <div class="s-line2" v-if="!s.snapshot">
                    <span class="val">无快照</span>
                  </div>
                </div>

                <div class="s-actions" @click.stop>
                  <el-button
                    class="btn-act"
                    size="small"
                    type="primary"
                    :plain="s.id !== currentAppliedTradeId"
                    @click="toggleApply('trade', s)"
                  >
                    {{ s.id === currentAppliedTradeId ? '取消' : '应用' }}
                  </el-button>

                  <el-button class="btn-act" size="small" plain @click="openEdit('trade', s)">
                    编辑
                  </el-button>

                  <el-button class="btn-act" size="small" plain type="danger" @click="removeStrategySafe('trade', s)">
                    删除
                  </el-button>
                </div>
              </div>
            </template>

            <div class="pop-body" v-if="activeStrategy">
              <div class="pop-title">交易策略：{{ activeStrategy.name }}</div>

              <div class="pop-grid">
                <div class="pop-row" v-if="activeStrategy.desc">
                  <div class="k">描述</div>
                  <div class="v">{{ activeStrategy.desc }}</div>
                </div>

                <div class="pop-row">
                  <div class="k">规则</div>
                  <div class="v">{{ detailTradeText }}</div>
                </div>
              </div>

              <div class="pop-actions">
                <el-button size="small" @click="closeActivePopover()">关闭</el-button>
                <el-button
                  size="small"
                  type="primary"
                  :disabled="activeApplyDisabled"
                  @click="applyFromPopoverAndClose()"
                >
                  {{ activeApplyText }}
                </el-button>
              </div>
            </div>
          </el-popover>
        </div>

        <div v-else class="empty-trade">
          <div class="empty-title">暂无交易策略</div>
          <div class="empty-sub">后续可在这里保存：买点 / 卖点 / 止损止盈 / 仓位等，也可在“全部策略”中收藏。</div>
        </div>
      </div>
    </div>

    <AllStrategyDialog
      ref="allDialogRef"
      v-model="allDialogVisible"
      v-model:tab="allDialogTab"
      :select-strategies="strategyStore.selectStrategies"
      :trade-strategies="strategyStore.tradeStrategies"
      :current-applied-select-id="currentAppliedSelectId"
      :current-applied-trade-id="currentAppliedTradeId"
      @toggle-favorite="onAllDialogToggleFavorite"
      @toggle-apply="onAllDialogToggleApply"
      @edit="onAllDialogEdit"
      @remove="onAllDialogRemove"
      @create="onAllDialogCreate"
    />

    <!-- ✅ 保存策略弹窗 -->
    <SaveStrategyDialog
      v-model="createVisible"
      :type="createType"
      :title="createType === 'select' ? '保存当前为选股策略' : '保存当前为交易策略'"
      :metrics-text="createType === 'select' ? metricsTextFull(homeSnapshot) : ''"
      :filters-text="createType === 'select' ? filtersTextFull(homeSnapshot) : ''"
      :name-placeholder="createType === 'select' ? '例如：强势主线' : '例如：突破回踩进场'"
      @confirm="submitCreate"
    />

    <!-- 编辑弹窗（布局已调整） -->
    <el-dialog
      v-model="editVisible"
      :title="editType === 'select' ? '编辑选股策略' : '编辑交易策略'"
      width="940px"
      class="edit-dialog"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="edit-shell" v-if="editForm">
        <!-- ✅ 选股：左列=基础信息+排序；右列=筛选 -->
        <template v-if="editType === 'select'">
          <div class="edit-two-col">
            <!-- 左列 -->
            <div class="col-left">
              <div class="edit-top-card">
                <div class="edit-top-grid">
                  <div class="field">
                    <div class="panel-title">策略名称</div>
                    <el-input v-model="editForm.name" placeholder="请输入策略名称" />
                  </div>
                  <div class="field">
                    <div class="panel-title">策略描述</div>
                    <el-input v-model="editForm.desc" type="textarea" :rows="2" placeholder="用于复盘/备注（可选）" />
                  </div>
                </div>
              </div>

              <div class="panel">
                <div class="panel-head">
                  <div class="panel-title">
                    排序指标
                    <span class="panel-sub">已选 {{ (editForm.snapshot?.selectedMetrics || []).length }}/3</span>
                  </div>
                  <el-button
                    size="small"
                    plain
                    @click="clearEditSort"
                    :disabled="(editForm.snapshot?.selectedMetrics || []).length === 0"
                  >
                    清空
                  </el-button>
                </div>

                <MetricEditor v-model:selectedKeys="editForm.snapshot.selectedMetrics" :metric-defs="metricDefs" />
              </div>
            </div>

            <!-- 右列 -->
            <div class="col-right">
              <div class="panel">
                <div class="panel-head">
                  <div class="panel-title">筛选条件</div>
                  <el-button size="small" plain @click="resetEditFilters">一键清空</el-button>
                </div>

                <FilterEditor :filters="editForm.snapshot.filters" />
              </div>
            </div>
          </div>
        </template>

        <!-- ✅ 交易：保持原来结构 -->
        <template v-else>
          <div class="edit-top-card">
            <div class="edit-top-grid">
              <div class="field">
                <div class="panel-title">策略名称</div>
                <el-input v-model="editForm.name" placeholder="请输入策略名称" />
              </div>
              <div class="field">
                <div class="panel-title">策略描述</div>
                <el-input v-model="editForm.desc" type="textarea" :rows="2" placeholder="用于复盘/备注（可选）" />
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">买卖条件</div>
            </div>
            <div class="trade-form-grid">
              <div class="field">
                <div class="field-label">买入条件</div>
                <el-input
                  v-model="editForm.snapshot.rules.buyCondition"
                  type="textarea"
                  :rows="3"
                  placeholder="例如：收盘价突破20日均线且成交量放大"
                />
              </div>
              <div class="field">
                <div class="field-label">卖出条件</div>
                <el-input
                  v-model="editForm.snapshot.rules.sellCondition"
                  type="textarea"
                  :rows="3"
                  placeholder="例如：跌破10日均线或动能转弱"
                />
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">风险与仓位</div>
            </div>
            <div class="trade-risk-grid">
              <div class="field">
                <div class="field-label">止损(%)</div>
                <el-input-number
                  v-model="editForm.snapshot.rules.stopLossPct"
                  :min="0"
                  :max="100"
                  :step="0.5"
                  :precision="2"
                  controls-position="right"
                  style="width: 100%;"
                  placeholder="例如 3"
                />
              </div>
              <div class="field">
                <div class="field-label">止盈(%)</div>
                <el-input-number
                  v-model="editForm.snapshot.rules.takeProfitPct"
                  :min="0"
                  :max="300"
                  :step="0.5"
                  :precision="2"
                  controls-position="right"
                  style="width: 100%;"
                  placeholder="例如 8"
                />
              </div>
              <div class="field">
                <div class="field-label">仓位上限(%)</div>
                <el-input-number
                  v-model="editForm.snapshot.rules.maxPositionPct"
                  :min="1"
                  :max="100"
                  :step="1"
                  :precision="0"
                  controls-position="right"
                  style="width: 100%;"
                  placeholder="例如 30"
                />
              </div>
            </div>
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Star, StarFilled } from '@element-plus/icons-vue'
import { useStrategyStore } from '@/stores/strategy'
import { useHomeFilterStore } from '@/stores/homeFilter'
import SaveStrategyDialog from '@/components/SaveStrategyDialog.vue'
import AllStrategyDialog from '@/components/strategy/AllStrategyDialog.vue'
import MetricEditor from '@/components/strategy/MetricEditor.vue'
import FilterEditor from '@/components/strategy/FilterEditor.vue'

const strategyStore = useStrategyStore()
const homeFilter = useHomeFilterStore()
const router = useRouter()

/** 指标定义 */
const metricDefs = [
  { key: 'change', label: '涨跌幅', tip: '概念当前涨跌幅' },
  { key: 'netInflow', label: '净流入', tip: '概念资金净流入' },
  { key: 'amount', label: '成交额', tip: '概念成交额' },
  { key: 'volRatio', label: '量比', tip: '量比>1 常见为放量' },
  { key: 'upRatio', label: '上涨占比', tip: '上涨股票占比' },
  { key: 'strength', label: '强度', tip: '0~100 强度' },
  { key: 'spike5m', label: '异动', tip: '短线异动热度' }
]
const metricLabel = (k) => metricDefs.find(x => x.key === k)?.label || k

const emptyTradeRules = () => ({
  buyCondition: '',
  sellCondition: '',
  stopLossPct: null,
  takeProfitPct: null,
  maxPositionPct: null
})

const toNullableNumber = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const normalizeTradeRules = (snap) => {
  const rules = snap?.rules || {}
  return {
    buyCondition: String(rules.buyCondition ?? rules.entry ?? '').trim(),
    sellCondition: String(rules.sellCondition ?? rules.exit ?? '').trim(),
    stopLossPct: toNullableNumber(rules.stopLossPct ?? rules?.risk?.stopLossPct ?? rules?.risk?.stopLoss),
    takeProfitPct: toNullableNumber(rules.takeProfitPct ?? rules?.risk?.takeProfitPct ?? rules?.risk?.takeProfit),
    maxPositionPct: toNullableNumber(rules.maxPositionPct ?? rules?.position?.maxPositionPct ?? rules?.position?.maxPct)
  }
}

/** 当前应用 */
const currentAppliedSelectId = computed({
  get: () => homeFilter.appliedSelectStrategyId || null,
  set: (v) => (homeFilter.appliedSelectStrategyId = v)
})
const currentAppliedTradeId = computed({
  get: () => homeFilter.appliedTradeStrategyId || null,
  set: (v) => (homeFilter.appliedTradeStrategyId = v)
})

const currentAppliedSelectName = computed(() => {
  const id = currentAppliedSelectId.value
  if (!id) return ''
  return strategyStore.selectStrategies.find(x => x.id === id)?.name || ''
})
const currentAppliedTradeName = computed(() => {
  const id = currentAppliedTradeId.value
  if (!id) return ''
  return strategyStore.tradeStrategies.find(x => x.id === id)?.name || ''
})

const selectMineStrategies = computed(() =>
  (strategyStore.selectStrategies || [])
    .filter(s => s.isFavorite || s.isCustom)
    .slice()
    .sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite))
)
const tradeMineStrategies = computed(() =>
  (strategyStore.tradeStrategies || [])
    .filter(s => s.isFavorite || s.isCustom)
    .slice()
    .sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite))
)
const selectFavoriteCount = computed(() =>
  (strategyStore.selectStrategies || []).filter(s => !!s.isFavorite).length
)
const selectCustomCount = computed(() =>
  (strategyStore.selectStrategies || []).filter(s => !!s.isCustom).length
)

/** home 快照（用于创建选股策略） */
const homeSnapshot = computed(() => homeFilter.toSnapshot?.() || {
  selectedMetrics: homeFilter.selectedMetrics || [],
  filters: homeFilter.filters || {},
  searchQuery: homeFilter.searchQuery || ''
})

/** 快照不保存搜索 */
const snapshotWithoutSearch = (snap) => {
  const base = snap || {}
  const rest = { ...base }
  delete rest.searchQuery
  return { ...rest, searchQuery: '' }
}

/** 删除策略 */
const removeStrategySafe = async (type, s) => {
  try {
    await ElMessageBox.confirm(`确定删除「${s.name}」？`, '删除策略', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    strategyStore.removeStrategy(type === 'select' ? 'select' : 'trade', s.id)

    if (type === 'select' && currentAppliedSelectId.value === s.id) {
      currentAppliedSelectId.value = null
      resetHomeSelectToDefault()
    }
    if (type === 'trade' && currentAppliedTradeId.value === s.id) currentAppliedTradeId.value = null

    ElMessage.success('已删除')
  } catch (err) {
    void err
  }
}

/** 应用策略 */
const applyStrategy = (type, s) => {
  if (!s?.snapshot) return ElMessage.warning('该策略没有快照')

  if (type === 'select') {
    const clean = snapshotWithoutSearch(s.snapshot)
    homeFilter.applySnapshot?.(clean)
    currentAppliedSelectId.value = s.id
  } else {
    currentAppliedTradeId.value = s.id
  }
  ElMessage.success(`已应用：${s.name}`)
}

/** 应用/取消 */
const ensureHomePage = async () => {
  if (router.currentRoute.value.path !== '/home') {
    await router.push({ path: '/home' })
  }
}

const toggleApply = async (type, s) => {
  if (!s) return

  if (type === 'select' && s.id === currentAppliedSelectId.value) {
    currentAppliedSelectId.value = null
    resetHomeSelectToDefault()
    ElMessage.success('已取消选股策略应用')
    await ensureHomePage()
    return
  }

  if (type === 'trade' && s.id === currentAppliedTradeId.value) {
    currentAppliedTradeId.value = null
    ElMessage.success('已取消交易策略应用')
    await ensureHomePage()
    return
  }

  applyStrategy(type, s)
  await ensureHomePage()
}

const clearApplied = (type) => {
  if (type === 'select') {
    currentAppliedSelectId.value = null
    resetHomeSelectToDefault()
    ElMessage.success('已清空选股策略')
  } else {
    currentAppliedTradeId.value = null
    ElMessage.success('已清空交易策略')
  }
}

/** 保存策略 */
const createVisible = ref(false)
const createType = ref('select')
const allDialogVisible = ref(false)
const allDialogTab = ref('select')

const openCreate = (type) => {
  createType.value = type
  createVisible.value = true
}

const submitCreate = ({ name, desc }) => {
  if (createType.value === 'select') {
    strategyStore.addSelectStrategyFromSnapshot({
      name,
      desc: desc || '保存了一组条件',
      snapshot: snapshotWithoutSearch(homeSnapshot.value)
    })
  } else {
    strategyStore.tradeStrategies.unshift({
      id: Date.now(),
      enabled: true,
      name,
      desc: desc || '保存了一组规则',
      snapshot: { rules: emptyTradeRules() },
      isFavorite: false,
      isCustom: true
    })
  }
  createVisible.value = false
  ElMessage.success('已保存到策略中心')
}

const toggleFavorite = (type, s) => {
  if (!s) return
  strategyStore.toggleFavorite(type, s.id)
  ElMessage.success(s.isFavorite ? '已收藏' : '已取消收藏')
}
const onAllDialogToggleFavorite = ({ type, strategy }) => toggleFavorite(type, strategy)
const onAllDialogToggleApply = ({ type, strategy }) => toggleApply(type, strategy)
const onAllDialogEdit = ({ type, strategy }) => openEdit(type, strategy)
const onAllDialogRemove = ({ type, strategy }) => removeStrategySafe(type, strategy)
const onAllDialogCreate = ({ type, payload }) => {
  if (type === 'select') {
    strategyStore.addSelectStrategyFromSnapshot(payload)
  } else {
    strategyStore.addTradeStrategyFromSnapshot(payload)
  }
  ElMessage.success('已新建策略')
}

const allDialogRef = ref(null)
const fixedPopperOptions = { strategy: 'fixed' }

const flashCard = (el) => {
  if (!el) return
  el.classList.remove('focus-flash')
  // force reflow for restart animation
  void el.offsetWidth
  el.classList.add('focus-flash')
  window.setTimeout(() => el.classList.remove('focus-flash'), 1200)
}

const focusMineCard = (type, id) => {
  const el = type === 'select' ? getSelEl(id) : getTrEl(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashCard(el)
  return true
}

const openAllAndFocus = async (type, id) => {
  allDialogTab.value = type
  allDialogVisible.value = true
  await nextTick()
  await new Promise(resolve => window.setTimeout(resolve, 80))
  const ok = allDialogRef.value?.focusStrategyCard?.(type, id)
  if (!ok) ElMessage.info('已打开全部策略，但暂未定位到对应卡片')
}

const jumpToApplied = async (type) => {
  const id = type === 'select' ? currentAppliedSelectId.value : currentAppliedTradeId.value
  if (!id) return

  const list = type === 'select' ? strategyStore.selectStrategies : strategyStore.tradeStrategies
  const strategy = list.find(s => s.id === id)
  if (!strategy) return ElMessage.warning('当前应用策略不存在，可能已被删除')

  const focused = focusMineCard(type, id)
  if (focused) return

  ElMessage.info('该策略未收藏，已为你打开“全部策略”定位')
  await openAllAndFocus(type, id)
}

/** 编辑弹窗（保留） */
const editVisible = ref(false)
const editType = ref('select')
const editForm = ref(null)

const ensureFilterShape = (filters) => {
  const f = filters || {}
  if (!('maxChange' in f)) f.maxChange = null
  if (!('maxNetInflowY' in f)) f.maxNetInflowY = null
  if (!('maxAmountY' in f)) f.maxAmountY = null
  if (!('maxVolRatio' in f)) f.maxVolRatio = null
  if (!('maxUpRatio' in f)) f.maxUpRatio = null
  return f
}

const openEdit = (type, s) => {
  editType.value = type
  const clone = JSON.parse(JSON.stringify(s || {}))

  if (type === 'select') {
    clone.snapshot = clone.snapshot || { scope: 'all', selectedMetrics: [], filters: {} }
    clone.snapshot.searchQuery = ''
    clone.snapshot.filters = ensureFilterShape(clone.snapshot.filters || {})
  } else {
    clone.snapshot = { rules: normalizeTradeRules(clone.snapshot) }
  }

  editForm.value = clone
  editVisible.value = true
}

/** ✅ 全字段清空 filters */
const emptySelectFilters = () => ({
  minChange: null,
  maxChange: null,
  minNetInflowY: null,
  maxNetInflowY: null,
  minAmountY: null,
  maxAmountY: null,
  minVolRatio: null,
  maxVolRatio: null,
  minUpRatio: null,
  maxUpRatio: null,
  minStrength: null,
  minSpike5m: null,
  maxVolatility: null,
  maxDrawdown20d: null
})

/** ✅ 默认选股条件 */
const defaultSelectSnapshot = () => ({
  scope: 'all',
  selectedMetrics: [],
  filters: emptySelectFilters(),
  searchQuery: ''
})

/** ✅ 取消/清空选股策略时：强制重置主界面排序+筛选 */
const resetHomeSelectToDefault = () => {
  const snap = snapshotWithoutSearch(defaultSelectSnapshot())
  homeFilter.applySnapshot?.(snap)

  homeFilter.selectedMetrics = []
  homeFilter.filters = { ...emptySelectFilters() }
  homeFilter.searchQuery = ''

  if ('scope' in homeFilter) homeFilter.scope = 'all'
}

const submitEdit = () => {
  const s = editForm.value
  if (!s) return
  if (!s.name?.trim()) return ElMessage.warning('请输入策略名称')

  if (editType.value === 'select') {
    const cleanSnap = snapshotWithoutSearch({
      ...(s.snapshot || {}),
      filters: ensureFilterShape(s.snapshot?.filters || {})
    })
    strategyStore.updateStrategy('select', s.id, {
      name: s.name,
      desc: s.desc,
      snapshot: cleanSnap
    })
  } else {
    const rulesObj = normalizeTradeRules(s.snapshot)
    strategyStore.updateStrategy('trade', s.id, {
      name: s.name,
      desc: s.desc,
      snapshot: { rules: rulesObj }
    })
  }

  editVisible.value = false
  ElMessage.success('已保存修改')
}

const clearEditSort = () => {
  if (!editForm.value?.snapshot) return
  editForm.value.snapshot.selectedMetrics = []
}

const resetEditFilters = () => {
  const f = editForm.value?.snapshot?.filters
  if (!f) return
  Object.assign(f, emptySelectFilters())
}

/** ===== Popover 详情（核心：自动关闭） ===== */
const bodyRef = ref(null)

/** 存储每个卡片 DOM（选股/交易分开，避免 id 撞） */
const selRefs = ref(new Map()) // id -> el
const trRefs = ref(new Map()) // id -> el

const setSelRef = (id, el) => {
  if (!id) return
  if (el) selRefs.value.set(String(id), el)
  else selRefs.value.delete(String(id))
}
const setTrRef = (id, el) => {
  if (!id) return
  if (el) trRefs.value.set(String(id), el)
  else trRefs.value.delete(String(id))
}
const getSelEl = (id) => selRefs.value.get(String(id)) || null
const getTrEl = (id) => trRefs.value.get(String(id)) || null

/** 当前打开的策略与其 reference DOM */
const activeType = ref('select') // 'select' | 'trade'
const activeStrategy = ref(null)
const activeAnchorEl = ref(null) // 当前 popover 的 reference DOM

const setActivePopover = async (type, s, anchorEl) => {
  activeType.value = type
  activeStrategy.value = s || null
  activeAnchorEl.value = anchorEl || null
  await nextTick()
  // 立即检查一次（防止打开瞬间其实已经不可见）
  ensureAnchorVisibleOrClose()
}
const clearActivePopover = () => {
  activeStrategy.value = null
  activeAnchorEl.value = null
}

/** 关闭 popover：触发 click-outside */
const closeActivePopover = () => {
  document.body.click()
}

/** 判断 anchor 是否“在可视区域内” */
const isElVisibleInViewport = (el) => {
  if (!el) return false
  const rect = el.getBoundingClientRect()
  // 完全不在视口就认为不可见
  const vw = window.innerWidth || document.documentElement.clientWidth
  const vh = window.innerHeight || document.documentElement.clientHeight
  const out =
    rect.bottom <= 0 ||
    rect.top >= vh ||
    rect.right <= 0 ||
    rect.left >= vw
  if (out) return false
  // 有交集就算可见（不要求面积）
  return true
}

/** 若当前卡片不可见则自动关闭 */
const ensureAnchorVisibleOrClose = () => {
  if (!activeStrategy.value || !activeAnchorEl.value) return
  if (!isElVisibleInViewport(activeAnchorEl.value)) {
    closeActivePopover()
  }
}

/** IntersectionObserver：更精确（滚出可见区域就关） */
let io = null
const setupIO = () => {
  if (typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver(
    (entries) => {
      // 只关当前打开的
      if (!activeAnchorEl.value) return
      for (const e of entries) {
        if (e.target === activeAnchorEl.value) {
          if (!e.isIntersecting || (e.intersectionRatio || 0) <= 0) {
            closeActivePopover()
          }
        }
      }
    },
    {
      root: null, // viewport
      threshold: [0, 0.01]
    }
  )
}

/** 每次打开时重新 observe 当前 anchor */
watch(activeAnchorEl, (el, prev) => {
  if (io && prev) io.unobserve(prev)
  if (io && el) io.observe(el)
})

/** 监听滚动/resize：兜底（IO 没有或一些复杂布局） */
const onAnyScroll = () => ensureAnchorVisibleOrClose()
const onResize = () => ensureAnchorVisibleOrClose()

onMounted(() => {
  setupIO()

  // 监听列表容器滚动（最关键）
  if (bodyRef.value) bodyRef.value.addEventListener('scroll', onAnyScroll, { passive: true })

  // 兜底：窗口/页面滚动
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('scroll', onAnyScroll, { passive: true })
})

onBeforeUnmount(() => {
  if (bodyRef.value) bodyRef.value.removeEventListener('scroll', onAnyScroll)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onAnyScroll)
  if (io) {
    try { io.disconnect() } catch (err) { void err }
    io = null
  }
})

/** popover 内“应用/关闭” */
const isActiveApplied = computed(() => {
  const s = activeStrategy.value
  if (!s) return false
  if (activeType.value === 'select') return s.id === currentAppliedSelectId.value
  return s.id === currentAppliedTradeId.value
})

const activeApplyText = computed(() => (isActiveApplied.value ? '取消' : '应用'))

const activeApplyDisabled = computed(() => {
  const s = activeStrategy.value
  if (!s) return true
  if (isActiveApplied.value) return false // 允许取消
  if (!s.snapshot) return true
  return false
})

const applyFromPopoverAndClose = () => {
  const s = activeStrategy.value
  if (!s) return
  toggleApply(activeType.value, s)
  closeActivePopover()
}

/** ===== Popover 内容文本（正常一段话，不拆 tag） ===== */
const detailSortText = computed(() => {
  const s = activeStrategy.value
  const keys = (s?.snapshot?.selectedMetrics || []).filter(Boolean).slice(0, 3)
  if (!keys.length) return '无'
  const labels = keys.map(metricLabel)
  if (labels.length === 1) return `按「${labels[0]}」降序`
  return `综合排序（Pareto）：${labels.map((x, i) => `${i + 1}. ${x}`).join('，')}`
})

const detailFilterText = computed(() => {
  const s = activeStrategy.value
  const parts = buildFilterParts(s?.snapshot?.filters || {})
  return parts.length ? parts.join('，') : '无筛选条件'
})

const detailTradeText = computed(() => {
  const s = activeStrategy.value
  const rawRules = s?.snapshot?.rules || {}
  const rules = normalizeTradeRules(s?.snapshot)
  const parts = []
  if (rules.buyCondition) parts.push(`买入：${rules.buyCondition}`)
  if (rules.sellCondition) parts.push(`卖出：${rules.sellCondition}`)
  if (rules.stopLossPct != null) parts.push(`止损：${rules.stopLossPct}%`)
  if (rules.takeProfitPct != null) parts.push(`止盈：${rules.takeProfitPct}%`)
  if (rules.maxPositionPct != null) parts.push(`仓位上限：${rules.maxPositionPct}%`)
  if (!parts.length) {
    const legacyEntries = Object.entries(rawRules).filter(([k, v]) => String(k).trim() && v != null && v !== '')
    if (legacyEntries.length) return legacyEntries.map(([k, v]) => `${k}：${String(v)}`).join('，')
  }
  return parts.length ? parts.join('，') : '未配置'
})

/** ===== 文本展示（保留原逻辑） ===== */
const metricsTextShort = (snap) => {
  const keys = (snap?.selectedMetrics || []).filter(Boolean).slice(0, 3)
  if (!keys.length) return '无'
  return keys.map(metricLabel).join('、')
}
const metricsTextFull = (snap) => {
  const keys = (snap?.selectedMetrics || []).filter(Boolean).slice(0, 3)
  if (!keys.length) return '无'
  if (keys.length === 1) return `排序：${metricLabel(keys[0])}`
  return `排序：${keys.map(metricLabel).join('、')}`
}

const filtersTextShort = (snap) => {
  const parts = buildFilterParts(snap?.filters || {})
  if (!parts.length) return '无'
  const head = parts.slice(0, 2)
  const more = parts.length - head.length
  return more > 0 ? `${head.join('，')} +${more}` : head.join('，')
}
const filtersTextFull = (snap) => {
  const parts = buildFilterParts(snap?.filters || {})
  return parts.join('，') || '无'
}

const buildFilterParts = (f) => {
  const parts = []
  const range = (min, max, unit = '') => {
    const hasMin = min != null
    const hasMax = max != null
    if (!hasMin && !hasMax) return ''
    if (hasMin && hasMax) return `${min}${unit}~${max}${unit}`
    if (hasMin) return `≥${min}${unit}`
    return `≤${max}${unit}`
  }
  const a = range(f.minChange, f.maxChange, '%'); if (a) parts.push(`涨跌${a}`)
  const b = range(f.minNetInflowY, f.maxNetInflowY, '亿'); if (b) parts.push(`净流入${b}`)
  const c = range(f.minAmountY, f.maxAmountY, '亿'); if (c) parts.push(`成交额${c}`)
  const d = range(f.minVolRatio, f.maxVolRatio, ''); if (d) parts.push(`量比${d}`)
  const e = range(
    f.minUpRatio != null ? Math.round(f.minUpRatio * 100) : null,
    f.maxUpRatio != null ? Math.round(f.maxUpRatio * 100) : null,
    '%'
  )
  if (e) parts.push(`上涨占比${e}`)
  if (f.minStrength != null) parts.push(`强度≥${f.minStrength}`)
  if (f.minSpike5m != null) parts.push(`异动≥${f.minSpike5m}`)
  if (f.maxVolatility != null) parts.push(`波动≤${f.maxVolatility}`)
  if (f.maxDrawdown20d != null) parts.push(`回撤≥${f.maxDrawdown20d}%`)
  return parts
}

const tradeRulesTextShort = (snap) => {
  const rawRules = snap?.rules || {}
  const rules = normalizeTradeRules(snap)
  const configured = [
    !!rules.buyCondition,
    !!rules.sellCondition,
    rules.stopLossPct != null,
    rules.takeProfitPct != null,
    rules.maxPositionPct != null
  ].filter(Boolean).length
  if (!configured) {
    const legacyCount = Object.values(rawRules).filter(v => v != null && v !== '').length
    return legacyCount > 0 ? `已配置 ${legacyCount} 项` : '未配置'
  }
  return configured > 0 ? `已配置 ${configured}/5 项` : '未配置'
}
</script>

<style scoped>
.strategy-dock{
  width: 200px;
  height: 333px;
  overflow: hidden;
  border-top: 1px solid rgba(0,0,0,.06);
  background: #f7f8fa;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

/* scrollbar hide */
.scroll-hidden{ scrollbar-width:none; -ms-overflow-style:none; }
.scroll-hidden::-webkit-scrollbar{ width:0; height:0; }

.strategy-header{
  flex: 0 0 auto;
  display:flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0,0,0,.06);
}

.h-top{
  display:flex;
  align-items:flex-start;
  justify-content: flex-start;
  gap: 8px;
}
.strategy-title{
  flex: 0 0 18px;
  font-weight: 900;
  font-size: 14px;
  line-height: 1;
  color:#111827;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 1px;
}
.h-top-actions{
  flex: 1 1 auto;
  min-width: 0;
  display:flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.h-current{
  display:flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border-radius: 10px;
  background: rgba(0,0,0,.03);
  border: 1px solid rgba(0,0,0,.06);
}
.cur-row{
  display:flex;
  align-items:center;
  gap: 6px;
}
.cur-label{
  flex: 0 0 30px;
  font-size: 12px;
  font-weight: 900;
  color:#6b7280;
}
.cur-name{
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  font-weight: 900;
  color:#111827;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cur-name.clickable{
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.btn-mini{
  padding: 0 10px !important;
  height: 26px !important;
  border-radius: 14px !important;
  font-weight: 800;
  margin: 0 !important;
}
.btn-clear{ padding: 0 6px !important; }

/* body */
.strategy-body{
  flex: 1 1 auto;
  overflow-y: auto;
  padding-top: 8px;
}

/* 分段 */
.section{ margin-bottom: 10px; }
.section-head{
  display:flex;
  align-items:baseline;
  justify-content: space-between;
  padding: 2px 2px 6px;
}
.section-title{
  font-weight: 900;
  font-size: 12px;
  color:#374151;
}
.section-sub{
  font-weight: 900;
  font-size: 11px;
  color:#9ca3af;
}

.strategy-list{
  display:flex;
  flex-direction: column;
  gap: 8px;
}

/* item card */
.strategy-item{
  background:#fff;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 10px 18px rgba(0,0,0,.05);
  overflow: hidden;
}

.strategy-item.applied{ position: relative; }
.strategy-item.applied::before{
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 999px;
  background: rgba(64,158,255,.95);
}
.strategy-item.focus-flash{
  animation: cardFlash 1.1s ease;
}
@keyframes cardFlash{
  0% { box-shadow: 0 0 0 0 rgba(64,158,255,.55); }
  35% { box-shadow: 0 0 0 4px rgba(64,158,255,.3); }
  100% { box-shadow: 0 10px 18px rgba(0,0,0,.05); }
}

.s-main{ padding: 8px; cursor: pointer; }
.s-line1{ display:flex; align-items:center; gap: 6px; min-width: 0; }
.s-name{
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 900;
  font-size: 12px;
  color:#111827;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.star-btn{
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  line-height: 1;
  cursor: pointer;
}
.star-icon{
  font-size: 14px;
  color:#cbd5e1;
}
.star-icon.on{
  color:#f59e0b;
}
.tag{
  display:inline-flex;
  align-items:center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid transparent;
}
.tag.fav{
  color:#ca8a04;
  background: rgba(250,204,21,.16);
  border-color: rgba(250,204,21,.38);
}
.tag.custom{
  color:#0f766e;
  background: rgba(45,212,191,.12);
  border-color: rgba(45,212,191,.34);
}

.badge{
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 900;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(64,158,255,.25);
  background: rgba(64,158,255,.08);
  color:#409eff;
}
.badge.off{
  border-color: rgba(0,0,0,.12);
  background: rgba(0,0,0,.03);
  color:#6b7280;
}

.s-line2{
  margin-top: 6px;
  display:flex;
  align-items:center;
  gap: 6px;
  font-size: 11px;
  color:#6b7280;
  line-height: 1.25;
  overflow: hidden;
  white-space: nowrap;
}
.mini{ font-weight: 900; color:#9ca3af; }
.val{
  font-weight: 900;
  color:#374151;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.s-actions{
  border-top: 1px dashed rgba(0,0,0,.06);
  padding: 8px;
  display:flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}
.btn-act{
  height: 26px !important;
  padding: 0 8px !important;
  border-radius: 10px !important;
  font-weight: 900;
  font-size: 12px;
}

.empty-trade{
  background: rgba(0,0,0,.02);
  border: 1px dashed rgba(0,0,0,.10);
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

/* Popover：克制一点 */
:global(.strategy-popover){
  padding: 12px 12px 10px !important;
}
.pop-title{
  font-weight: 900;
  color:#111827;
  font-size: 13px;
  margin-bottom: 10px;
}
.pop-grid{
  display:flex;
  flex-direction: column;
  gap: 8px;
}
.pop-row{
  display:grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items:start;
}
.pop-row .k{
  color:#6b7280;
  font-size: 12px;
  font-weight: 800;
  line-height: 18px;
}
.pop-row .v{
  color:#111827;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: pre-wrap;
}
.pop-actions{
  margin-top: 10px;
  display:flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 编辑弹窗（保留你原样式） */
:deep(.edit-dialog .el-dialog__body){
  padding: 14px 16px 12px;
}
.edit-shell{
  display:flex;
  flex-direction: column;
  gap: 14px;
}

/* ✅ 新增：选股编辑两列布局（左：基础+排序 / 右：筛选） */
.edit-two-col{
  display:grid;
  grid-template-columns: 1fr 1.08fr;
  gap: 14px;
  align-items:start;
}
.col-left,
.col-right{
  display:flex;
  flex-direction: column;
  gap: 14px;
}

/* ✅ 可选：在两列模式下，基础信息改为单列更舒服；不想要可删除这段 */
.edit-two-col .edit-top-grid{
  grid-template-columns: 1fr;
}

.edit-top-card{
  border: 1px solid rgba(0,0,0,.06);
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 10px 18px rgba(0,0,0,.04);
}

.edit-top-grid{
  display:grid;
  grid-template-columns: 1fr 1.05fr;
  gap: 14px;
}
.field{ display:flex; flex-direction: column; gap: 8px; }


/* 你原来的 edit-grid 还留着也不影响（选股不再用到） */
.edit-grid{
  display:grid;
  grid-template-columns: 1fr 1.08fr;
  gap: 14px;
  align-items:start;
}

.panel{
  border: 1px solid rgba(0,0,0,.06);
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 10px 18px rgba(0,0,0,.04);
}
.panel-head{
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.panel-title{
  font-weight: 750;
  color:#111827;
  font-size: 14px;
  line-height: 1.2;
}
.panel-sub{
  display:inline-block;
  margin-left: 10px;
  font-weight: 800;
  color:#9ca3af;
  font-size: 12px;
}
.field-label{
  font-size: 12px;
  font-weight: 800;
  color:#6b7280;
}
.trade-form-grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.trade-risk-grid{
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
</style>
