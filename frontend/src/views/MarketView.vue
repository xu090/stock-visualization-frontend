<template>
  <div class="market-shell">
    <div class="market-page">
      <div class="market-view">
        <div class="market-header">
          <div class="title-wrap">
            <div class="market-title">
              <span>{{ title }}</span>

              <el-tooltip
                :content="isFav ? '已加入自选（点击取消）' : '加入自选（点击收藏）'"
                placement="top"
                effect="dark"
              >
                <el-button class="fav-btn" text circle @click="toggleFav" :disabled="!concept">
                  <el-icon class="fav-icon" :class="{ on: isFav }">
                    <StarFilled v-if="isFav" />
                    <Star v-else />
                  </el-icon>
                </el-button>
              </el-tooltip>
            </div>

            <div class="overview-bar">
              <div class="ov-item">
                <span class="ov-k">成分股</span>
                <span class="ov-v">{{ stocksCount }} 支</span>
              </div>
              <div class="ov-item">
                <span class="ov-k">上涨</span>
                <span class="ov-v up">{{ upCount }}</span>
              </div>
              <div class="ov-item">
                <span class="ov-k">下跌</span>
                <span class="ov-v down">{{ downCount }}</span>
              </div>
              <div class="ov-item">
                <span class="ov-k">平均涨跌</span>
                <span class="ov-v" :class="{ up: avgChg > 0, down: avgChg < 0 }">
                  <span v-if="avgChg > 0" class="arrow">↑</span>
                  <span v-else-if="avgChg < 0" class="arrow">↓</span>
                  {{ formatPct(avgChg) }}
                </span>
              </div>
              <div class="ov-item ov-leader" v-if="leaderStock">
                <span class="ov-k">领涨</span>
                <span class="ov-v leader">
                  {{ leaderStock.name }}
                  <span class="leader-chg up">↑ {{ formatPct(leaderStock.change) }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="metric-grid">
          <div
            v-for="item in detailList"
            :key="item.label"
            class="metric-card"
            :class="item.style"
          >
            <div class="metric-label">{{ item.label }}</div>
            <div class="metric-value">{{ item.value }}</div>
          </div>
        </div>

        <div class="panel-row">
          <div class="panel-card">
            <div class="panel-title">资金流向</div>
            <div ref="fundChartRef" class="chart chart-fund"></div>
            <div v-if="capitalFlow?.derived" class="chart-note">
              基于成交额和涨跌幅推导的代理值。
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title">K 线走势</div>
              <el-select v-model="klinePeriod" size="small" style="width:120px">
                <el-option label="1 分钟" value="1m" />
                <el-option label="5 分钟" value="5m" />
                <el-option label="15 分钟" value="15m" />
              </el-select>
            </div>
            <div ref="klineChartRef" class="chart chart-kline"></div>
          </div>
        </div>


        <ConceptStockMergedTable
          :concept="concept"
          :stocks="stocks"
          :analysis-window="analysisWindow"
        />

        <div class="panel-card table-panel">
          <div class="panel-title">成分股列表</div>

          <el-table
            :data="sortedStocks"
            stripe
            class="stock-table"
            @row-click="goStock"
            highlight-current-row
            @sort-change="onSortChange"
            :default-sort="defaultSort"
          >
            <el-table-column prop="code" label="代码" />
            <el-table-column prop="name" label="名称" />
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
              <template #default="{ row }">
                {{ formatNum(row.price, 2) }}
              </template>
            </el-table-column>

            <el-table-column prop="change" label="涨跌幅" width="130" sortable="custom">
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

            <el-table-column prop="turnover" label="换手" width="120" sortable="custom">
              <template #default="{ row }">{{ formatPct(row.turnover) }}</template>
            </el-table-column>

            <el-table-column prop="mktCap" label="市值" width="120" sortable="custom">
              <template #default="{ row }">{{ formatMoney(row.mktCap) }}</template>
            </el-table-column>

            <el-table-column prop="pe" label="PE" width="90" sortable="custom">
              <template #default="{ row }">{{ formatNum(row.pe, 1) }}</template>
            </el-table-column>

            <el-table-column prop="pb" label="PB" width="90" sortable="custom">
              <template #default="{ row }">{{ formatNum(row.pb, 2) }}</template>
            </el-table-column>

            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default>
                <el-button text type="primary" size="small">详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="table-tip">
            提示：点击任意一行进入股票详情页，用于后续做个股看板和策略对比。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { Star, StarFilled } from '@element-plus/icons-vue'
import ConceptAnalysisPanel from '@/components/ConceptAnalysisPanel.vue'
import ConceptStockMergedTable from '@/components/ConceptStockMergedTable.vue'
import { buildConceptAnalysisPayload } from '@/utils/conceptAnalysis'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { useConceptDetailStore } from '@/stores/conceptDetail'

const props = defineProps({
  forcedConceptId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()
const conceptStore = useConceptStore()
const stockStore = useStockStore()
const conceptDetailStore = useConceptDetailStore()

const curId = computed(() => String(props.forcedConceptId || route.params.id || ''))

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH|BJ)$/i, '')
  s = s.replace(/^(sz|sh|bj)/i, '')
  return s
}

const concept = computed(() => conceptStore.getConceptById?.(curId.value) || null)
const title = computed(() => concept.value?.name || curId.value || '概念')
const detail = computed(() => conceptDetailStore.detailById[curId.value] || null)
const capitalFlow = computed(() => conceptDetailStore.capitalFlowById[curId.value] || null)
const kline = computed(() => conceptDetailStore.klineByKey[`${curId.value}:${klinePeriod.value}`] || null)

const stockCodesNormalized = computed(() => {
  const raw = concept.value?.stockCodes || []
  return (raw || [])
    .map(item => (typeof item === 'object' ? item?.code : item))
    .map(normalizeCode)
    .filter(Boolean)
})

const stocksFromApi = computed(() => conceptDetailStore.stocksById[curId.value] || [])
const stocks = computed(() => {
  if (stocksFromApi.value.length) return stocksFromApi.value

  const codes = stockCodesNormalized.value
  const cname = concept.value?.name || ''
  const list = stockStore.getStocksByCodesEnriched?.(codes, cname) || []
  const exists = new Set(list.map(item => normalizeCode(item.code)))
  const extra = codes
    .filter(code => !exists.has(code))
    .map(code => ({
      code,
      name: code,
      price: null,
      change: null,
      amount: null,
      turnover: null,
      netInflow: null,
      mainInflow: null,
      mktCap: null,
      pe: null,
      pb: null,
    }))

  return [...list, ...extra]
})

const analysisWindow = ref(30)
const query = reactive({
  keyword: '',
  correlation: '',
  direction: '',
  maPattern: '',
})

const analysisPayload = computed(() => buildConceptAnalysisPayload(concept.value, stocks.value, { days: analysisWindow.value }))
const filteredAnalysisStocks = computed(() => {
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
  const num = Number(value)
  return Number.isFinite(num) ? num : Number.NEGATIVE_INFINITY
}

const sortedStocks = computed(() => {
  const list = (filteredAnalysisStocks.value || []).slice()
  const { prop, order } = sortState.value
  if (!prop || !order) return list
  const direction = order === 'ascending' ? 1 : -1
  list.sort((a, b) => {
    const av = toNum(a?.[prop])
    const bv = toNum(b?.[prop])
    if (av === bv) return 0
    return (av > bv ? 1 : -1) * direction
  })
  return list
})

function onSortChange({ prop, order }) {
  sortState.value = { prop, order }
}

const isFav = computed(() => conceptStore.isConceptFavorite?.(curId.value) ?? false)
async function toggleFav() {
  const current = concept.value
  if (!current) return
  if (typeof conceptStore.toggleFavorite === 'function') {
    await conceptStore.toggleFavorite(curId.value)
    return
  }
  if (isFav.value) await conceptStore.removeConceptFromMyConcept?.(curId.value)
  else await conceptStore.addConceptToMyConcept?.(current)
}

const isStockFavorite = code => stockStore.isStockFavorite(code)
const toggleStockFav = code => {
  if (isStockFavorite(code)) stockStore.removeStockFromMyStocks(code)
  else stockStore.addStockToMyStocks(code)
}

function goStock(row) {
  const code = normalizeCode(row?.code)
  if (!code) return
  router.push({
    path: `/stock/${code}`,
    query: concept.value?.name ? { sector: concept.value.name } : {},
  })
}

function formatNum(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return num.toFixed(digits)
}

function formatPct(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
}

function formatMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  const abs = Math.abs(num)
  const sign = num > 0 ? '+' : num < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}万`
  return `${sign}${abs.toFixed(0)}`
}

const stocksCount = computed(() => {
  if (stocks.value.length) return stocks.value.length
  return detail.value?.stockCount ?? 0
})
const upCount = computed(() => {
  if (stocks.value.length) return stocks.value.filter(item => Number(item.change) > 0).length
  return detail.value?.upCount ?? 0
})
const downCount = computed(() => {
  if (stocks.value.length) return stocks.value.filter(item => Number(item.change) < 0).length
  return detail.value?.downCount ?? 0
})
const avgChg = computed(() => {
  const list = (stocks.value || []).map(item => Number(item.change)).filter(Number.isFinite)
  if (!list.length) return 0
  return list.reduce((sum, item) => sum + item, 0) / list.length
})
const leaderStock = computed(() => {
  const list = (stocks.value || []).filter(item => Number.isFinite(Number(item.change)))
  if (!list.length) return detail.value?.leaderStock || null
  return [...list].sort((a, b) => Number(b.change) - Number(a.change))[0]
})

const board = computed(() => ({
  open: detail.value?.open ?? concept.value?.open,
  close: detail.value?.close ?? concept.value?.close,
  high: detail.value?.high ?? concept.value?.high,
  low: detail.value?.low ?? concept.value?.low,
  preClose: detail.value?.preClose ?? concept.value?.preClose,
  change: detail.value?.change ?? concept.value?.changeAmount,
  changeRate: detail.value?.changeRate ?? concept.value?.change,
  volume: detail.value?.volume ?? concept.value?.volume,
  amount: detail.value?.amount ?? concept.value?.amount,
}))

const detailList = computed(() => ([
  { label: '开盘价', value: formatNum(board.value.open, 2), style: 'neutral' },
  { label: '收盘价', value: formatNum(board.value.close, 2), style: 'primary' },
  { label: '最高价', value: formatNum(board.value.high, 2), style: 'neutral' },
  { label: '最低价', value: formatNum(board.value.low, 2), style: 'neutral' },
  { label: '昨收价', value: formatNum(board.value.preClose, 2), style: 'neutral' },
  {
    label: '涨跌额',
    value: Number.isFinite(Number(board.value.change))
      ? `${Number(board.value.change) > 0 ? '+' : ''}${Number(board.value.change).toFixed(2)}`
      : '--',
    style: Number(board.value.change) >= 0 ? 'danger' : 'success',
  },
  {
    label: '涨跌幅',
    value: formatPct(board.value.changeRate),
    style: Number(board.value.changeRate) >= 0 ? 'danger' : 'success',
  },
  {
    label: '成交量',
    value: formatMoney(board.value.volume),
    style: 'neutral',
  },
  {
    label: '成交额',
    value: formatMoney(board.value.amount),
    style: 'neutral',
  },
]))

const klinePeriod = ref('1m')
const fundChartRef = ref(null)
const klineChartRef = ref(null)
let fundChart = null
let klineChart = null

function initFundChart() {
  if (!fundChartRef.value) return
  fundChart?.dispose()
  fundChart = echarts.init(fundChartRef.value)

  const times = capitalFlow.value?.times || []
  const inflow = capitalFlow.value?.inflow || []
  const outflow = capitalFlow.value?.outflow || []
  const netInflow = capitalFlow.value?.netInflow || []

  fundChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, left: 'center', data: ['流入', '流出', '净流入'] },
    grid: { left: 40, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: times },
    yAxis: { type: 'value' },
    series: [
      { name: '流入', type: 'line', smooth: true, data: inflow },
      { name: '流出', type: 'line', smooth: true, data: outflow },
      { name: '净流入', type: 'bar', data: netInflow },
    ],
  })
}

function initKlineChart() {
  if (!klineChartRef.value) return
  klineChart?.dispose()
  klineChart = echarts.init(klineChartRef.value)

  klineChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: [
      { left: 50, right: 20, top: 20, height: '62%' },
      { left: 50, right: 20, top: '76%', height: '16%' },
    ],
    xAxis: [
      { type: 'category', data: kline.value?.times || [] },
      { type: 'category', gridIndex: 1, data: kline.value?.times || [], axisLabel: { show: false } },
    ],
    yAxis: [
      { scale: true },
      { gridIndex: 1, splitNumber: 2 },
    ],
    series: [
      {
        type: 'candlestick',
        data: kline.value?.data || [],
      },
      {
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: kline.value?.volumes || [],
      },
    ],
  })
}

function resizeCharts() {
  fundChart?.resize()
  klineChart?.resize()
}

async function loadPageData() {
  if (!curId.value) return
  await nextTick()
  await conceptDetailStore.fetchAllForMarketView(curId.value, klinePeriod.value)
  initFundChart()
  initKlineChart()
  resizeCharts()
}

onMounted(async () => {
  if (!conceptStore.loaded || !conceptStore.conceptList?.length) {
    await conceptStore.ensureLoaded()
  }
  await loadPageData()
  window.addEventListener('resize', resizeCharts)
})

watch(() => curId.value, async () => {
  await loadPageData()
})

watch(klinePeriod, async value => {
  if (!curId.value) return
  await conceptDetailStore.fetchKline(curId.value, value)
  initKlineChart()
})

watch(capitalFlow, () => {
  initFundChart()
})

watch(kline, () => {
  initKlineChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  fundChart?.dispose()
  klineChart?.dispose()
})
</script>

<style scoped>
.market-shell{
  width:100%;
}

.market-page{
  width:100%;
  min-width:0;
}

.market-view{
  width:100%;
  min-width:0;
  padding:24px;
  background:#f6f8fb;
  border-radius:14px;
  box-sizing:border-box;
}

.market-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  margin-bottom:18px;
}

.title-wrap{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.market-title{
  display:inline-flex;
  align-items:center;
  gap:10px;
  font-size:24px;
  font-weight:800;
  color:#111827;
}

.fav-btn{
  padding:0 !important;
}

.fav-icon{
  font-size:18px;
  color:#c0c4cc;
  transition:transform .15s ease, color .15s ease;
  cursor:pointer;
}

.fav-icon.on{
  color:#f59e0b;
}

.fav-btn:hover .fav-icon,
.fav-icon:hover{
  transform:translateY(-1px);
  color:#f59e0b;
}

.overview-bar{
  display:flex;
  flex-wrap:wrap;
  gap:10px 14px;
  padding:10px 12px;
  background:rgba(255,255,255,.9);
  border:1px solid rgba(0,0,0,.06);
  border-radius:12px;
}

.ov-item{
  display:inline-flex;
  align-items:center;
  gap:8px;
  font-size:12px;
  color:#606266;
}

.ov-k{
  color:#909399;
}

.ov-v{
  font-weight:800;
  color:#303133;
}

.ov-v.up{
  color:#f56c6c;
}

.ov-v.down{
  color:#67c23a;
}

.arrow{
  font-weight:900;
  margin-right:2px;
}

.ov-leader{
  flex:1 1 auto;
  min-width:240px;
}

.leader{
  display:inline-flex;
  align-items:center;
  gap:8px;
}

.leader-chg{
  font-weight:900;
}

.metric-grid{
  display:grid;
  grid-template-columns:repeat(9, 1fr);
  gap:18px;
  margin-bottom:28px;
}

.metric-card{
  padding:18px;
  border-radius:14px;
  text-align:center;
}

.metric-label{
  font-size:12px;
  opacity:.85;
}

.metric-value{
  margin-top:8px;
  font-size:22px;
  font-weight:700;
}

.metric-card.primary{
  background:linear-gradient(135deg, #6c7ae0, #7f60c5);
  color:#fff;
}

.metric-card.danger{
  background:linear-gradient(135deg, #ff7a7a, #ff4d79);
  color:#fff;
}

.metric-card.success{
  background:linear-gradient(135deg, #67c23a, #3fa36c);
  color:#fff;
}

.metric-card.neutral{
  background:#e9edf3;
}

.panel-row{
  display:grid;
  grid-template-columns:1.2fr 2.8fr;
  gap:20px;
}

.panel-card{
  background:#fff;
  border-radius:14px;
  padding:20px;
  box-shadow:0 6px 18px rgba(0,0,0,.06);
}

.panel-title{
  font-size:15px;
  font-weight:800;
  margin-bottom:14px;
  color:#303133;
}

.panel-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.chart-fund{
  height:240px;
}

.chart-kline{
  height:360px;
}

.chart-note{
  margin-top:10px;
  font-size:12px;
  color:#909399;
}

.table-panel{
  margin-top:24px;
}

.stock-table :deep(.el-table__row){
  cursor:pointer;
}

.stock-table :deep(.el-table__row:hover td){
  background:#f5f8ff !important;
}

.chg{
  display:inline-flex;
  align-items:center;
  gap:6px;
  font-weight:900;
}

.chg .arrow{
  font-size:14px;
  line-height:1;
}

.up{
  color:#f56c6c;
}

.down{
  color:#67c23a;
}

.table-panel .el-table-column{
  max-width:120px;
}

.table-tip{
  margin-top:10px;
  font-size:12px;
  color:#909399;
}

@media (max-width: 1100px){
  .metric-grid{
    grid-template-columns:repeat(3, 1fr);
  }

  .panel-row{
    grid-template-columns:1fr;
  }
}
</style>
