<template>
  <div class="concept-management">
    <div class="topbar" id="tour-topbar">
      <!-- 搜索 -->
      <div class="panel panel-search" id="tour-search">
        <div class="panel-head">
          <div class="panel-title">搜索</div>
          <div class="panel-actions">
            <el-button size="small" plain @click="clearSearch" :disabled="!searchQuery">
              清空
            </el-button>
          </div>
        </div>

        <el-input
          v-model="searchQuery"
          placeholder="输入概念名称"
          clearable
          @clear="clearSearch"
          class="search-input"
        />
      </div>

      <!-- 排序 -->
      <div class="panel panel-metrics" id="tour-metrics">
        <div class="metrics-row">
          <div class="metrics-left">
            <div class="metrics-left-head">
              <div class="metrics-title">
                排序指标
                <el-tooltip
                  effect="dark"
                  placement="top"
                  content="选 1 个：按该指标降序；选 2~3 个：Pareto非支配排序（同层级按第 1 指标微调）。"
                >
                  <span class="help">?</span>
                </el-tooltip>
              </div>
              <div class="metrics-sub">
                已选 {{ selectedMetricObjs.length }}/3
              </div>
            </div>

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
                <template #item="{ element,index }">
                  <span class="chip active" :title="`优先级 ${index + 1}`">
                    <span class="rank">{{ index + 1 }}</span>
                    <span class="handle" title="拖拽">⋮⋮</span>
                    <span class="chip-name">{{ element.label }}</span>
                    <span class="chip-x" title="移除" @click.stop="removeMetric(element.key)">×</span>
                  </span>
                </template>

                <template #footer>
                  <span v-if="selectedMetricObjs.length === 0" class="empty-hint">
                    点击右侧添加排序指标，支持拖拽调整优先级
                  </span>
                </template>
              </Draggable>
            </div>
          </div>

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
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="subbar">
        <div class="subbar-left" id="tour-actions">
          <!-- ✅ 新建概念：恢复为原来的“打开抽屉” -->
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

        <!-- ✅ 筛选摘要（包含：数值筛选 + 新闻关联筛选） -->
        <div class="filter-pill" id="tour-filter-pill">
          <span class="filter-title">筛选</span>
          <span class="filter-text" :title="summaryPillText">{{ summaryPillText }}</span>

          <el-button
            v-if="newsConceptFilterIds.length"
            link
            type="warning"
            class="filter-link"
            @click="clearNewsConceptFilter"
          >
            清空新闻关联
          </el-button>

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
<!-- 概念卡片列表（✅ 无结果提示） -->
<div class="grid-wrap" id="tour-cards">
  <el-empty
    v-if="displayList.length === 0"
    description="没有找到匹配的概念"
    class="empty"
  >
    <template #default>
      <div class="empty-actions">
        <el-button link type="primary" @click="clearSearch" :disabled="!searchQuery">
          清空搜索
        </el-button>
        <el-button link type="info" @click="clearOnlyFilters" :disabled="!hasAnyFilter">
          清空筛选
        </el-button>
        <el-button
          v-if="newsConceptFilterIds.length"
          link
          type="warning"
          @click="clearNewsConceptFilter"
        >
          清空新闻关联
        </el-button>
      </div>
    </template>
  </el-empty>

  <el-row v-else :gutter="14" class="grid" justify="start">
    <el-col
      v-for="item in displayList"
      :key="item.id"
      :xs="24"
      :sm="12"
      :md="12"
      :lg="8"
      :xl="8"
    >
        <el-card
          class="concept-card"
          shadow="never"
          :class="{ 'news-hit': isInNewsFilter(item.id) }"
        >
          <div class="card-top">
            <div class="title-wrap">
              <div class="title-line">
                <h3 class="card-title" :title="item.name">{{ item.name }}</h3>
                <span class="mini-tag" v-if="isFavorite(item.id)">自选</span>
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
</div>
    <!-- ✅ 新建概念抽屉：保持原来一致 -->
    <ConceptEditorDrawer
      v-model="drawerVisible"
      :editing="editingConcept"
      @saved="onSaved"
    />

    <el-drawer v-model="filterVisible" title="筛选" size="500px">
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

    <SaveStrategyDialog
      v-model="saveDialogVisible"
      type="select"
      title="保存策略"
      :metrics-tags="selectedMetricObjs"
      :filters-text="summaryFiltersText"
      @confirm="doSaveStrategy"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Star } from '@element-plus/icons-vue'
import Draggable from 'vuedraggable'

import ConceptEditorDrawer from '@/components/ConceptEditorDrawer.vue'
import SaveStrategyDialog from '@/components/SaveStrategyDialog.vue'

import { useConceptStore } from '@/stores/concept'
import { useStrategyStore } from '@/stores/strategy'
import { useHomeFilterStore } from '@/stores/homeFilter'
import { useNewsStore } from '@/stores/news'

import { autoStartHomeTourOnce } from '@/utils/homeTour'

const router = useRouter()
const conceptStore = useConceptStore()
const strategyStore = useStrategyStore()
const homeFilter = useHomeFilterStore()
const newsStore = useNewsStore()

onMounted(() => {
  autoStartHomeTourOnce({ router })
})

/** ✅ 新闻关联筛选（统一走 store，强制 string 化） */
if (!('newsConceptIds' in homeFilter)) homeFilter.newsConceptIds = []

const newsConceptFilterIds = computed(() => {
  const ids = homeFilter.newsConceptIds
  return Array.isArray(ids) ? ids.map(x => String(x)).filter(Boolean) : []
})

function clearNewsConceptFilter() {
  if (!newsConceptFilterIds.value.length) return
  homeFilter.newsConceptIds = []
  ElMessage.info('已清空新闻关联筛选')
}

function isInNewsFilter(id) {
  if (!newsConceptFilterIds.value.length) return false
  return newsConceptFilterIds.value.includes(String(id))
}

function conceptNameById(id) {
  if (!id) return ''
  const sid = String(id)
  const sys = conceptStore.getConceptById?.(sid) || conceptStore.getConceptById?.(id)
  if (sys?.name) return sys.name
  const fav = conceptStore.getMyConceptById?.(sid) || conceptStore.getMyConceptById?.(id)
  if (fav?.name) return fav.name
  return ''
}

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

/** 搜索 */
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

/** 排序 */
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

const clearOnlyFilters = () => {
  resetFilters()
  if ('appliedSelectStrategyId' in homeFilter) homeFilter.appliedSelectStrategyId = null
  if ('appliedTradeStrategyId' in homeFilter) homeFilter.appliedTradeStrategyId = null
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

const clearSort = () => {
  homeFilter.selectedMetrics = []
  if ('appliedSelectStrategyId' in homeFilter) homeFilter.appliedSelectStrategyId = null
  if ('appliedTradeStrategyId' in homeFilter) homeFilter.appliedTradeStrategyId = null
}

/** ✅ 全部重置 */
const resetAll = () => {
  clearSearch()
  resetFilters()
  clearSort()
  clearNewsConceptFilter()
  if ('appliedSelectStrategyId' in homeFilter) homeFilter.appliedSelectStrategyId = null
  if ('appliedTradeStrategyId' in homeFilter) homeFilter.appliedTradeStrategyId = null
  ElMessage.success('已全部重置')
}

/** ✅ 保存策略 */
const saveDialogVisible = ref(false)
const openSaveStrategy = () => { saveDialogVisible.value = true }

const doSaveStrategy = ({ name, desc }) => {
  if (typeof strategyStore.addSelectStrategyFromSnapshot !== 'function') {
    ElMessage.error('strategyStore.addSelectStrategyFromSnapshot 不存在')
    return
  }
  if (typeof homeFilter.toSnapshot !== 'function') {
    ElMessage.error('homeFilter.toSnapshot 不存在')
    return
  }

  strategyStore.addSelectStrategyFromSnapshot({
    name,
    desc,
    snapshot: homeFilter.toSnapshot()
  })
  saveDialogVisible.value = false
  ElMessage.success('策略已保存')
}

/** ✅ 总览数据：只展示系统概念 */
const baseList = computed(() => conceptStore.conceptOverviewList || [])

/** 筛选判断 */
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

/** 列表（✅ 加入新闻联动筛选） */
const displayList = computed(() => {
  const kw = (searchQuery.value || '').trim().toLowerCase()
  const f = homeFilter.filters || {}
  let list = (baseList.value || []).slice()

  if (kw) list = list.filter(c => (c.name || '').toLowerCase().includes(kw))
  list = list.filter(item => passFilters(item, f))

  if (newsConceptFilterIds.value.length) {
    const set = new Set(newsConceptFilterIds.value.map(String))
    list = list.filter(x => set.has(String(x.id)))
  }

  const metrics = selectedMetricsSafe.value.filter(Boolean).slice(0, 3)
  if (metrics.length === 1) {
    const k = metrics[0]
    list.sort((a, b) => (Number(b?.[k]) || 0) - (Number(a?.[k]) || 0))
  } else if (metrics.length >= 2) {
    list = paretoRankSort(list, metrics)
  }
  return list.slice(0, 18)
})

/** 筛选摘要 */
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

const summaryPillText = computed(() => {
  const base = summaryFiltersText.value || '无筛选条件'
  if (!newsConceptFilterIds.value.length) return base
  const names = newsConceptFilterIds.value.map(id => conceptNameById(id) || id).join('、')
  return `${base} ｜ 新闻关联：${names}`
})

/** 收藏 */
const isFavorite = (id) => conceptStore.isConceptFavorite?.(id) ?? false
const toggleFavorite = (concept) => {
  if (!concept?.id) return
  if (isFavorite(concept.id)) conceptStore.removeConceptFromMyConcept(concept.id)
  else conceptStore.addConceptToMyConcept(concept)
}

const viewDetail = (concept) => {
  if (typeof newsStore.setConceptId === 'function') newsStore.setConceptId(String(concept.id))
  router.push({ path: `/concept/${concept.id}`, query: { from: 'overview' } })
}

/** ✅ 新建概念：保持原来一致（打开抽屉 -> 保存写 store -> 跳详情） */
const drawerVisible = ref(false)
const editingConcept = ref(null)

const openCreate = () => {
  editingConcept.value = null
  drawerVisible.value = true
}

const onSaved = (conceptData) => {
  const existed = (conceptStore.userConcepts || []).some(c => String(c.id) === String(conceptData.id))
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
.concept-management{
  padding: 10px 12px;
  background: #f4f6f9;
}

.topbar{
  display:flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: stretch;
  margin-top: 8px;
}

/* 通用面板 */
.panel{
  background:#fff;
  border:1px solid rgba(0,0,0,.06);
  border-radius: 14px;
  box-shadow: 0 10px 18px rgba(0,0,0,.05);
  padding: 12px;
  display:flex;
  flex-direction: column;
  height: 80px;
}

.panel-head{
  display:flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.panel-title{
  font-weight: 900;
  color:#1f2d3d;
  font-size: 14px;
}
.panel-actions{ display:flex; align-items:center; gap: 8px; }

.panel-search{ flex: 0 0 340px; }
.search-input{ width: 100%; }

/* 排序面板 */
.panel-metrics{ flex: 1 1 760px; min-width: 560px; }
.metrics-row{
  display:grid;
  grid-template-columns: 380px 1fr;
  gap: 12px;
  align-items:start;
}
@media (max-width: 1100px){
  .metrics-row{ grid-template-columns: 1fr; }
}

.metrics-left-head{
  display:flex;
  align-items:baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.metrics-title{
  display:flex;
  align-items:center;
  gap: 8px;
  font-weight: 900;
  color:#1f2d3d;
  font-size: 14px;
  line-height: 1;
}
.metrics-sub{
  font-size: 12px;
  color:#909399;
  font-weight: 800;
}

.selected-box{
  border: 1px dashed rgba(0,0,0,.12);
  background: rgba(0,0,0,.02);
  border-radius: 12px;
  padding: 10px;
  min-height: 34px;
  width: 375px;
}

.metrics-right-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  margin-bottom: 8px;
  margin-left: 15px;
}
.metrics-right-title{
  font-weight: 900;
  color:#303133;
  font-size: 12px;
  line-height: 1;
}

.help{
  width:16px; height:16px; border-radius:999px;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:900; color:#409eff;
  border:1px solid rgba(64,158,255,.35);
  background: rgba(64,158,255,.08);
  cursor: help;
}

.selected-drag{
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.empty-hint{
  font-size: 12px;
  color:#909399;
  padding: 2px 2px;
}

.chips-line{
  display:flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-left: 20px;
}

.chip{
  display:inline-flex; align-items:center; gap:6px;
  padding: 4px 6px;
  border-radius: 999px;
  border:1px solid rgba(0,0,0,.08);
  background: rgba(0,0,0,.02);
  cursor:pointer;
  user-select:none;
  transition: all .16s ease;
}
.chip.active{
  border-color: rgba(64,158,255,.35);
  background: rgba(64,158,255,.10);
}
.chip.disabled{
  opacity: .55;
  cursor: not-allowed;
}
.chip-name{ font-size:12px; font-weight: 900; color:#303133; }
.chip-x{ font-size: 12px; color:#409eff; font-weight: 900; cursor: pointer; }
.chip-plus{ font-size: 12px; color:#67c23a; font-weight: 900; }

.handle{
  font-weight: 900;
  cursor: grab;
  padding: 0 2px;
  color:#606266;
}

.ghost{ opacity: .45; }
.chosen{ box-shadow: 0 10px 18px rgba(0,0,0,.10); }
.drag{ opacity: .9; }

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

.btn-create{ height: 34px; border-radius: 10px; font-weight: 800; padding: 0 12px; }
.btn-save{ height: 34px; border-radius: 10px; font-weight: 800; padding: 0 12px; }
.btn-reset{ height: 34px; border-radius: 10px; font-weight: 800; padding: 0 12px; }

.filter-pill{
  display:flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,.03);
  border: 1px solid rgba(0,0,0,.06);
  font-size: 12px;
  min-width: 280px;
  max-width: 980px;
}
.filter-title{ font-weight: 900; color:#606266; flex: 0 0 auto; }
.filter-text{
  font-weight: 800;
  color:#303133;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
}
.filter-link{ flex: 0 0 auto; }

/* 卡片列表 */
.grid{ margin-top: 8px; }

.concept-card{
  border-radius:14px;
  border:1px solid rgba(0,0,0,.06);
  background:#fff;
  padding:14px 18px 14px;
  margin-top:12px;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.concept-card:hover{
  transform: translateY(-2px);
  border-color: rgba(64,158,255,.22);
  box-shadow: 0 16px 34px rgba(0,0,0,.08);
}

/* ✅ 新闻关联命中：轻微强调 */
.news-hit{
  border-color: rgba(103,194,58,.28);
  box-shadow: 0 16px 34px rgba(0,0,0,.07);
}

.card-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:12px; }
.title-wrap{ min-width:0; }
.title-line{ display:flex; align-items:center; gap:10px; flex-wrap: wrap; }
.card-title{
  margin:0;
  font-size:20px;
  color:#1f2d3d;
  font-weight:900;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  max-width:260px;
}

.mini-tag{
  padding:2px 8px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  color:#409eff;
  border:1px solid rgba(64,158,255,.25);
  background: rgba(64,158,255,.08);
}

.sub-line{ margin-top:8px; color:#909399; font-size:13px; }
.actions{ display:flex; align-items:center; gap:10px; }
.actions :deep(.el-button){ padding:0; height:22px; font-weight:700; }
.el-icon.selected{ color:#f39c12; }

.metrics{ border-top:1px dashed rgba(0,0,0,.08); padding-top:10px; display:grid; gap:8px; }
.metric-row{ display:grid; grid-template-columns:120px 1fr; align-items:center; gap:10px; }
.k{ font-size:13px; color:#607d8b; white-space:nowrap; }
.v{ text-align:right; white-space:nowrap; }

.chg{ display:inline-flex; align-items:baseline; gap:6px; font-weight:900; font-size:14px; }
.chg.up{ color:#f56c6c; }
.chg.down{ color:#67c23a; }
.chg.flat{ color:#909399; }

.strong{ font-size:13px; font-weight:900; color:#303133; }
.up{ color:#f56c6c; }
.down{ color:#67c23a; }

/* 筛选 */
.filter-form{ display:flex; flex-direction:column; gap:12px; margin-left: 20px; }
.f-grid{ display:flex; flex-direction:column; gap: 14px; }
.f-item{ display:flex; flex-direction:column; gap: 8px; }
.f-label{ font-size:12px; font-weight:900; color:#303133; }
.f-ctrl{ display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
.to{ color:#909399; font-weight: 900; }

.rank{
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size: 10px;
  font-weight: 950;
  color:#0f172a;
  background: rgba(15,23,42,.06);
  border: 1px solid rgba(15,23,42,.10);
}
.f-actions{
  margin-top: 10px;
  display:flex;
  justify-content:flex-end;
  gap:10px;
}
</style>
