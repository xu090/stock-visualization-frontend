<template>
  <el-dialog
    v-model="dialogVisible"
    title="全部策略"
    width="650px"
    class="all-strategy-dialog"
    draggable
    destroy-on-close
  >
    <el-tabs v-model="dialogTab">
      <el-tab-pane :label="`选股策略（${selectStrategyCount}）`" name="select">
        
        <div class="all-list">
          <div
            v-for="s in selectStrategies"
            :key="`all-sel-${s.id}`"
            class="all-item"
            :data-strategy-type="'select'"
            :data-strategy-id="String(s.id)"
            :ref="(el) => setItemRef('select', s.id, el)"
          >
            <div class="all-main">
              <div class="all-line1">
                <span class="all-name">{{ s.name }}</span>
                <span v-if="s.isCustom" class="tag custom">自定义</span>
                <button
                  class="star-btn"
                  type="button"
                  :title="s.isFavorite ? '取消收藏' : '收藏'"
                  @click.stop="emitToggleFavorite('select', s)"
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
                @click="emitToggleApply('select', s)"
              >
                {{ s.id === currentAppliedSelectId ? '取消应用' : '应用' }}
              </el-button>
              <el-button size="small" plain @click="emitEdit('select', s)">编辑</el-button>
              <el-button size="small" plain type="danger" @click="emitRemove('select', s)">删除</el-button>
            </div>
          </div>
        </div>
        <div class="tab-toolbar">
          <el-button type="primary" @click="openCreate('select')">新建选股策略</el-button>
          <el-button @click="dialogVisible = false">关闭</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="`交易策略（${tradeStrategyCount}）`" name="trade">
        
        <div class="all-list" v-if="tradeStrategies.length">
          <div
            v-for="s in tradeStrategies"
            :key="`all-tr-${s.id}`"
            class="all-item"
            :data-strategy-type="'trade'"
            :data-strategy-id="String(s.id)"
            :ref="(el) => setItemRef('trade', s.id, el)"
          >
            <div class="all-main">
              <div class="all-line1">
                <span class="all-name">{{ s.name }}</span>
                <span v-if="s.isCustom" class="tag custom">自定义</span>
                <button
                  class="star-btn"
                  type="button"
                  :title="s.isFavorite ? '取消收藏' : '收藏'"
                  @click.stop="emitToggleFavorite('trade', s)"
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

              <div
                v-for="(row, idx) in tradeDisplayEntries(s.snapshot)"
                :key="`all-tr-row-${s.id}-${idx}`"
                class="trade-info-block"
              >
                <div class="trade-info-title">{{ row.key }}</div>
                <div v-if="row.key === '买卖条件'" class="trade-cond-sections">
                  <div
                    v-for="(sec, secIdx) in tradeConditionSections(row.value)"
                    :key="`all-tr-row-${s.id}-${idx}-sec-${secIdx}`"
                    class="trade-cond-section"
                  >
                    <div class="trade-cond-label">{{ sec.label }}</div>
                    <div class="trade-cond-items">
                      <div
                        v-for="(item, itemIdx) in sec.items"
                        :key="`all-tr-row-${s.id}-${idx}-sec-${secIdx}-item-${itemIdx}`"
                        class="trade-cond-item"
                      >
                        <span class="trade-cond-num">{{ item.num }}</span>
                        <span class="trade-cond-text">{{ item.text }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="trade-info-lines">
                  <div
                    v-for="(line, lineIdx) in tradeDisplayLines(row.value)"
                    :key="`all-tr-row-${s.id}-${idx}-line-${lineIdx}`"
                    class="trade-info-line"
                  >
                    {{ line }}
                  </div>
                </div>
              </div>
            </div>
            <div class="all-actions">
              <el-button
                size="small"
                type="primary"
                :plain="s.id !== currentAppliedTradeId"
                @click="emitToggleApply('trade', s)"
              >
                {{ s.id === currentAppliedTradeId ? '取消应用' : '应用' }}
              </el-button>
              <el-button size="small" plain @click="emitEdit('trade', s)">编辑</el-button>
              <el-button size="small" plain type="danger" @click="emitRemove('trade', s)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-else class="empty-trade">
          <div class="empty-title">暂无交易策略</div>
          <div class="empty-sub">点击“新建交易策略”添加你的第一条交易策略。</div>
        </div>
        <div class="tab-toolbar">
          <el-button type="primary"  @click="openCreate('trade')">新建交易策略</el-button>
          <el-button @click="dialogVisible = false">关闭</el-button>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>

  <el-dialog
    v-model="createVisible"
    :title="createType === 'select' ? '新建选股策略' : '新建交易策略'"
    width="940px"
    class="edit-dialog"
    :close-on-click-modal="false"
    draggable
    append-to-body
    destroy-on-close
  >
    <div class="edit-shell" :class="{ 'is-trade': createType === 'trade' }" v-if="createForm">
      <template v-if="createType === 'select'">
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
      </template>

      <template v-else>
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
            <div class="panel-title">买卖条件</div>
          </div>
          <div class="trade-trigger-row">
            <div class="field">
              <div class="field-label">触发方式</div>
              <el-radio-group v-model="createForm.snapshot.entry.triggerMode">
                <el-radio-button label="close">收盘触发</el-radio-button>
                <el-radio-button label="intraday">盘中触发</el-radio-button>
              </el-radio-group>
            </div>
          </div>
          <div class="trade-form-grid">
            <div class="field">
              <div class="field-label with-meta">
                <span>买入条件</span>
                <span class="field-meta">共{{ createForm.snapshot.entry.conditions.length }}条</span>
              </div>
              <div class="trade-cond-box scroll-hidden">
                <TradeConditionEditor v-model="createForm.snapshot.entry.conditions" />
              </div>
            </div>
            <div class="field">
              <div class="field-label with-meta">
                <span>卖出条件</span>
                <span class="field-meta">共{{ createForm.snapshot.exit.conditions.length }}条</span>
              </div>
              <div class="trade-cond-box scroll-hidden">
                <TradeConditionEditor v-model="createForm.snapshot.exit.conditions" />
              </div>
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
                v-model="createForm.snapshot.rules.stopLossPct"
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
                v-model="createForm.snapshot.rules.takeProfitPct"
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
                v-model="createForm.snapshot.rules.maxPositionPct"
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
import TradeConditionEditor from '@/components/strategy/TradeConditionEditor.vue'
import {
  createDefaultTradeSnapshot,
  getTradeDisplayEntries,
  normalizeTradeSnapshot,
  tradeSnapshotToLegacyRules
} from '@/utils/tradeStrategy'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  tab: { type: String, default: 'select' },
  selectStrategies: { type: Array, default: () => [] },
  tradeStrategies: { type: Array, default: () => [] },
  currentAppliedSelectId: { type: [Number, String, null], default: null },
  currentAppliedTradeId: { type: [Number, String, null], default: null }
})

const emit = defineEmits([
  'update:modelValue',
  'update:tab',
  'toggle-favorite',
  'toggle-apply',
  'edit',
  'remove',
  'create'
])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})
const dialogTab = computed({
  get: () => props.tab,
  set: (v) => emit('update:tab', v)
})
const selectStrategyCount = computed(() => props.selectStrategies?.length || 0)
const tradeStrategyCount = computed(() => props.tradeStrategies?.length || 0)

const emitToggleFavorite = (type, strategy) => emit('toggle-favorite', { type, strategy })
const emitToggleApply = (type, strategy) => emit('toggle-apply', { type, strategy })
const emitEdit = (type, strategy) => emit('edit', { type, strategy })
const emitRemove = (type, strategy) => emit('remove', { type, strategy })

const metricDefs = [
  { key: 'change', label: '涨跌幅' },
  { key: 'netInflow', label: '净流入' },
  { key: 'amount', label: '成交额' },
  { key: 'volRatio', label: '量比' },
  { key: 'upRatio', label: '上涨占比' },
  { key: 'strength', label: '强度' },
  { key: 'spike5m', label: '异动' }
]
const metricLabel = (k) => metricDefs.find(x => x.key === k)?.label || k

const metricsTextFull = (snap) => {
  const keys = (snap?.selectedMetrics || []).filter(Boolean).slice(0, 3)
  if (!keys.length) return '无'
  if (keys.length === 1) return `排序：${metricLabel(keys[0])}`
  return `排序：${keys.map(metricLabel).join('、')}`
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

const tradeDisplayEntries = (snap) => {
  return getTradeDisplayEntries(snap)
}

const tradeDisplayLines = (text) => {
  const raw = String(text || '')
  if (!raw.trim()) return ['未配置']
  return raw
    .split(/[；;]\s*/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s =>
      s
        .replace(/\bAND\b/g, '且')
        .replace(/\bOR\b/g, '或')
    )
}

const toConditionItem = (line) => {
  const text = String(line || '').trim()
  const numbered = text.match(/^(\d+)[.、]\s*(.+)$/)
  if (numbered) {
    return { num: `${numbered[1]}.`, text: numbered[2].trim() }
  }
  return { num: '', text }
}

const tradeConditionSections = (text) => {
  const lines = tradeDisplayLines(text)
  if (!lines.length) return [{ label: '条件', items: [toConditionItem('未配置')] }]

  const sections = []
  let current = null

  const pushCurrent = () => {
    if (!current) return
    if (!current.items.length) current.items.push(toConditionItem('未配置'))
    sections.push(current)
  }

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim()
    const head = line.match(/^(触发方式|买入条件|卖出条件)\s*[：:]\s*(.*)$/)
    if (head) {
      pushCurrent()
      current = { label: head[1], items: [] }
      if (head[2]) current.items.push(toConditionItem(head[2]))
      continue
    }
    if (!current) current = { label: '条件', items: [] }
    current.items.push(toConditionItem(line))
  }
  pushCurrent()
  return sections
}

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

const createVisible = ref(false)
const createType = ref('select')
const createForm = ref(null)
const itemRefs = ref(new Map())

const normalizeTradeRules = (snap) => tradeSnapshotToLegacyRules(snap)

const setItemRef = (type, id, el) => {
  const key = `${type}-${String(id)}`
  if (el) itemRefs.value.set(key, el)
  else itemRefs.value.delete(key)
}

const flashCard = (el) => {
  if (!el) return
  el.classList.remove('focus-flash')
  void el.offsetWidth
  el.classList.add('focus-flash')
  window.setTimeout(() => el.classList.remove('focus-flash'), 1200)
}

const focusStrategyCard = async (type, id) => {
  await nextTick()
  const el = itemRefs.value.get(`${type}-${String(id)}`)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashCard(el)
  return true
}

defineExpose({ focusStrategyCard })

const openCreate = (type) => {
  createType.value = type
  if (type === 'select') {
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
  } else {
    createForm.value = {
      name: '',
      desc: '',
      snapshot: createDefaultTradeSnapshot()
    }
  }
  createVisible.value = true
}

const clearCreateSort = () => {
  if (!createForm.value?.snapshot) return
  createForm.value.snapshot.selectedMetrics = []
}

const resetCreateFilters = () => {
  const f = createForm.value?.snapshot?.filters
  if (!f) return
  Object.assign(f, emptySelectFilters())
}

const submitCreate = () => {
  const form = createForm.value
  if (!form) return
  if (!form.name?.trim()) return ElMessage.warning('请输入策略名称')

  if (createType.value === 'select') {
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
  } else {
    emit('create', {
      type: 'trade',
      payload: {
        name: form.name,
        desc: form.desc,
        isFavorite: false,
        isCustom: true,
        snapshot: normalizeTradeSnapshot({
          ...(form.snapshot || {}),
          rules: normalizeTradeRules(form.snapshot)
        })
      }
    })
  }

  createVisible.value = false
}
</script>

<style scoped>
:deep(.all-strategy-dialog .el-dialog__body){
  padding-top: 10px;
}
.tab-toolbar{
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
}
.all-list{
  height: 420px;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  display:flex;
  flex-direction: column;
  gap: 10px;
}
.all-list::-webkit-scrollbar{
  width: 0;
  height: 0;
}
.all-item{
  border: 1px solid rgba(0,0,0,.06);
  border-radius: 12px;
  background: #fff;
  padding: 10px;
  display:flex;
  flex-direction: column;
  gap: 8px;
}
.all-item.focus-flash{
  animation: cardFlash 1.1s ease;
}
@keyframes cardFlash{
  0% { box-shadow: 0 0 0 0 rgba(64,158,255,.55); }
  35% { box-shadow: 0 0 0 4px rgba(64,158,255,.3); }
  100% { box-shadow: 0 10px 18px rgba(0,0,0,.05); }
}
.all-main{
  display:flex;
  flex-direction: column;
  gap: 6px;
}
.all-line1{
  display:flex;
  align-items:center;
  gap: 6px;
  min-width: 0;
}
.all-name{
  font-size: 13px;
  font-weight: 900;
  color:#111827;
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
.tag.custom{
  color:#0f766e;
  background: rgba(45,212,191,.12);
  border-color: rgba(45,212,191,.34);
}
.all-info-row{
  display:grid;
  grid-template-columns: 42px 1fr;
  gap: 8px;
  font-size: 12px;
  line-height: 1.4;
}
.all-info-row .k{
  color:#6b7280;
  font-weight: 800;
}
.all-info-row .v{
  color:#111827;
  font-weight: 700;
  white-space: pre-wrap;
}
.trade-info-block{
  border: 1px solid rgba(15, 23, 42, .08);
  background: #f8fafc;
  border-radius: 10px;
  padding: 8px 10px;
}
.trade-info-title{
  font-size: 12px;
  font-weight: 900;
  color:#334155;
  margin-bottom: 6px;
}
.trade-info-lines{
  display:flex;
  flex-direction: column;
  gap: 4px;
}
.trade-cond-sections{
  display:flex;
  flex-direction: column;
  gap: 8px;
}
.trade-cond-section{
  display:grid;
  grid-template-columns: 64px 1fr;
  gap: 8px;
  align-items: start;
}
.trade-cond-label{
  font-size: 12px;
  font-weight: 900;
  color:#475569;
  line-height: 1.5;
}
.trade-cond-items{
  display:flex;
  flex-direction: column;
  gap: 4px;
}
.trade-cond-item{
  display:grid;
  grid-template-columns: 26px 1fr;
  gap: 2px;
  align-items: start;
  font-size: 12px;
  line-height: 1.5;
  color:#0f172a;
  font-weight: 700;
}
.trade-cond-num{
  color:#64748b;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.trade-cond-text{
  white-space: pre-wrap;
}
.trade-info-line{
  position: relative;
  padding-left: 10px;
  font-size: 12px;
  line-height: 1.5;
  color:#0f172a;
  font-weight: 700;
  white-space: pre-wrap;
}
.trade-info-line::before{
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #64748b;
}
.all-actions{
  display:flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
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

:deep(.edit-dialog .el-dialog__body){
  padding: 14px 16px 12px;
}
.edit-shell{
  display:flex;
  flex-direction: column;
  gap: 14px;
}
.edit-shell.is-trade{
  height: auto;
  overflow: visible;
}
.edit-shell.is-trade .edit-top-card,
.edit-shell.is-trade .panel{
  padding: 10px;
}
.edit-shell.is-trade .panel-head{
  margin-bottom: 8px;
}
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
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
.trade-form-grid .field{
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, .24);
  border-radius: 12px;
  padding: 10px;
}
.trade-cond-box{
  margin-top: 2px;
  height: 170px;
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
  margin-bottom: 8px;
}
.trade-trigger-row .field{
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, .24);
  border-radius: 12px;
  padding: 10px;
}
.trade-risk-grid{
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.trade-risk-grid .field{
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, .24);
  border-radius: 12px;
  padding: 10px;
}
</style>
