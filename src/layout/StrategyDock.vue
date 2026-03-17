<template>
  <div class="strategy-dock" id="tour-strategy">
    <!-- 顶部：标题 + 保存入口 -->
    <div class="strategy-header">
      <div class="h-top">
        <span class="strategy-title">策略中心</span>

        <div class="h-top-actions" id="tour-strategy-save">
          <el-button size="small" plain type="success" @click="allDialogVisible = true">
            全部策略
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
          <span class="section-sub">收藏 {{ selectFavoriteCount }} / 自定义{{ selectCustomCount }}</span>
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

                <!-- 卡片按钮区：保留原有功能 -->
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

            <!-- Popover 内容：仅保留“关闭 / 应用”，条件按正常文本展示 -->
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
          <div class="empty-sub">当前仅展示“收藏”或“自定义”策略，可在“全部策略”中收藏。</div>
        </div>
      </div>

      <!-- 交易策略 -->
      <div class="section">
        <div class="section-head">
          <span class="section-title">交易策略</span>
        </div>

        <div class="strategy-list" v-if="tradeMineStrategies.length">
          <div
            v-for="s in tradeMineStrategies"
            :key="`tr-${s.id}`"
            class="strategy-item"
            :ref="(el) => setTrRef(s.id, el)"
            :class="{
              applied: s.id === currentAppliedTradeId
            }"
            @click="openTradeDetail(s)"
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

              <div class="s-line2 s-desc" v-if="s.desc">
                <span class="mini">描述</span>
                <span class="val" :title="s.desc">{{ s.desc }}</span>
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

    <!-- 保存策略弹窗 -->
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
      :width="editType === 'trade' ? '700px' : '940px'"
      class="edit-dialog"
      :close-on-click-modal="false"
      draggable
      destroy-on-close
    >
      <div class="edit-shell" :class="{ 'is-trade': editType === 'trade' }" v-if="editForm">
        <!-- 选股：左列基础信息+排序，右列筛选 -->
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
                    <span class="panel-sub">已选{{ (editForm.snapshot?.selectedMetrics || []).length }}/3</span>
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

        <!-- 交易 -->
        <template v-else>
          <div class="trade-basic">
            <div class="trade-inline-row">
              <div style="font-weight: 500;color: #000;">策略名称：</div>
              <el-input v-model="editForm.name" placeholder="请输入策略名称" />
            </div>
            <div class="trade-inline-row">
              <div style="font-weight: 500;color: #000;">策略描述：</div>
              <el-input v-model="editForm.desc" type="textarea" :rows="2" placeholder="用于复盘/备注（可选）" />
            </div>
          </div>

          <div class="panel">
            <div class="trade-trigger-row">
              <div class="trigger-inline">
                <div style="font-weight: 500;color: #000;">触发方式：</div>
                <el-radio-group v-model="editForm.snapshot.entry.triggerMode" class="trigger-radio-group">
                  <el-radio label="close">收盘触发</el-radio>
                  <el-radio label="intraday">盘中触发</el-radio>
                </el-radio-group>
              </div>
            </div>
            <el-tabs v-model="editTradeCondTab" class="trade-cond-tabs">
              <el-tab-pane :label="`买入条件（${editForm.snapshot.entry.conditions.length}）`" name="entry">
                <div class="trade-cond-box scroll-hidden">
                  <TradeConditionEditor v-model="editForm.snapshot.entry.conditions" />
                </div>
              </el-tab-pane>
              <el-tab-pane :label="`卖出条件（${editForm.snapshot.exit.conditions.length}）`" name="exit">
                <div class="trade-cond-box scroll-hidden">
                  <TradeConditionEditor v-model="editForm.snapshot.exit.conditions" />
                </div>
              </el-tab-pane>
            </el-tabs>
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
import {
  createDefaultTradeSnapshot,
  normalizeTradeSnapshot
} from '@/utils/tradeStrategy'
import SaveStrategyDialog from '@/components/SaveStrategyDialog.vue'
import AllStrategyDialog from '@/components/strategy/AllStrategyDialog.vue'
import MetricEditor from '@/components/strategy/MetricEditor.vue'
import FilterEditor from '@/components/strategy/FilterEditor.vue'
import TradeConditionEditor from '@/components/strategy/TradeConditionEditor.vue'

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

/** Home 快照（用于创建选股策略） */
const homeSnapshot = computed(() => homeFilter.toSnapshot?.() || {
  selectedMetrics: homeFilter.selectedMetrics || [],
  filters: homeFilter.filters || {},
  searchQuery: homeFilter.searchQuery || ''
})

/** 快照不保存搜索词 */
const snapshotWithoutSearch = (snap) => {
  const base = snap || {}
  const rest = { ...base }
  delete rest.searchQuery
  return { ...rest, searchQuery: '' }
}

/** 删除策略 */
const removeStrategySafe = async (type, s) => {
  try {
    await ElMessageBox.confirm(`确定删除「${s.name}」吗？`, '删除策略', {
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
    ElMessage.success(`已应用：${s.name}。可在“投资方案”中按股票生成和调整方案`)
    return
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

const submitCreate = ({ name, desc }) => {
  if (createType.value === 'select') {
    strategyStore.addSelectStrategyFromSnapshot({
      name,
      desc: desc || '保存了一组条件',
      snapshot: snapshotWithoutSearch(homeSnapshot.value)
    })
  } else {
    strategyStore.addTradeStrategyFromSnapshot({
      name,
      desc: desc || '保存了一组交易条件',
      snapshot: createDefaultTradeSnapshot(),
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

const openTradeDetail = async (s) => {
  if (!s?.id) return
  await openAllAndFocus('trade', s.id)
}

/** 编辑弹窗（保留） */
const editVisible = ref(false)
const editType = ref('select')
const editForm = ref(null)
const editTradeCondTab = ref('entry')

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
  editTradeCondTab.value = 'entry'
  const clone = JSON.parse(JSON.stringify(s || {}))

  if (type === 'select') {
    clone.snapshot = clone.snapshot || { scope: 'all', selectedMetrics: [], filters: {} }
    clone.snapshot.searchQuery = ''
    clone.snapshot.filters = ensureFilterShape(clone.snapshot.filters || {})
  } else {
    clone.snapshot = normalizeTradeSnapshot(clone.snapshot)
  }

  editForm.value = clone
  editVisible.value = true
}

/** 全字段清空 filters */
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

/** 默认选股条件 */
const defaultSelectSnapshot = () => ({
  scope: 'all',
  selectedMetrics: [],
  filters: emptySelectFilters(),
  searchQuery: ''
})

/** 取消/清空选股策略时：强制重置主界面排序和筛选 */
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
    strategyStore.updateStrategy('trade', s.id, {
      name: s.name,
      desc: s.desc,
      snapshot: normalizeTradeSnapshot(s.snapshot)
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

/** 存储每个卡片 DOM（选股/交易分开，避免 id 冲突） */
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
  // 立即检查一次（防止打开瞬间已经不可见）
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

/** 判断 anchor 是否在可视区域内 */
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
  // 只要有交集就算可见（不要求面积）
  return true
}

/** 若当前卡片不可见则自动关闭 */
const ensureAnchorVisibleOrClose = () => {
  if (!activeStrategy.value || !activeAnchorEl.value) return
  if (!isElVisibleInViewport(activeAnchorEl.value)) {
    closeActivePopover()
  }
}

/** IntersectionObserver：更精确（滚出可见区域就关闭） */
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

/** 监听滚动/resize：兜底（IO 不可用或复杂布局） */
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

/** ===== Popover 内容文本（正常段落，不拼 tag） ===== */
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
    if (hasMin) return `>=${min}${unit}`
    return `<=${max}${unit}`
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
  if (f.minStrength != null) parts.push(`强度>=${f.minStrength}`)
  if (f.minSpike5m != null) parts.push(`异动>=${f.minSpike5m}`)
  if (f.maxVolatility != null) parts.push(`波动<=${f.maxVolatility}`)
  if (f.maxDrawdown20d != null) parts.push(`回撤>=${f.maxDrawdown20d}%`)
  return parts
}

</script>

<style scoped>
.strategy-dock{
  width: 212px;
  height: 100%;
  overflow: hidden;
  background: transparent;
  padding: 8px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
}

/* scrollbar hide */
.scroll-hidden{ scrollbar-width:none; -ms-overflow-style:none; }
.scroll-hidden::-webkit-scrollbar{ width:0; height:0; }

.strategy-header{
  flex: 0 0 auto;
  display:flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(148,163,184,.22);
}

.h-top{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 8px;
}
.strategy-title{
  flex: 0 0 auto;
  font-weight: 700;
  font-size: 15px;
  line-height: 1.1;
  color:#111827;
  letter-spacing: .2px;
}
.h-top-actions{
  flex: 0 0 auto;
  min-width: 0;
  display:flex;
  justify-content: flex-end;
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
.btn-icon{
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  border-radius: 10px !important;
  font-size: 14px;
}
.btn-all-strategy{
  height: 28px !important;
  padding: 0 10px !important;
  border-radius: 10px !important;
  font-weight: 800;
  font-size: 12px;
}
.btn-clear{ padding: 0 6px !important; }

/* body */
.strategy-body{
  flex: 1 1 auto;
  overflow-y: auto;
  padding-top: 8px;
  min-height: 0;
}

/* 分段 */
.section{ margin-bottom: 10px; }
.section-head{
  display:flex;
  align-items:baseline;
  justify-content: space-between;
  padding: 3px 2px 7px;
}
.section-title{
  font-weight: 700;
  font-size: 12px;
  color:#374151;
}
.section-sub{
  font-weight: 700;
  font-size: 11px;
  color:#9ca3af;
}
.plan-head-actions{
  display:flex;
  align-items:center;
  gap: 6px;
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
  border: 1px solid rgba(148,163,184,.24);
  box-shadow: 0 6px 12px rgba(15,23,42,.04);
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
.s-line2.s-desc{
  align-items: flex-start;
}
.s-line2.s-desc .val{
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.s-actions{
  border-top: 1px dashed rgba(148,163,184,.32);
  padding: 8px;
  display:flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}
.btn-act{
  height: 26px !important;
  width: auto;
  padding: 0 8px !important;
  border-radius: 10px !important;
  font-weight: 800;
  font-size: 12px;
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
  box-shadow: 0 10px 18px rgba(0,0,0,.05);
  padding: 8px;
}
.plan-item.act-buy{
  border-left: 3px solid rgba(34,197,94,.9);
}
.plan-item.act-sell{
  border-left: 3px solid rgba(239,68,68,.9);
}
.plan-item.act-hold{
  border-left: 3px solid rgba(148,163,184,.9);
}
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
.edit-dialog :deep(.el-dialog__header){
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(148,163,184,.18);
}
.edit-dialog :deep(.el-dialog__title){
  font-size: 15px;
  font-weight: 800;
  color:#0f172a;
}
.edit-shell{
  display:flex;
  flex-direction: column;
  gap: 14px;
}
.edit-shell.is-trade{
  height: 590px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  gap: 12px;
  padding: 2px 2px 0;
}
.edit-shell.is-trade::-webkit-scrollbar{ width: 0; height: 0; }
.edit-shell.is-trade .panel{
  background: transparent;
  border: 0;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
}
.edit-shell.is-trade .panel + .panel{
  border-top: 1px solid rgba(148,163,184,.22);
  margin-top: 6px;
  padding-top: 12px;
}
.edit-shell.is-trade .panel-head{
  margin-bottom: 8px;
  padding: 0 2px;
}
.edit-shell.is-trade .panel-title{
  font-size: 14px;
  font-weight: 700;
}
.edit-shell.is-trade .field-label{
  font-size: 12px;
}

/* 新增：选股编辑两列布局（左：基础+排序 / 右：筛选） */
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

/* 可选：两列模式下，基础信息改为单列更舒适；不需要可删除本段 */
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
.trade-top-grid{
  display:grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.trade-basic{
  display:flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 2px 2px;
}
.trade-inline-row{
  display:grid;
  grid-template-columns: 74px 1fr;
  gap: 8px;
  align-items:center;
}
.inline-label{
  font-size: 12px;
  font-weight: 700;
  color:#475569;
  line-height: 1;
}
.field{ display:flex; flex-direction: column; gap: 8px; }
.trade-summary-bar{
  border: 1px solid rgba(59,130,246,.24);
  background: #f7fbff;
  border-radius: 12px;
  padding: 8px 10px;
  display:grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}
.summary-item{
  background: #fff;
  border: 1px solid rgba(148,163,184,.24);
  border-radius: 10px;
  padding: 6px 8px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 8px;
}
.summary-item .k{
  font-size: 12px;
  color:#64748b;
  font-weight: 700;
}
.summary-item .v{
  font-size: 13px;
  color:#0f172a;
  font-weight: 900;
}


/* 你原来的 edit-grid 保留也不影响（选股不再使用） */
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
.field-label.with-meta{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 8px;
}
.field-meta{
  font-size: 11px;
  font-weight: 800;
  color:#475569;
  background: rgba(148, 163, 184, .18);
  border: 1px solid rgba(148, 163, 184, .32);
  border-radius: 999px;
  padding: 1px 8px;
  line-height: 18px;
}
.trade-form-grid{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
  gap: 12px;
  align-items: start;
}
.trade-cond-tabs :deep(.el-tabs__header){ margin-bottom: 8px; }
.trade-cond-tabs :deep(.el-tabs__item){
  font-weight: 700;
  font-size: 13px;
  padding: 0 14px;
}
.trade-cond-tabs :deep(.el-tabs__nav-wrap::after){ background-color: rgba(148,163,184,.25); }
.trade-cond-box{
  margin-top: 2px;
  height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.trade-cond-box::-webkit-scrollbar{
  width: 0;
  height: 0;
}
.trade-cond-box :deep(.cond-editor){
  min-height: 100%;
}
.trade-cond-box::after{
  content: '';
  position: sticky;
  left: 0;
  right: 0;
  bottom: 0;
  display: block;
  height: 8px;
  background: linear-gradient(to bottom, rgba(248,250,252,0), rgba(248,250,252,.55));
  pointer-events: none;
}
.trade-trigger-row{
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(148,163,184,.35);
}
.trigger-inline{
  display:flex;
  align-items:center;
  gap: 14px;
  padding: 2px 2px 0;
}
.trigger-radio-group{
  display:flex;
  align-items:center;
  gap: 14px;
}
.edit-shell.is-trade .trade-trigger-row .field,
.edit-shell.is-trade .trade-risk-grid .field,
.edit-shell.is-trade .trade-form-grid .field{
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 0;
  margin-top: 10px;
}
.trade-risk-grid{
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.trade-risk-grid .field{
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, .24);
  border-radius: 12px;
  padding: 8px 10px;
}
@media (max-width: 1100px){
  .trade-summary-bar{
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>





