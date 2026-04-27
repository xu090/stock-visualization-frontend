<template>
  <el-dialog
    v-model="dialogVisible"
    title="全部筛选策略"
    width="650px"
    class="all-strategy-dialog"
    draggable
    destroy-on-close
  >
    <div class="all-list">
      <div
        v-for="s in selectStrategies"
        :key="`all-sel-${s.id}`"
        class="all-item"
        :data-strategy-id="String(s.id)"
        :ref="el => setItemRef(s.id, el)"
      >
        <div class="all-main">
          <div class="all-line1">
            <span class="all-name">{{ s.name }}</span>
            <span v-if="s.isCustom" class="tag custom">自定义</span>
            <button
              class="star-btn"
              type="button"
              :title="s.isFavorite ? '取消收藏' : '收藏'"
              @click.stop="emitToggleFavorite(s)"
            >
              <el-icon class="star-icon" :class="{ on: s.isFavorite }">
                <StarFilled v-if="s.isFavorite" />
                <Star v-else />
              </el-icon>
            </button>
          </div>
          <div class="all-info-row">
            <div class="k">描述</div>
            <div class="v">{{ s.desc || '无描述' }}</div>
          </div>
          <div class="all-info-row">
            <div class="k">排序</div>
            <div class="v">{{ metricsTextFull(s.snapshot) }}</div>
          </div>
          <div class="all-info-row">
            <div class="k">筛选</div>
            <div class="v">{{ filtersTextFull(s.snapshot) }}</div>
          </div>
        </div>
        <div class="all-actions">
          <el-button
            size="small"
            type="primary"
            :plain="s.id !== currentAppliedSelectId"
            @click="emitToggleApply(s)"
          >
            {{ s.id === currentAppliedSelectId ? '取消应用' : '应用' }}
          </el-button>
          <el-button size="small" plain @click="emitEdit(s)">编辑</el-button>
          <el-button v-if="s.isCustom" size="small" plain type="danger" @click="emitRemove(s)">删除</el-button>
        </div>
      </div>
    </div>

    <div class="tab-toolbar">
      <el-button type="primary" @click="openCreate">新建筛选策略</el-button>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </div>
  </el-dialog>

  <el-dialog
    v-model="createVisible"
    title="新建筛选策略"
    width="940px"
    class="edit-dialog"
    :close-on-click-modal="false"
    draggable
    append-to-body
    destroy-on-close
  >
    <div class="edit-shell" v-if="createForm">
      <div class="edit-two-col">
        <div class="col-left">
          <div class="edit-top-card">
            <div class="edit-top-grid">
              <div class="field">
                <div class="panel-title">策略名称</div>
                <el-input v-model="createForm.name" placeholder="请输入策略名称" />
              </div>
              <div class="field">
                <div class="panel-title">策略描述</div>
                <el-input v-model="createForm.desc" type="textarea" :rows="2" placeholder="用于复盘/备注（可选）" />
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">
                排序指标
                <span class="panel-sub">已选 {{ (createForm.snapshot?.selectedMetrics || []).length }}/3</span>
              </div>
              <el-button
                size="small"
                plain
                @click="clearCreateSort"
                :disabled="(createForm.snapshot?.selectedMetrics || []).length === 0"
              >
                清空
              </el-button>
            </div>
            <MetricEditor v-model:selectedKeys="createForm.snapshot.selectedMetrics" :metric-defs="metricDefs" />
          </div>
        </div>

        <div class="col-right">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">筛选条件</div>
              <el-button size="small" plain @click="resetCreateFilters">一键清空</el-button>
            </div>
            <FilterEditor :filters="createForm.snapshot.filters" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="createVisible = false">取消</el-button>
      <el-button type="primary" @click="submitCreate">保存策略</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, defineEmits, defineExpose, defineProps, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Star, StarFilled } from '@element-plus/icons-vue'
import MetricEditor from '@/components/strategy/MetricEditor.vue'
import FilterEditor from '@/components/strategy/FilterEditor.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  selectStrategies: { type: Array, default: () => [] },
  currentAppliedSelectId: { type: [Number, String, null], default: null },
  loggedIn: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update:modelValue',
  'toggle-favorite',
  'toggle-apply',
  'edit',
  'remove',
  'create'
])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const metricDefs = [
  { key: 'change', label: '涨跌幅' },
  { key: 'changeAmount', label: '涨跌额' },
  { key: 'amount', label: '成交额' },
  { key: 'upRatio', label: '上涨占比' },
  { key: 'volatility', label: '波动率' }
]
const visibleMetricKeys = new Set(metricDefs.map(item => item.key))

const metricLabel = key => metricDefs.find(x => x.key === key)?.label || key

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

const metricsTextFull = snap => {
  const keys = (normalizeStrategySnapshot(snap)?.selectedMetrics || []).filter(Boolean).slice(0, 3)
  if (!keys.length) return '无'
  if (keys.length === 1) return `排序：${metricLabel(keys[0])}`
  return `排序：${keys.map(metricLabel).join('、')}`
}

const filtersTextFull = snap => {
  const f = normalizeStrategySnapshot(snap)?.filters || {}
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
  return parts.join('，') || '无'
}

const emitToggleFavorite = strategy => emit('toggle-favorite', { type: 'select', strategy })
const emitToggleApply = strategy => emit('toggle-apply', { type: 'select', strategy })
const emitEdit = strategy => emit('edit', { type: 'select', strategy })
const emitRemove = strategy => emit('remove', { type: 'select', strategy })

const itemRefs = ref(new Map())

const setItemRef = (id, el) => {
  const key = String(id)
  if (el) itemRefs.value.set(key, el)
  else itemRefs.value.delete(key)
}

const flashCard = el => {
  if (!el) return
  el.classList.remove('focus-flash')
  void el.offsetWidth
  el.classList.add('focus-flash')
  window.setTimeout(() => el.classList.remove('focus-flash'), 1200)
}

const focusStrategyCard = async (_type, id) => {
  await nextTick()
  const el = itemRefs.value.get(String(id))
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashCard(el)
  return true
}

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

const createVisible = ref(false)
const createForm = ref(null)

const openCreate = () => {
  if (!props.loggedIn) {
    ElMessage.warning('请先登录')
    return
  }
  createForm.value = {
    name: '',
    desc: '',
    snapshot: {
      scope: 'all',
      searchQuery: '',
      selectedMetrics: [],
      filters: emptySelectFilters()
    }
  }
  createVisible.value = true
}

defineExpose({ focusStrategyCard, openCreate })

const clearCreateSort = () => {
  if (!createForm.value?.snapshot) return
  createForm.value.snapshot.selectedMetrics = []
}

const resetCreateFilters = () => {
  const filters = createForm.value?.snapshot?.filters
  if (!filters) return
  Object.assign(filters, emptySelectFilters())
}

const submitCreate = () => {
  const form = createForm.value
  if (!form?.name?.trim()) {
    ElMessage.warning('请输入策略名称')
    return
  }
  emit('create', {
    type: 'select',
    payload: {
      name: form.name,
      desc: form.desc,
      isFavorite: false,
      isCustom: true,
      snapshot: {
        scope: 'all',
        searchQuery: '',
        selectedMetrics: (form.snapshot?.selectedMetrics || []).slice(0, 3),
        filters: { ...(form.snapshot?.filters || {}) }
      }
    }
  })
  createVisible.value = false
}
</script>

<style scoped>
:deep(.all-strategy-dialog .el-dialog__body) {
  padding-top: 10px;
}

.tab-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
  gap: 8px;
}

.all-list {
  max-height: 420px;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.all-list::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.all-item {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: #fff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.all-item.focus-flash {
  animation: cardFlash 1.1s ease;
}

@keyframes cardFlash {
  0% { box-shadow: 0 0 0 0 rgba(64, 158, 255, 0.55); }
  35% { box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.3); }
  100% { box-shadow: 0 10px 18px rgba(0, 0, 0, 0.05); }
}

.all-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.all-line1 {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.all-name {
  font-size: 13px;
  font-weight: 900;
  color: #111827;
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

.tag.custom {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  color: #0f766e;
  background: rgba(45, 212, 191, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.34);
}

.all-info-row {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 8px;
  font-size: 12px;
  line-height: 1.4;
}

.all-info-row .k {
  color: #6b7280;
  font-weight: 800;
}

.all-info-row .v {
  color: #111827;
  font-weight: 700;
  white-space: pre-wrap;
}

.all-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

:deep(.edit-dialog .el-dialog__body) {
  padding: 14px 16px 12px;
}

.edit-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
