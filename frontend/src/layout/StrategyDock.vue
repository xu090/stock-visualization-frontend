<template>
  <div class="strategy-dock" id="tour-strategy">
    <div class="strategy-header">
      <div class="h-top">
        <span class="strategy-title">筛选策略</span>
        <div class="h-top-actions">
          <el-button size="small" plain type="success" @click="allDialogVisible = true">
            全部策略
          </el-button>
        </div>
      </div>
    </div>

    <div class="strategy-body scroll-hidden">
      <div v-if="hasVisibleStrategies" class="section-group">
        <div v-if="favoriteStrategies.length" class="section">
          <div class="section-head">
            <span class="section-title">收藏策略</span>
          </div>
          <div class="strategy-list">
            <div
              v-for="s in favoriteStrategies"
              :key="`fav-${s.id}`"
              class="strategy-item"
              :class="{ applied: s.id === currentAppliedSelectId }"
              @click="openAllStrategiesAt(s)"
            >
              <div class="s-main">
                <div class="s-line1">
                  <span class="s-name" :title="s.name">{{ s.name }}</span>
                  <span v-if="s.isCustom" class="tag custom inline-tag">自定义</span>
                  <span v-if="s.id === currentAppliedSelectId" class="badge">应用</span>
                  <button
                    class="star-btn"
                    type="button"
                    :title="s.isFavorite ? '取消收藏' : '收藏'"
                    @click.stop="toggleFavorite(s)"
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

              <div class="s-actions" @click.stop>
                <el-button
                  class="btn-act"
                  size="small"
                  type="primary"
                  :plain="s.id !== currentAppliedSelectId"
                  @click="toggleApply(s)"
                >
                  {{ s.id === currentAppliedSelectId ? '取消' : '应用' }}
                </el-button>
                <el-button class="btn-act" size="small" plain @click="openEdit(s)">编辑</el-button>
                <el-button class="btn-act" size="small" plain type="danger" @click="removeStrategySafe(s)">删除</el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-head">
            <span class="section-title">自定义策略</span>
          </div>
          <div class="strategy-list" v-if="customStrategies.length">
            <div
              v-for="s in customStrategies"
              :key="`custom-${s.id}`"
              class="strategy-item"
              :class="{ applied: s.id === currentAppliedSelectId }"
              @click="openAllStrategiesAt(s)"
            >
              <div class="s-main">
                <div class="s-line1">
                  <span class="s-name" :title="s.name">{{ s.name }}</span>
                  <span v-if="s.isCustom" class="tag custom inline-tag">自定义</span>
                  <span v-if="s.id === currentAppliedSelectId" class="badge">应用</span>
                  <button
                    class="star-btn"
                    type="button"
                    :title="s.isFavorite ? '取消收藏' : '收藏'"
                    @click.stop="toggleFavorite(s)"
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
              </div>

              <div class="s-actions" @click.stop>
                <el-button
                  class="btn-act"
                  size="small"
                  type="primary"
                  :plain="s.id !== currentAppliedSelectId"
                  @click="toggleApply(s)"
                >
                  {{ s.id === currentAppliedSelectId ? '取消' : '应用' }}
                </el-button>
                <el-button class="btn-act" size="small" plain @click="openEdit(s)">编辑</el-button>
                <el-button class="btn-act" size="small" plain type="danger" @click="removeStrategySafe(s)">删除</el-button>
              </div>
            </div>
          </div>
          <div v-else class="empty-trade">
            <div class="empty-title">暂无自定义策略</div>
          </div>
        </div>
      </div>

      <div v-else class="empty-trade">
        <div class="empty-title">暂无筛选策略</div>
        <div class="empty-sub">可在“全部策略”中收藏，或新建自定义策略。</div>
      </div>
    </div>

    <AllStrategyDialog
      ref="allDialogRef"
      v-model="allDialogVisible"
      :select-strategies="strategyStore.selectStrategies"
      :current-applied-select-id="currentAppliedSelectId"
      :logged-in="authStore.isLoggedIn"
      @toggle-favorite="onAllDialogToggleFavorite"
      @toggle-apply="onAllDialogToggleApply"
      @edit="onAllDialogEdit"
      @remove="onAllDialogRemove"
      @create="onAllDialogCreate"
    />

    <el-dialog
      v-model="editVisible"
      :title="editDialogTitle"
      width="940px"
      class="edit-dialog"
      :close-on-click-modal="false"
      draggable
      destroy-on-close
    >
      <div class="edit-shell" v-if="editForm">
        <el-alert
          v-if="isEditingPreset"
          title="系统预设策略不会被修改，保存后将生成一条新的自定义策略。"
          type="info"
          show-icon
          :closable="false"
          class="preset-edit-alert"
        />
        <div class="edit-two-col">
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
      </div>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">{{ submitEditText }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Star, StarFilled } from '@element-plus/icons-vue'
import { useStrategyStore } from '@/stores/strategy'
import { useHomeFilterStore } from '@/stores/homeFilter'
import { useAuthStore } from '@/stores/auth'
import AllStrategyDialog from '@/components/strategy/AllStrategyDialog.vue'
import MetricEditor from '@/components/strategy/MetricEditor.vue'
import FilterEditor from '@/components/strategy/FilterEditor.vue'

const strategyStore = useStrategyStore()
const homeFilter = useHomeFilterStore()
const authStore = useAuthStore()

function requireLogin() {
  if (authStore.isLoggedIn) return true
  ElMessage.warning('请先登录')
  return false
}

const metricDefs = [
  { key: 'change', label: '涨跌幅', tip: '概念当前涨跌幅' },
  { key: 'changeAmount', label: '涨跌额', tip: '概念当前涨跌额' },
  { key: 'amount', label: '成交额', tip: '概念成交额' },
  { key: 'upRatio', label: '上涨占比', tip: '上涨股票占比' },
  { key: 'volatility', label: '波动率', tip: '数据库行情振幅均值' }
]
const visibleMetricKeys = new Set(metricDefs.map(item => item.key))

const currentAppliedSelectId = computed({
  get: () => homeFilter.appliedSelectStrategyId || null,
  set: value => { homeFilter.appliedSelectStrategyId = value }
})

const moveAppliedToTop = (list = [], appliedId = null) => {
  const rows = Array.isArray(list) ? list.slice() : []
  if (!appliedId) return rows
  const index = rows.findIndex(item => item?.id === appliedId)
  if (index <= 0) return rows
  const [applied] = rows.splice(index, 1)
  rows.unshift(applied)
  return rows
}

const favoriteStrategies = computed(() => {
  const list = (strategyStore.selectStrategies || []).filter(s => !!s.isFavorite)
  return moveAppliedToTop(list, currentAppliedSelectId.value)
})

const customStrategies = computed(() => {
  const list = (strategyStore.selectStrategies || []).filter(s => !!s.isCustom && !s.isFavorite)
  return moveAppliedToTop(list, currentAppliedSelectId.value)
})

const hasVisibleStrategies = computed(() => favoriteStrategies.value.length > 0 || customStrategies.value.length > 0)

const emptySelectFilters = () => ({
  minChange: null,
  maxChange: null,
  minChangeAmount: null,
  maxChangeAmount: null,
  minAmountY: null,
  maxAmountY: null,
  minUpRatio: null,
  maxUpRatio: null,
  maxVolatility: null,
  maxDrawdown20d: null
})

const defaultSelectSnapshot = () => ({
  scope: 'all',
  selectedMetrics: [],
  filters: emptySelectFilters(),
  searchQuery: ''
})

const normalizeStrategySnapshot = snap => {
  const base = snap || {}
  const filters = { ...(base.filters || {}) }
  if (filters.minChangeAmount == null && filters.minNetInflowY != null) filters.minChangeAmount = filters.minNetInflowY
  if (filters.maxChangeAmount == null && filters.maxNetInflowY != null) filters.maxChangeAmount = filters.maxNetInflowY
  delete filters.minNetInflowY
  delete filters.maxNetInflowY
  delete filters.minVolRatio
  delete filters.maxVolRatio
  delete filters.minStrength
  delete filters.minSpike5m
  return {
    ...base,
    selectedMetrics: Array.isArray(base.selectedMetrics)
      ? base.selectedMetrics
        .map(key => (key === 'netInflow' ? 'changeAmount' : key))
        .filter(key => visibleMetricKeys.has(key))
        .slice(0, 3)
      : [],
    filters,
  }
}

const normalizeStrategyFilters = filters => normalizeStrategySnapshot({ filters }).filters || {}

const snapshotWithoutSearch = snap => {
  const base = normalizeStrategySnapshot(snap)
  const rest = { ...base }
  delete rest.searchQuery
  return { ...rest, searchQuery: '' }
}

const resetHomeSelectToDefault = () => {
  const snap = snapshotWithoutSearch(defaultSelectSnapshot())
  homeFilter.applySnapshot?.(snap)
  homeFilter.selectedMetrics = []
  homeFilter.filters = { ...emptySelectFilters() }
  homeFilter.searchQuery = ''
  if ('scope' in homeFilter) homeFilter.scope = 'all'
}

const toggleApply = s => {
  if (!s?.snapshot) {
    ElMessage.warning('该策略没有快照')
    return
  }
  if (s.id === currentAppliedSelectId.value) {
    currentAppliedSelectId.value = null
    resetHomeSelectToDefault()
    ElMessage.success('已取消筛选策略应用')
    return
  }
  homeFilter.applySnapshot?.(snapshotWithoutSearch(s.snapshot))
  currentAppliedSelectId.value = s.id
  ElMessage.success(`已应用：${s.name}`)
}

const toggleFavorite = async s => {
  if (!s) return
  if (!requireLogin()) return
  try {
    const nextFavorite = !s.isFavorite
    await strategyStore.toggleFavorite('select', s.id)
    ElMessage.success(nextFavorite ? '已收藏' : '已取消收藏')
  } catch (error) {
    ElMessage.error(error?.message || '收藏状态更新失败')
  }
}

const removeStrategySafe = async s => {
  if (!requireLogin()) return
  try {
    await ElMessageBox.confirm(`确定删除「${s.name}」吗？`, '删除策略', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await strategyStore.removeStrategy('select', s.id)
    if (currentAppliedSelectId.value === s.id) {
      currentAppliedSelectId.value = null
      resetHomeSelectToDefault()
    }
    ElMessage.success('已删除')
  } catch (err) {
    void err
  }
}

const ensureFilterShape = filters => {
  const f = filters || {}
  if (!('minChange' in f)) f.minChange = null
  if (!('maxChange' in f)) f.maxChange = null
  if (f.minChangeAmount == null && f.minNetInflowY != null) f.minChangeAmount = f.minNetInflowY
  if (f.maxChangeAmount == null && f.maxNetInflowY != null) f.maxChangeAmount = f.maxNetInflowY
  if (!('minChangeAmount' in f)) f.minChangeAmount = null
  if (!('maxChangeAmount' in f)) f.maxChangeAmount = null
  if (!('minAmountY' in f)) f.minAmountY = null
  if (!('maxAmountY' in f)) f.maxAmountY = null
  delete f.minNetInflowY
  delete f.maxNetInflowY
  delete f.minVolRatio
  delete f.maxVolRatio
  delete f.minStrength
  delete f.minSpike5m
  if (!('minUpRatio' in f)) f.minUpRatio = null
  if (!('maxUpRatio' in f)) f.maxUpRatio = null
  if (!('maxVolatility' in f)) f.maxVolatility = null
  if (!('maxDrawdown20d' in f)) f.maxDrawdown20d = null
  return f
}

const metricsTextShort = snap => {
  const keys = (normalizeStrategySnapshot(snap)?.selectedMetrics || []).filter(Boolean).slice(0, 3)
  if (!keys.length) return '无'
  return keys.map(key => metricDefs.find(item => item.key === key)?.label || key).join('、')
}

const buildFilterParts = f => {
  f = normalizeStrategyFilters(f)
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
  const b = range(f.minChangeAmount, f.maxChangeAmount, ''); if (b) parts.push(`涨跌额${b}`)
  const c = range(f.minAmountY, f.maxAmountY, '亿'); if (c) parts.push(`成交额${c}`)
  const e = range(
    f.minUpRatio != null ? Math.round(f.minUpRatio * 100) : null,
    f.maxUpRatio != null ? Math.round(f.maxUpRatio * 100) : null,
    '%'
  )
  if (e) parts.push(`上涨占比${e}`)
  if (f.maxVolatility != null) parts.push(`波动<=${f.maxVolatility}`)
  if (f.maxDrawdown20d != null) parts.push(`回撤>=${f.maxDrawdown20d}%`)
  return parts
}

const filtersTextShort = snap => {
  const parts = buildFilterParts(snap?.filters || {})
  if (!parts.length) return '无'
  const head = parts.slice(0, 2)
  const more = parts.length - head.length
  return more > 0 ? `${head.join('，')} +${more}` : head.join('，')
}

const allDialogVisible = ref(false)
const allDialogRef = ref(null)

const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms))

const openAllStrategiesAt = async strategy => {
  if (!strategy?.id) {
    allDialogVisible.value = true
    return
  }
  allDialogVisible.value = true
  await nextTick()
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const focused = await allDialogRef.value?.focusStrategyCard?.('select', strategy.id)
    if (focused) return
    await wait(80)
  }
}

const onAllDialogToggleFavorite = ({ strategy }) => toggleFavorite(strategy)
const onAllDialogToggleApply = ({ strategy }) => toggleApply(strategy)
const onAllDialogEdit = ({ strategy }) => openEdit(strategy)
const onAllDialogRemove = ({ strategy }) => removeStrategySafe(strategy)
const onAllDialogCreate = async ({ payload }) => {
  if (!requireLogin()) return
  try {
    await strategyStore.addSelectStrategyFromSnapshot(payload)
    ElMessage.success('已新建策略')
  } catch (error) {
    ElMessage.error(error?.message || '策略新建失败')
  }
}

const editVisible = ref(false)
const editForm = ref(null)
const isEditingPreset = computed(() => !!editForm.value && !editForm.value.isCustom)
const editDialogTitle = computed(() => isEditingPreset.value ? '基于预设新建策略' : '编辑筛选策略')
const submitEditText = computed(() => isEditingPreset.value ? '保存为自定义策略' : '保存修改')

const openEdit = s => {
  if (!requireLogin()) return
  const clone = JSON.parse(JSON.stringify(s || {}))
  clone.snapshot = normalizeStrategySnapshot(clone.snapshot || { scope: 'all', selectedMetrics: [], filters: {} })
  clone.snapshot.searchQuery = ''
  clone.snapshot.filters = ensureFilterShape(clone.snapshot.filters || {})
  if (!clone.isCustom && clone.name && !String(clone.name).includes('自定义')) {
    clone.name = `${clone.name}（自定义）`
  }
  editForm.value = clone
  editVisible.value = true
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

const submitEdit = async () => {
  if (!requireLogin()) return
  const s = editForm.value
  if (!s?.name?.trim()) {
    ElMessage.warning('请输入策略名称')
    return
  }
  const cleanSnap = snapshotWithoutSearch({
    ...(s.snapshot || {}),
    filters: ensureFilterShape(s.snapshot?.filters || {})
  })
  try {
    if (s.isCustom) {
      await strategyStore.updateStrategy('select', s.id, {
        name: s.name,
        desc: s.desc,
        snapshot: cleanSnap
      })
    } else {
      await strategyStore.addSelectStrategyFromSnapshot({
        name: s.name,
        desc: s.desc,
        snapshot: cleanSnap,
        isFavorite: false,
        isCustom: true
      })
    }
    editVisible.value = false
    ElMessage.success(s.isCustom ? '已保存修改' : '已保存为自定义策略')
  } catch (error) {
    ElMessage.error(error?.message || '策略保存失败')
  }
}
</script>

<style scoped>
.strategy-dock {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  padding: 8px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
}

.scroll-hidden {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.scroll-hidden::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.strategy-header {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 8px;
}

.h-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.strategy-title {
  font-weight: 700;
  font-size: 15px;
  color: #111827;
}

.strategy-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding-top: 8px;
  min-height: 0;
}

.section-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-head {
  display: flex;
  align-items: center;
  padding: 3px 2px 7px;
}

.section-title {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding-left: 10px;
  font-weight: 700;
  font-size: 13px;
  color: #374151;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 4px;
  height: 14px;
  border-radius: 999px;
  background: #409eff;
  transform: translateY(-50%);
}

.strategy-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.strategy-item {
  background: #fff;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  box-shadow: 0 6px 12px rgba(15, 23, 42, 0.04);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.strategy-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  border-color: rgba(64, 158, 255, 0.28);
}

.strategy-item.applied::before {
  content: '';
  position: absolute;
}

.s-main {
  padding: 8px;
}

.s-line1 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.s-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 900;
  font-size: 12px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag.custom {
  color: #0f766e;
  background: rgba(45, 212, 191, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.34);
  border-radius: 999px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 800;
}

.badge {
  font-size: 11px;
  font-weight: 900;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(64, 158, 255, 0.25);
  background: rgba(64, 158, 255, 0.08);
  color: #409eff;
}

.star-btn {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  line-height: 1;
  cursor: pointer;
}

.star-icon {
  font-size: 14px;
  color: #cbd5e1;
}

.star-icon.on {
  color: #f59e0b;
}

.s-line2 {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.mini {
  font-weight: 900;
  color: #9ca3af;
}

.val {
  font-weight: 900;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.s-actions {
  border-top: 1px dashed rgba(148, 163, 184, 0.32);
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.btn-act {
  height: 26px !important;
  width: auto;
  padding: 0 8px !important;
  border-radius: 10px !important;
  font-weight: 800;
  font-size: 12px;
}

.empty-trade {
  background: rgba(0, 0, 0, 0.02);
  border: 1px dashed rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 10px;
}

.empty-title {
  font-weight: 900;
  color: #6b7280;
  font-size: 12px;
}

.empty-sub {
  margin-top: 6px;
  font-weight: 800;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.35;
}

:deep(.edit-dialog .el-dialog__body) {
  padding: 14px 16px 12px;
}

.edit-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preset-edit-alert {
  margin-bottom: 0;
}

.edit-two-col {
  display: grid;
  grid-template-columns: 1fr 1.08fr;
  gap: 14px;
  align-items: start;
}

.col-left,
.col-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-two-col .edit-top-grid {
  grid-template-columns: 1fr;
}

.edit-top-card,
.panel {
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.04);
}

.edit-top-grid {
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.panel-title {
  font-weight: 750;
  color: #111827;
  font-size: 14px;
  line-height: 1.2;
}

.panel-sub {
  display: inline-block;
  margin-left: 10px;
  font-weight: 800;
  color: #9ca3af;
  font-size: 12px;
}
</style>
