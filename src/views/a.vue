<template>
  <div class="concept-management">
    <!-- 顶部：搜索 + 排序（紧凑布局） -->
    <div class="topbar" id="tour-topbar">
      <!-- 搜索 -->
      <div class="panel panel-search" id="tour-search">
        <div class="panel-head">
          <div class="panel-title">
            搜索
            <span class="panel-desc">仅名称模糊匹配</span>
          </div>
          <div class="panel-actions">
            <el-button size="small" plain @click="clearSearch" :disabled="!searchQuery">
              清空
            </el-button>
          </div>
        </div>

        <el-input
          v-model="searchQuery"
          placeholder="输入概念关键词"
          clearable
          @clear="clearSearch"
          class="search-input"
        />
      </div>

      <!-- 排序：默认展开；左标题+已选；右可选+清空 -->
      <div class="panel panel-metrics" id="tour-metrics">
        <div class="metrics-row">
          <!-- 左：标题 + 已选拖拽（灰色已选择区） -->
          <div class="metrics-left">
            <div class="metrics-left-head">
              <div class="metrics-title">
                排序指标
                <el-tooltip
                  effect="dark"
                  placement="top"
                  content="选 1 个：按该指标降序；选 2~3 个：帕累托非支配排序（同层级按第 1 指标微调）。"
                >
                  <span class="help">?</span>
                </el-tooltip>
              </div>

              <div class="metrics-sub">
                <span class="sub-dot" :class="{ on: selectedMetricObjs.length > 0 }"></span>
                已选 <b>{{ selectedMetricObjs.length }}</b>/3
              </div>
            </div>

            <!-- ✅ 已选择区灰框（更高级） -->
            <div class="selected-box">
              <Draggable
                v-model="selectedMetricObjs"
                item-key="key"
                :animation="150"
                handle=".handle"
                ghost-class="ghost"
                chosen-class="chosen"
                drag-class="drag"
                class="selected-drag"
              >
                <template #item="{ element, index }">
                  <span class="chip active" :title="`优先级 ${index + 1}`">
                    <span class="rank">{{ index + 1 }}</span>
                    <span class="handle" title="拖拽">⋮⋮</span>
                    <span class="chip-name">{{ element.label }}</span>
                    <span class="chip-x" title="移除" @click.stop="removeMetric(element.key)">×</span>
                  </span>
                </template>

                <template #footer>
                  <div v-if="selectedMetricObjs.length === 0" class="empty-hint">
                    将右侧指标点击添加，支持拖拽调整优先级
                  </div>
                </template>
              </Draggable>
            </div>
          </div>

          <!-- 右：可选指标 + 清空排序 -->
          <div class="metrics-right">
            <div class="metrics-right-head">
              <div class="metrics-right-title">可选指标</div>
              <el-button size="small" plain @click="clearSort" :disabled="selectedMetricObjs.length === 0">
                清空排序
              </el-button>
            </div>

            <div class="chips-line">
              <span
                v-for="m in metricDefs"
                :key="m.key"
                class="chip"
                :class="{ disabled: isSelected(m.key) }"
                :title="m.tip"
                @click="addMetric(m.key)"
              >
                <span class="chip-name">{{ m.label }}</span>
                <span class="chip-plus" v-if="!isSelected(m.key)">＋</span>
                <span class="chip-check" v-else>✓</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 次级操作条 -->
      <div class="subbar">
        <div class="subbar-left">
          <el-button type="primary" plain class="btn-create" @click="openCreate">
            新建概念
          </el-button>

          <el-button type="success" plain class="btn-save" @click="openSaveStrategy">
            保存策略
          </el-button>

          <el-button type="warning" plain class="btn-reset" @click="resetAll">
            全部重置
          </el-button>
        </div>

        <div class="filter-pill">
          <span class="filter-title">筛选</span>
          <span class="filter-text" :title="summaryFiltersText">{{ summaryFiltersText }}</span>

          <el-button
            link
            type="info"
            class="filter-link"
            @click="clearOnlyFilters"
            :disabled="!hasAnyFilter"
          >
            清空筛选
          </el-button>

          <el-button link type="primary" class="filter-link" @click="filterVisible = true">
            筛选
          </el-button>
        </div>
      </div>
    </div>

    <!-- 概念卡片列表 -->
    <el-row :gutter="14" class="grid" justify="start" id="tour-cards">
      <el-col
        v-for="item in displayList"
        :key="item.id"
        :xs="24"
        :sm="12"
        :md="12"
        :lg="8"
        :xl="8"
      >
        <el-card class="concept-card" shadow="never">
          <div class="card-top">
            <div class="title-wrap">
              <div class="title-line">
                <h3 class="card-title" :title="item.name">{{ item.name }}</h3>
                <span class="mini-tag" v-if="isFavorite(item.id)">自选</span>
                <span class="mini-tag2" v-if="isUserConcept(item.id)">自定义</span>
              </div>

              <div class="sub-line">
                <span class="sub-item">成分股：{{ item.stockCodes?.length ?? 0 }} 支</span>
              </div>
            </div>

            <div class="actions">
              <el-button type="primary" link @click="viewDetail(item)">查看详情</el-button>

              <el-button type="primary" link class="fav" @click="toggleFavorite(item)">
                <el-icon :class="{ selected: isFavorite(item.id) }"><Star /></el-icon>
                {{ isFavorite(item.id) ? '已加入' : '加入' }}
              </el-button>

              <el-button v-if="isUserConcept(item.id)" type="primary" link @click="openEdit(item)">
                编辑
              </el-button>
            </div>
          </div>

          <div class="metrics">
            <div class="metric-row">
              <span class="k">涨跌幅</span>
              <span class="v">
                <span class="chg" :class="chgClass(item.change)">
                  <span class="arrow">{{ chgArrow(item.change) }}</span>
                  <span class="num">{{ fmtPctAbs(item.change) }}</span>
                </span>
              </span>
            </div>

            <div class="metric-row">
              <span class="k">净流入</span>
              <span class="v strong" :class="{ up: item.netInflow > 0, down: item.netInflow < 0 }">
                {{ fmtMoneyY(item.netInflow) }}
              </span>
            </div>

            <div class="metric-row">
              <span class="k">成交额</span>
              <span class="v strong">{{ fmtMoneyY(item.amount) }}</span>
            </div>

            <div class="metric-row">
              <span class="k">量比</span>
              <span class="v strong">{{ fmtNum(item.volRatio, 2) }}</span>
            </div>

            <div class="metric-row">
              <span class="k">上涨占比</span>
              <span class="v strong">{{ fmtUpRatio(item.upRatio) }}</span>
            </div>

            <div class="metric-row">
              <span class="k">强度/异动</span>
              <span class="v strong">{{ item.strength ?? '--' }} / {{ item.spike5m ?? '--' }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 概念编辑抽屉 -->
    <ConceptEditorDrawer v-model="drawerVisible" :editing="editingConcept" @saved="onSaved" />

    <!-- 筛选抽屉（无预设） -->
    <el-drawer v-model="filterVisible" title="筛选" size="460px">
      <div class="filter-form">
        <div class="f-grid">
          <div class="f-item">
            <div class="f-label">涨跌幅（%）</div>
            <div class="f-ctrl">
              <el-input-number v-model="homeFilter.filters.minChange" :min="-20" :max="20" :step="0.5" controls-position="right" placeholder="≥" />
              <span class="to">~</span>
              <el-input-number v-model="homeFilter.filters.maxChange" :min="-20" :max="20" :step="0.5" controls-position="right" placeholder="≤" />
            </div>
          </div>

          <div class="f-item">
            <div class="f-label">净流入（亿）</div>
            <div class="f-ctrl">
              <el-input-number v-model="homeFilter.filters.minNetInflowY" :min="-50" :max="50" :step="0.1" controls-position="right" placeholder="≥" />
              <span class="to">~</span>
              <el-input-number v-model="homeFilter.filters.maxNetInflowY" :min="-50" :max="50" :step="0.1" controls-position="right" placeholder="≤" />
            </div>
          </div>

          <div class="f-item">
            <div class="f-label">成交额（亿）</div>
            <div class="f-ctrl">
              <el-input-number v-model="homeFilter.filters.minAmountY" :min="0" :max="200" :step="1" controls-position="right" placeholder="≥" />
              <span class="to">~</span>
              <el-input-number v-model="homeFilter.filters.maxAmountY" :min="0" :max="200" :step="1" controls-position="right" placeholder="≤" />
            </div>
          </div>

          <div class="f-item">
            <div class="f-label">量比</div>
            <div class="f-ctrl">
              <el-input-number v-model="homeFilter.filters.minVolRatio" :min="0" :max="5" :step="0.1" controls-position="right" placeholder="≥" />
              <span class="to">~</span>
              <el-input-number v-model="homeFilter.filters.maxVolRatio" :min="0" :max="5" :step="0.1" controls-position="right" placeholder="≤" />
            </div>
          </div>

          <div class="f-item">
            <div class="f-label">上涨占比（%）</div>
            <div class="f-ctrl">
              <el-slider v-model="upRatioRangePct" range :min="0" :max="100" :step="5" show-input />
            </div>
          </div>

          <div class="f-item">
            <div class="f-label">强度 / 异动</div>
            <div class="f-ctrl">
              <el-input-number v-model="homeFilter.filters.minStrength" :min="0" :max="100" :step="5" controls-position="right" placeholder="强度≥" />
              <span class="to">/</span>
              <el-input-number v-model="homeFilter.filters.minSpike5m" :min="0" :max="100" :step="5" controls-position="right" placeholder="异动≥" />
            </div>
          </div>

          <div class="f-item">
            <div class="f-label">波动率 / 20日回撤</div>
            <div class="f-ctrl">
              <el-input-number v-model="homeFilter.filters.maxVolatility" :min="0" :max="60" :step="1" controls-position="right" placeholder="波动≤" />
              <span class="to">/</span>
              <el-input-number v-model="homeFilter.filters.maxDrawdown20d" :min="-60" :max="0" :step="1" controls-position="right" placeholder="回撤≥" />
            </div>
          </div>
        </div>

        <div class="f-actions">
          <el-button @click="resetFilters">一键清空</el-button>
          <el-button type="primary" @click="filterVisible = false">完成</el-button>
        </div>
      </div>
    </el-drawer>

    <!-- 保存策略弹窗：展示当前选择的指标 & 筛选条件 -->
    <el-dialog v-model="saveDialogVisible" title="保存策略" width="460px">
      <el-form label-width="90px">
        <el-form-item label="策略名称">
          <el-input v-model="saveForm.name" placeholder="例如：资金强势 + 低波回撤" />
        </el-form-item>

        <el-form-item label="策略描述">
          <el-input v-model="saveForm.desc" type="textarea" :rows="3" placeholder="用于复盘/备注" />
        </el-form-item>

        <el-form-item label="当前排序">
          <div class="snap-line">
            <template v-if="selectedMetricObjs.length">
              <el-tag
                v-for="m in selectedMetricObjs"
                :key="m.key"
                size="small"
                effect="plain"
                class="snap-tag"
              >
                {{ m.label }}
              </el-tag>
            </template>
            <el-tag v-else size="small" effect="plain" type="info">不排序</el-tag>
          </div>
        </el-form-item>

        <el-form-item label="当前筛选">
          <el-tag size="small" effect="plain" type="info" class="snap-filter" :title="summaryFiltersText">
            {{ summaryFiltersText }}
          </el-tag>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doSaveStrategy">确认保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Star, Plus } from '@element-plus/icons-vue'
import Draggable from 'vuedraggable'

import ConceptEditorDrawer from '@/components/ConceptEditorDrawer.vue'
import { useConceptStore } from '@/stores/concept'
import { useStrategyStore } from '@/stores/strategy'
import { useHomeFilterStore } from '@/stores/homeFilter'

const router = useRouter()
const conceptStore = useConceptStore()
const strategyStore = useStrategyStore()
const homeFilter = useHomeFilterStore()

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

/** 搜索（仅重置搜索） */
const searchQuery = computed({
  get: () => homeFilter.searchQuery || '',
  set: (v) => (homeFilter.searchQuery = v)
})
const clearSearch = () => { searchQuery.value = '' }

/** 保证 filters 有 max 字段 */
const ensureFilterShape = () => {
  if (!homeFilter.filters) homeFilter.filters = {}
  const f = homeFilter.filters
  if (!('maxChange' in f)) f.maxChange = null
  if (!('maxNetInflowY' in f)) f.maxNetInflowY = null
  if (!('maxAmountY' in f)) f.maxAmountY = null
  if (!('maxVolRatio' in f)) f.maxVolRatio = null
  if (!('maxUpRatio' in f)) f.maxUpRatio = null
}
ensureFilterShape()

/** 上涨占比 range slider（store 用 0~1） */
const upRatioRangePct = computed({
  get: () => {
    const f = homeFilter.filters
    const min = f.minUpRatio == null ? 0 : Math.round(Number(f.minUpRatio) * 100)
    const max = f.maxUpRatio == null ? 100 : Math.round(Number(f.maxUpRatio) * 100)
    return [min, max]
  },
  set: (arr) => {
    const [min, max] = Array.isArray(arr) ? arr : [0, 100]
    homeFilter.filters.minUpRatio = min === 0 ? null : Number(min) / 100
    homeFilter.filters.maxUpRatio = max === 100 ? null : Number(max) / 100
  }
})

/** 筛选抽屉 */
const filterVisible = ref(false)
const resetFilters = () => {
  const f = homeFilter.filters
  f.minChange = null
  f.maxChange = null
  f.minNetInflowY = null
  f.maxNetInflowY = null
  f.minAmountY = null
  f.maxAmountY = null
  f.minVolRatio = null
  f.maxVolRatio = null
  f.minUpRatio = null
  f.maxUpRatio = null
  f.minStrength = null
  f.minSpike5m = null
  f.maxVolatility = null
  f.maxDrawdown20d = null
}

/** 排序：稳健绑定（防 null） */
const selectedMetricsSafe = computed(() => (Array.isArray(homeFilter.selectedMetrics) ? homeFilter.selectedMetrics : []))

const selectedMetricObjs = computed({
  get: () => selectedMetricsSafe.value.map(k => ({ key: k, label: metricLabel(k) })),
  set: (objs) => {
    const keys = (Array.isArray(objs) ? objs : [])
      .map(x => x?.key)
      .filter(Boolean)
      .slice(0, 3)
    homeFilter.selectedMetrics = keys
  }
})

/** 是否有任何筛选条件（用于禁用“清空筛选”按钮） */
const hasAnyFilter = computed(() => {
  const f = homeFilter.filters || {}
  const keys = [
    'minChange','maxChange',
    'minNetInflowY','maxNetInflowY',
    'minAmountY','maxAmountY',
    'minVolRatio','maxVolRatio',
    'minUpRatio','maxUpRatio',
    'minStrength','minSpike5m',
    'maxVolatility','maxDrawdown20d'
  ]
  return keys.some(k => f[k] != null && f[k] !== '')
})

/** 只清空筛选，不动搜索/排序 */
const clearOnlyFilters = () => {
  resetFilters()
  ElMessage.success('已清空筛选')
}

const isSelected = (key) => selectedMetricsSafe.value.includes(key)

const addMetric = (key) => {
  if (isSelected(key)) return
  const arr = selectedMetricsSafe.value.slice()
  if (arr.length >= 3) {
    ElMessage.warning('最多选择 3 个')
    return
  }
  arr.push(key)
  homeFilter.selectedMetrics = arr
}

const removeMetric = (key) => {
  homeFilter.selectedMetrics = selectedMetricsSafe.value.filter(x => x !== key)
}

const clearSort = () => { homeFilter.selectedMetrics = [] }

/** 总重置：搜索 + 筛选 + 排序 */
const resetAll = () => {
  clearSearch()
  resetFilters()
  clearSort()
  ElMessage.success('已总重置')
}

/** 保存策略：保存当前筛选 + 排序 */
const saveDialogVisible = ref(false)
const saveForm = reactive({ name: '', desc: '' })
const openSaveStrategy = () => {
  saveForm.name = ''
  saveForm.desc = ''
  saveDialogVisible.value = true
}
const doSaveStrategy = () => {
  if (!saveForm.name?.trim()) {
    ElMessage.warning('请输入策略名称')
    return
  }
  if (typeof strategyStore.addSelectStrategyFromSnapshot !== 'function') {
    ElMessage.error('strategyStore.addSelectStrategyFromSnapshot 不存在')
    return
  }
  if (typeof homeFilter.toSnapshot !== 'function') {
    ElMessage.error('homeFilter.toSnapshot 不存在')
    return
  }
  strategyStore.addSelectStrategyFromSnapshot({
    name: saveForm.name,
    desc: saveForm.desc,
    snapshot: homeFilter.toSnapshot()
  })
  saveDialogVisible.value = false
  ElMessage.success('策略已保存')
}

/** 总览数据 */
const baseList = computed(() => conceptStore.conceptOverviewAll || conceptStore.conceptOverviewList || [])

/** 筛选判断（含上限） */
function passFilters(item, f) {
  const change = Number(item?.change ?? 0)
  const netInflowY = Number(item?.netInflow ?? 0) / 1e8
  const amountY = Number(item?.amount ?? 0) / 1e8
  const volRatio = Number(item?.volRatio ?? 0)
  const upRatio = Number(item?.upRatio ?? 0)
  const strength = Number(item?.strength ?? 0)
  const spike5m = Number(item?.spike5m ?? 0)
  const volatility = Number(item?.volatility ?? item?.rtVolatility ?? 0)
  const drawdown20d = Number(item?.drawdown20d ?? item?.rtDrawdown20d ?? 0)

  if (f.minChange != null && change < Number(f.minChange)) return false
  if (f.maxChange != null && change > Number(f.maxChange)) return false

  if (f.minNetInflowY != null && netInflowY < Number(f.minNetInflowY)) return false
  if (f.maxNetInflowY != null && netInflowY > Number(f.maxNetInflowY)) return false

  if (f.minAmountY != null && amountY < Number(f.minAmountY)) return false
  if (f.maxAmountY != null && amountY > Number(f.maxAmountY)) return false

  if (f.minVolRatio != null && volRatio < Number(f.minVolRatio)) return false
  if (f.maxVolRatio != null && volRatio > Number(f.maxVolRatio)) return false

  if (f.minUpRatio != null && upRatio < Number(f.minUpRatio)) return false
  if (f.maxUpRatio != null && upRatio > Number(f.maxUpRatio)) return false

  if (f.minStrength != null && strength < Number(f.minStrength)) return false
  if (f.minSpike5m != null && spike5m < Number(f.minSpike5m)) return false
  if (f.maxVolatility != null && volatility > Number(f.maxVolatility)) return false
  if (f.maxDrawdown20d != null && drawdown20d < Number(f.maxDrawdown20d)) return false

  return true
}

/** 帕累托排序 */
function dominates(a, b, metrics) {
  let better = false
  for (const k of metrics) {
    const av = Number(a?.[k]) || 0
    const bv = Number(b?.[k]) || 0
    if (av < bv) return false
    if (av > bv) better = true
  }
  return better
}

function paretoRankSort(list, metrics) {
  const n = list.length
  const rank = new Array(n).fill(0)
  const remaining = new Set([...Array(n).keys()])
  let r = 1

  while (remaining.size) {
    const front = []
    for (const i of remaining) {
      let dominated = false
      for (const j of remaining) {
        if (i === j) continue
        if (dominates(list[j], list[i], metrics)) { dominated = true; break }
      }
      if (!dominated) front.push(i)
    }
    for (const idx of front) { rank[idx] = r; remaining.delete(idx) }
    r++
  }

  const primary = metrics[0]
  return list
    .map((item, i) => ({ item, r: rank[i] }))
    .sort((x, y) => {
      if (x.r !== y.r) return x.r - y.r
      return (Number(y.item?.[primary]) || 0) - (Number(x.item?.[primary]) || 0)
    })
    .map(x => x.item)
}

/** 列表：默认不排序；有排序指标才排序 */
const displayList = computed(() => {
  const kw = (searchQuery.value || '').trim().toLowerCase()
  const f = homeFilter.filters || {}
  let list = (baseList.value || []).slice()

  if (kw) list = list.filter(c => (c.name || '').toLowerCase().includes(kw))
  list = list.filter(item => passFilters(item, f))

  const metrics = selectedMetricsSafe.value.filter(Boolean).slice(0, 3)
  if (metrics.length === 1) {
    const k = metrics[0]
    list.sort((a, b) => (Number(b?.[k]) || 0) - (Number(a?.[k]) || 0))
  } else if (metrics.length >= 2) {
    list = paretoRankSort(list, metrics)
  }
  return list.slice(0, 18)
})

/** 筛选摘要（右侧 pill + 保存弹窗） */
const summaryFiltersText = computed(() => {
  const f = homeFilter.filters || {}
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

  return parts.join('，') || '无筛选条件'
})

/** 收藏 */
const isFavorite = (id) => conceptStore.isConceptFavorite?.(id) ?? false
const toggleFavorite = (concept) => {
  if (!concept?.id) return
  if (isFavorite(concept.id)) conceptStore.removeConceptFromMyConcept(concept.id)
  else conceptStore.addConceptToMyConcept(concept)
}
const viewDetail = (concept) => router.push({ path: `/concept/${concept.id}`, query: { from: 'overview' } })
const isUserConcept = (id) => (conceptStore.userConcepts || []).some(c => c.id === id)

/** 概念抽屉 */
const drawerVisible = ref(false)
const editingConcept = ref(null)
const openCreate = () => { editingConcept.value = null; drawerVisible.value = true }
const openEdit = (item) => {
  const hit = (conceptStore.userConcepts || []).find(c => c.id === item.id)
  if (!hit) return
  editingConcept.value = hit
  drawerVisible.value = true
}
const onSaved = (conceptData) => {
  const existed = (conceptStore.userConcepts || []).some(c => c.id === conceptData.id)
  if (existed) conceptStore.updateUserConcept(conceptData)
  else conceptStore.addUserConcept(conceptData)
  router.push({ path: `/concept/${conceptData.id}`, query: { from: 'overview' } })
}

/** 格式化 */
const fmtPctAbs = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return `${Math.abs(n).toFixed(2)}%`
}
const chgArrow = (v) => {
  const n = Number(v)
  if (Number.isNaN(n) || n === 0) return '—'
  return n > 0 ? '↑' : '↓'
}
const chgClass = (v) => {
  const n = Number(v)
  if (Number.isNaN(n) || n === 0) return 'flat'
  return n > 0 ? 'up' : 'down'
}
const fmtMoneyY = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '--'
  const y = n / 1e8
  const sign = y > 0 ? '+' : y < 0 ? '-' : ''
  return `${sign}${Math.abs(y).toFixed(2)}亿`
}
const fmtNum = (v, d = 2) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return n.toFixed(d)
}
const fmtUpRatio = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return `${Math.round(n * 100)}%`
}
</script>

<style scoped>
/* ===== 更高级的基础视觉规范 ===== */
.concept-management{
  padding: 12px 14px;
  background: linear-gradient(180deg, #f6f8fb 0%, #f4f6f9 60%, #f3f5f8 100%);
}

.topbar{
  display:flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: stretch;
  margin-top: 8px;
}

/* 通用面板：更干净的金融产品风格 */
.panel{
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(17,24,39,.08);
  border-radius: 16px;
  box-shadow:
    0 10px 22px rgba(17,24,39,.06),
    0 1px 0 rgba(255,255,255,.7) inset;
  padding: 12px;
  display:flex;
  flex-direction: column;
  backdrop-filter: blur(8px);
}

.panel-head{
  display:flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.panel-title{
  font-weight: 950;
  color:#0f172a;
  font-size: 14px;
  display:flex;
  align-items:baseline;
  gap: 10px;
}
.panel-desc{
  font-size: 12px;
  color: rgba(100,116,139,.9);
  font-weight: 700;
}
.panel-actions{ display:flex; align-items:center; gap: 8px; }

.panel-search{ flex: 0 0 340px; }
.search-input{ width: 100%; }

/* Element 输入更圆润 */
:deep(.el-input__wrapper){
  border-radius: 12px;
}

/* 排序面板 */
.panel-metrics{ flex: 1 1 760px; min-width: 560px; }
.metrics-row{
  display:grid;
  grid-template-columns: 380px 1fr;
  gap: 14px;
  align-items:start;
}
@media (max-width: 1100px){
  .metrics-row{ grid-template-columns: 1fr; }
}

/* 左侧标题行 */
.metrics-left-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.metrics-title{
  display:flex;
  align-items:center;
  gap: 8px;
  font-weight: 950;
  color:#0f172a;
  font-size: 14px;
  line-height: 1;
}
.metrics-sub{
  font-size: 12px;
  color: rgba(100,116,139,.95);
  font-weight: 800;
  display:flex;
  align-items:center;
  gap: 8px;
}
.metrics-sub b{ color:#0f172a; font-weight: 950; }

.sub-dot{
  width: 8px; height: 8px; border-radius: 99px;
  background: rgba(148,163,184,.7);
  box-shadow: 0 0 0 3px rgba(148,163,184,.15);
}
.sub-dot.on{
  background: rgba(34,197,94,.95);
  box-shadow: 0 0 0 3px rgba(34,197,94,.18);
}

/* tooltip ? */
.help{
  width:18px; height:18px; border-radius:999px;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:950; color:#2563eb;
  border:1px solid rgba(37,99,235,.25);
  background: rgba(37,99,235,.08);
  cursor: help;
}

/* ✅ 已选择区灰色框（更像“槽位/Dropzone”） */
.selected-box{
  border: 1px dashed rgba(15,23,42,.16);
  background:
    radial-gradient(1200px 120px at 10% 0%, rgba(37,99,235,.06), transparent 50%),
    rgba(15,23,42,.02);
  border-radius: 14px;
  padding: 10px;
  min-height: 44px;
}

/* 已选拖拽 */
.selected-drag{
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.empty-hint{
  font-size: 12px;
  color: rgba(100,116,139,.9);
  font-weight: 700;
  padding: 2px 2px;
}

/* 右侧 */
.metrics-right-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.metrics-right-title{
  font-weight: 950;
  color:#0f172a;
  font-size: 12px;
  line-height: 1;
}

/* 可选 */
.chips-line{
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* chip：更精致 */
.chip{
  display:inline-flex; align-items:center; gap:8px;
  padding: 7px 12px;
  border-radius: 999px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.65);
  cursor:pointer;
  user-select:none;
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease;
}
.chip:hover{
  transform: translateY(-1px);
  border-color: rgba(37,99,235,.22);
  box-shadow: 0 10px 20px rgba(15,23,42,.08);
}
.chip.active{
  border-color: rgba(37,99,235,.26);
  background: rgba(37,99,235,.08);
}
.chip.disabled{
  opacity: .55;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}
.chip-name{
  font-size:12px;
  font-weight: 900;
  color:#0f172a;
}
.chip-x{
  font-size: 14px;
  color:#2563eb;
  font-weight: 950;
  cursor: pointer;
  line-height: 1;
}
.chip-plus{
  font-size: 12px;
  color:#16a34a;
  font-weight: 950;
}
.chip-check{
  font-size: 12px;
  color: rgba(100,116,139,.9);
  font-weight: 950;
}

/* 排名小徽标 */
.rank{
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size: 12px;
  font-weight: 950;
  color:#0f172a;
  background: rgba(15,23,42,.06);
  border: 1px solid rgba(15,23,42,.10);
}

/* 拖拽手柄 */
.handle{
  font-weight: 950;
  cursor: grab;
  padding: 0 2px;
  color: rgba(100,116,139,.95);
}

/* draggable 状态 */
.ghost{ opacity: .45; }
.chosen{
  box-shadow: 0 14px 28px rgba(15,23,42,.12);
  transform: translateY(-1px);
}
.drag{ opacity: .95; }

/* 次级操作条 */
.subbar{
  flex: 1 1 100%;
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 0;
}
.subbar-left{
  display:flex;
  align-items:center;
  gap: 10px;
}

/* 按钮更统一 */
.btn-create, .btn-save, .btn-reset{
  height: 34px;
  border-radius: 12px;
  font-weight: 900;
  padding: 0 12px;
}

/* 右侧筛选 pill：更像状态条 */
.filter-pill{
  display:flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.75);
  border: 1px solid rgba(15,23,42,.10);
  box-shadow: 0 10px 22px rgba(15,23,42,.06);
  font-size: 12px;
  min-width: 280px;
  max-width: 520px;
}
.filter-title{
  font-weight: 950;
  color: rgba(100,116,139,.95);
  flex: 0 0 auto;
}
.filter-text{
  font-weight: 900;
  color:#0f172a;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
}
.filter-link{ flex: 0 0 auto; }

/* 保存策略弹窗摘要 */
.snap-line{
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
}
.snap-tag{
  border-radius: 999px;
  font-weight: 900;
}
.snap-filter{
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  font-weight: 800;
}

/* 卡片列表 */
.grid{ margin-top: 8px; }

/* 卡片更高级 */
.concept-card{
  border-radius:16px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.92);
  padding:14px 18px 14px;
  margin-top:12px;
  box-shadow: 0 12px 26px rgba(15,23,42,.06);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.concept-card:hover{
  transform: translateY(-2px);
  border-color: rgba(37,99,235,.22);
  box-shadow: 0 18px 40px rgba(15,23,42,.10);
}

.card-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:12px; }
.title-wrap{ min-width:0; }
.title-line{ display:flex; align-items:center; gap:10px; }
.card-title{
  margin:0;
  font-size:20px;
  color:#0f172a;
  font-weight:950;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  max-width:260px;
}

.mini-tag{
  padding:3px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:950;
  color:#2563eb;
  border:1px solid rgba(37,99,235,.20);
  background: rgba(37,99,235,.08);
}
.mini-tag2{
  padding:3px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:950;
  color:#0f172a;
  border:1px solid rgba(15,23,42,.12);
  background: rgba(15,23,42,.04);
}

.sub-line{ margin-top:8px; color: rgba(100,116,139,.95); font-size:13px; font-weight: 700; }
.actions{ display:flex; align-items:center; gap:10px; }
.actions :deep(.el-button){ padding:0; height:22px; font-weight:800; }
.el-icon.selected{ color:#f59e0b; }

.metrics{
  border-top:1px dashed rgba(15,23,42,.14);
  padding-top:10px;
  display:grid;
  gap:8px;
}
.metric-row{
  display:grid;
  grid-template-columns:120px 1fr;
  align-items:center;
  gap:10px;
}
.k{ font-size:13px; color: rgba(100,116,139,.95); white-space:nowrap; font-weight: 800; }
.v{ text-align:right; white-space:nowrap; }

.chg{ display:inline-flex; align-items:baseline; gap:6px; font-weight:950; font-size:14px; }
.chg.up{ color:#ef4444; }
.chg.down{ color:#22c55e; }
.chg.flat{ color: rgba(100,116,139,.95); }

.strong{ font-size:13px; font-weight:950; color:#0f172a; }
.up{ color:#ef4444; }
.down{ color:#22c55e; }

/* 筛选 */
.filter-form{ display:flex; flex-direction:column; gap:12px; }
.f-grid{ display:flex; flex-direction:column; gap: 14px; }
.f-item{ display:flex; flex-direction:column; gap: 8px; }
.f-label{ font-size:12px; font-weight:950; color:#0f172a; }
.f-ctrl{ display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
.to{ color: rgba(100,116,139,.95); font-weight: 950; }

.f-actions{
  margin-top: 10px;
  display:flex;
  justify-content:flex-end;
  gap:10px;
}
</style>
