<template>
  <div class="panel-card table-panel">
    <div class="panel-header table-head">
      <div class="panel-title">成分股列表</div>
    </div>

    <div class="table-filter-bar">
      <el-input
        v-model="query.keyword"
        size="small"
        clearable
        placeholder="搜索股票名称/代码"
        style="width: 220px"
      />
      <el-select
        v-model="query.correlation"
        size="small"
        placeholder="相关性"
        style="width: 130px"
      >
        <el-option label="相关性全部" value="" />
        <el-option label="正相关" value="strong-positive" />
        <el-option label="弱相关" value="weak-positive" />
        <el-option label="不相关" value="neutral" />
        <el-option label="负相关" value="negative" />
      </el-select>
      <el-select
        v-model="query.direction"
        size="small"
        placeholder="涨跌方向"
        style="width: 120px"
      >
        <el-option label="涨跌全部" value="" />
        <el-option label="上涨" value="up" />
        <el-option label="下跌" value="down" />
        <el-option label="震荡" value="flat" />
      </el-select>
      <el-select
        v-model="query.maPattern"
        size="small"
        placeholder="均线形态"
        style="width: 150px"
      >
        <el-option label="均线形态全部" value="" />
        <el-option v-for="item in maPatternOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-button size="small" plain @click="resetFilters">重置筛选</el-button>
    </div>

    <el-table
      :data="sortedStocks"
      stripe
      class="stock-table"
      @row-click="goStock"
      highlight-current-row
      @sort-change="onSortChange"
      :default-sort="defaultSort"
    >
      <el-table-column prop="code" label="代码" width="92" />
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="correlation" label="相关系数" width="110" sortable="custom">
        <template #default="{ row }">{{ formatCoeff(row.correlation) }}</template>
      </el-table-column>
      <el-table-column label="相关性分类" width="118">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="row.correlationType">{{ row.correlationLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色识别" width="116">
        <template #default="{ row }">
          <el-tag size="small" effect="light" :type="roleTagType(row.roleLabel)">{{ row.roleLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="均线形态" width="124">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="row.maPatternType">{{ row.maPattern }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="走势" width="92">
        <template #default="{ row }">
          <span :class="{ up: row.trendDirection === 'up', down: row.trendDirection === 'down' }">{{ row.trendLabel }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="recentChangePct" label="近窗涨跌" width="110" sortable="custom">
        <template #default="{ row }">{{ formatPct(row.recentChangePct) }}</template>
      </el-table-column>
      <el-table-column label="收藏" width="80" align="center">
        <template #default="{ row }">
          <el-tooltip :content="isStockFavorite(row.code) ? '取消收藏' : '加入收藏'" placement="top">
            <el-icon
              :class="isStockFavorite(row.code) ? 'fav-icon on' : 'fav-icon'"
              @click.stop="toggleStockFav(row.code)"
            >
              <StarFilled v-if="isStockFavorite(row.code)" />
              <Star v-else />
            </el-icon>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="price" label="最新" width="90" sortable="custom">
        <template #default="{ row }">{{ row.price?.toFixed?.(2) ?? row.price ?? '--' }}</template>
      </el-table-column>
      <el-table-column prop="change" label="涨跌幅" width="118" sortable="custom">
        <template #default="{ row }">
          <span class="chg" :class="{ up: row.change > 0, down: row.change < 0 }">
            <span class="arrow" v-if="row.change > 0">↑</span>
            <span class="arrow" v-else-if="row.change < 0">↓</span>
            <span class="num">{{ formatPct(row.change) }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="amount" label="成交额" width="120" sortable="custom">
        <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="turnover" label="换手" width="92" sortable="custom">
        <template #default="{ row }">{{ formatTurnover(row.turnover) }}</template>
      </el-table-column>
      <el-table-column prop="mktCap" label="市值" width="120" sortable="custom">
        <template #default="{ row }">{{ formatMoney(row.mktCap) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default>
          <el-button text type="primary" size="small">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { reactive, computed, ref, defineProps } from 'vue'
import { useRouter } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { buildConceptAnalysisPayload } from '@/utils/conceptAnalysis'
import { Star, StarFilled } from '@element-plus/icons-vue'

const props = defineProps({
  concept: { type: Object, default: null },
  stocks: { type: Array, default: () => [] },
  analysisData: { type: Object, default: null },
  analysisWindow: { type: Number, default: 30 }
})

const router = useRouter()
const stockStore = useStockStore()

const query = reactive({
  keyword: '',
  correlation: '',
  direction: '',
  maPattern: ''
})

const maPatternOptions = [
  { label: '多头排列', value: 'bullish-stack' },
  { label: '空头排列', value: 'bearish-stack' },
  { label: '黄金交叉', value: 'golden-cross' },
  { label: '死亡交叉', value: 'death-cross' },
  { label: '均线缠绕', value: 'mixed' }
]

const analysisPayload = computed(() => buildConceptAnalysisPayload(props.concept, props.stocks, {
  days: props.analysisWindow,
  analysisData: props.analysisData
}))
const filteredStocks = computed(() => {
  const keyword = query.keyword.trim().toLowerCase()
  return analysisPayload.value.stocks.filter(item => {
    if (keyword) {
      const text = `${item.name || ''} ${item.code || ''}`.toLowerCase()
      if (!text.includes(keyword)) return false
    }
    if (query.correlation && item.correlationCategory !== query.correlation) return false
    if (query.direction && item.trendDirection !== query.direction) return false
    if (query.maPattern && item.maPatternKey !== query.maPattern) return false
    return true
  })
})

const sortState = ref({ prop: 'change', order: 'descending' })
const defaultSort = computed(() => ({ prop: sortState.value.prop, order: sortState.value.order }))

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
}

const sortedStocks = computed(() => {
  const list = filteredStocks.value.slice()
  const { prop, order } = sortState.value
  if (!prop || !order) return list
  const dir = order === 'ascending' ? 1 : -1
  list.sort((a, b) => {
    const av = toNum(a?.[prop])
    const bv = toNum(b?.[prop])
    if (av === bv) return 0
    return (av > bv ? 1 : -1) * dir
  })
  return list
})

function onSortChange({ prop, order }) {
  sortState.value = { prop, order }
}

function resetFilters() {
  query.keyword = ''
  query.correlation = ''
  query.direction = ''
  query.maPattern = ''
}

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH|BJ)$/i, '')
  s = s.replace(/^(sz|sh|bj)/i, '')
  return s
}

function goStock(row) {
  const code = normalizeCode(row?.code)
  if (!code) return
  router.push(`/stock/${code}`)
}

const isStockFavorite = code => stockStore.isStockFavorite(code)
const toggleStockFav = code => {
  if (isStockFavorite(code)) stockStore.removeStockFromMyStocks(code)
  else stockStore.addStockToMyStocks(code)
}

function formatPct(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function formatTurnover(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '--'
  return `${n.toFixed(1)}%`
}

function formatCoeff(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '--'
  return n.toFixed(3)
}

function formatMoney(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '--'
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}万`
  return `${sign}${abs.toFixed(0)}`
}

function roleTagType(role) {
  if (role === '核心联动股') return 'danger'
  if (role === '领涨股') return 'warning'
  if (role === '背离股') return 'success'
  return 'info'
}
</script>

<style scoped>
.table-panel { margin-top: 24px; }
.table-head { margin-bottom: 12px; }
.panel-title { font-size: 15px; font-weight: 800; color: #303133; }
.table-filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.stock-table :deep(.el-table__row) { cursor: pointer; }
.stock-table :deep(.el-table__row:hover td) { background: #f5f8ff !important; }
.chg { display: inline-flex; align-items: center; gap: 6px; font-weight: 900; }
.chg .arrow { font-size: 14px; line-height: 1; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
.fav-icon { font-size: 18px; color: #c0c4cc; cursor: pointer; transition: transform .15s ease, color .15s ease; }
.fav-icon.on { color: #f59e0b; }
.fav-icon:hover { transform: translateY(-1px); color: #f59e0b; }
</style>
