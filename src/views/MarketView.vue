<template>
  <div class="market-shell">
    <div class="market-page">
      <div class="market-view">
        <!-- Header -->
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

            <!-- 概览条 -->
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

        <!-- 9宫格 -->
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

        <!-- 图表区 -->
        <div class="panel-row">
          <div class="panel-card">
            <div class="panel-title">资金流向</div>
            <div ref="fundChartRef" class="chart chart-fund"></div>
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
<!-- 成分股列表 -->
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
                {{ row.price?.toFixed?.(2) ?? row.price ?? '--' }}
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
              <template #default="{ row }">{{ Number(row.turnover).toFixed(1) }}%</template>
            </el-table-column>

            <el-table-column prop="netInflow" label="净流入" width="120" sortable="custom">
              <template #default="{ row }">
                <span :class="{ up: row.netInflow > 0, down: row.netInflow < 0 }">
                  {{ formatMoney(row.netInflow) }}
                </span>
              </template>
            </el-table-column>

            <el-table-column prop="mainInflow" label="主力" width="120" sortable="custom">
              <template #default="{ row }">
                <span :class="{ up: row.mainInflow > 0, down: row.mainInflow < 0 }">
                  {{ formatMoney(row.mainInflow) }}
                </span>
              </template>
            </el-table-column>

            <el-table-column prop="mktCap" label="市值" width="120" sortable="custom">
              <template #default="{ row }">{{ formatMoney(row.mktCap) }}</template>
            </el-table-column>

            <el-table-column prop="pe" label="PE" width="90" sortable="custom">
              <template #default="{ row }">{{ row.pe?.toFixed?.(1) ?? row.pe ?? '--' }}</template>
            </el-table-column>

            <el-table-column prop="pb" label="PB" width="90" sortable="custom">
              <template #default="{ row }">{{ row.pb?.toFixed?.(2) ?? row.pb ?? '--' }}</template>
            </el-table-column>

            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default>
                <el-button text type="primary" size="small">详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="table-tip">
            提示：点击任意一行进入股票详情页（用于后续做个股看板/策略对比）。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import * as echarts from 'echarts'
import { Star, StarFilled } from '@element-plus/icons-vue'

const props = defineProps({
  forcedConceptId: { type: String, default: '' },
  embedded: { type: Boolean, default: false }
})
const emit = defineEmits(['closeEmbedded', 'update:forcedConceptId'])

const route = useRoute()
const router = useRouter()
const conceptStore = useConceptStore()
const stockStore = useStockStore()

/** ✅ 当前概念 id：Drawer 优先，否则路由 */
const curId = computed(() => String(props.forcedConceptId || route.params.id || ''))

/** ✅ 统一 normalize code：兼容 number / 'sh600519' / '600519.SH' */
function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH)$/i, '')
  s = s.replace(/^(sz|sh)/i, '')
  return s
}

// 添加或移除成分股收藏
const isStockFavorite = (code) => stockStore.isStockFavorite(code)

const toggleStockFav = (code) => {
  if (isStockFavorite(code)) {
    stockStore.removeStockFromMyStocks(code)
  } else {
    stockStore.addStockToMyStocks(code)
  }
}

/** ✅ 单列表：系统/自定义/自选 都能直接 getConceptById 拿到 */
const concept = computed(() => conceptStore.getConceptById?.(curId.value) || null)

const conceptName = computed(() => concept.value?.name || curId.value || '概念')
const title = computed(() => `${conceptName.value}`)

/** ✅ 成分股：兼容 stockCodes 为 string[] 或 {code}[] */
const stockCodesNormalized = computed(() => {
  const raw = concept.value?.stockCodes || []
  return (raw || [])
    .map(x => (typeof x === 'object' ? x?.code : x))
    .map(normalizeCode)
    .filter(Boolean)
})

/** ✅ 成分股行情：从 stockStore enriched 取；若 base 缺失，做兜底行 */
const stocks = computed(() => {
  const codes = stockCodesNormalized.value
  const cname = concept.value?.name || ''
  const list = stockStore.getStocksByCodesEnriched?.(codes, cname) || []

  const exists = new Set(list.map(x => normalizeCode(x.code)))
  const extra = codes
    .filter(c => !exists.has(c))
    .map(c => ({
      code: c,
      name: c,
      price: null,
      change: null,
      amount: null,
      turnover: null,
      netInflow: null,
      mainInflow: null,
      mktCap: null,
      pe: null,
      pb: null
    }))

  return [...list, ...extra]
})

/** ✅ 默认按涨跌幅降序 */
const sortState = ref({ prop: 'change', order: 'descending' })
const defaultSort = computed(() => ({ prop: sortState.value.prop, order: sortState.value.order }))

const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
}

const sortedStocks = computed(() => {
  const list = (stocks.value || []).slice()
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

const onSortChange = ({ prop, order }) => {
  sortState.value = { prop, order }
}

const goStock = (row) => {
  const code = normalizeCode(row?.code)
  if (!code) return
  router.push(`/stock/${code}`)
}

/** ✅ 收藏（单列表：favorite 字段） */
const isFav = computed(() => conceptStore.isConceptFavorite?.(curId.value) ?? false)

const toggleFav = () => {
  const c = concept.value
  if (!c) return

  // 优先走你新 store 的 toggleFavorite
  if (typeof conceptStore.toggleFavorite === 'function') {
    conceptStore.toggleFavorite(curId.value)
    return
  }

  // 兼容旧接口（你 store 也保留了）
  if (isFav.value) conceptStore.removeConceptFromMyConcept?.(curId.value)
  else conceptStore.addConceptToMyConcept?.(c)
}

/** 格式化 */
const formatPct = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}
const formatMoney = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}万`
  return `${sign}${abs.toFixed(0)}`
}

/** 概览统计 */
const stocksCount = computed(() => stocks.value.length)
const upCount = computed(() => stocks.value.filter(s => Number(s.change) > 0).length)
const downCount = computed(() => stocks.value.filter(s => Number(s.change) < 0).length)
const avgChg = computed(() => {
  const list = stocks.value.map(s => Number(s.change)).filter(n => !Number.isNaN(n))
  if (!list.length) return 0
  return list.reduce((a, b) => a + b, 0) / list.length
})
const leaderStock = computed(() => {
  const list = stocks.value.slice().filter(s => !Number.isNaN(Number(s.change)))
  if (!list.length) return null
  return list.sort((a, b) => Number(b.change) - Number(a.change))[0]
})

/** ===== 你原来的 9 宫格 & 图表（保持 mock）===== */
const klinePeriod = ref('1m')
const board = ref({
  open: 2680, close: 2700, high: 2715, low: 2668, preClose: 2688,
  change: +12, changeRate: +0.45, volume: 320, amount: 580
})
const detailList = computed(() => ([
  { label: '开盘价', value: board.value.open, style: 'neutral' },
  { label: '收盘价', value: board.value.close, style: 'primary' },
  { label: '最高价', value: board.value.high, style: 'neutral' },
  { label: '最低价', value: board.value.low, style: 'neutral' },
  { label: '昨收价', value: board.value.preClose, style: 'neutral' },
  { label: '涨跌额', value: board.value.change > 0 ? `+${board.value.change}` : board.value.change, style: board.value.change >= 0 ? 'danger' : 'success' },
  { label: '涨跌幅', value: board.value.changeRate > 0 ? `+${board.value.changeRate}%` : `${board.value.changeRate}%`, style: board.value.changeRate >= 0 ? 'danger' : 'success' },
  { label: '成交量(万)', value: board.value.volume, style: 'neutral' },
  { label: '成交额(亿)', value: board.value.amount, style: 'neutral' }
]))

const fundTimes = ['09:30', '10:00', '10:30', '11:00', '13:00', '14:00', '14:30']
const fundIn = [300, 420, 380, 460, 500, 480, 520]
const fundOut = [280, 390, 360, 430, 460, 450, 470]
const fundNet = fundIn.map((v, i) => v - fundOut[i])

const fundChartRef = ref(null)
const klineChartRef = ref(null)
let fundChart = null
let klineChart = null

const initFundChart = () => {
  if (!fundChartRef.value) return
  fundChart?.dispose()
  fundChart = echarts.init(fundChartRef.value)
  fundChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, left: 'center', data: ['流入', '流出', '净流入'] },
    grid: { left: 40, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: fundTimes },
    yAxis: { type: 'value' },
    series: [
      { name: '流入', type: 'line', smooth: true, data: fundIn },
      { name: '流出', type: 'line', smooth: true, data: fundOut },
      { name: '净流入', type: 'bar', data: fundNet }
    ]
  })
}

const initKlineChart = () => {
  if (!klineChartRef.value) return
  klineChart?.dispose()
  klineChart = echarts.init(klineChartRef.value)
  klineChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: fundTimes },
    yAxis: { scale: true },
    series: [{
      type: 'candlestick',
      data: [
        [2680, 2700, 2710, 2675],
        [2700, 2690, 2715, 2685],
        [2690, 2705, 2720, 2688],
        [2705, 2710, 2725, 2700],
        [2710, 2700, 2720, 2695],
        [2700, 2718, 2730, 2698],
        [2718, 2725, 2740, 2710]
      ]
    }]
  })
}

const refresh = async () => {
  await nextTick()
  initFundChart()
  initKlineChart()
}

/**
 * ✅ 重要修正：curId/成分股变化时先 stop 再 start，避免重复计时器叠加
 * （如果你的 stockStore.startMockTicker 内部已自动清理，可删掉 stopMockTicker 这一行）
 */
const startTickerForCurrent = () => {
  const codes = stockCodesNormalized.value
  stockStore.stopMockTicker?.()
  stockStore.startMockTicker?.(codes, 3000)
}

onMounted(() => {
  startTickerForCurrent()
  refresh()
})

watch(
  [() => curId.value, () => stockCodesNormalized.value.join(',')],
  () => {
    startTickerForCurrent()
    refresh()
  }
)

watch(klinePeriod, initKlineChart)

onBeforeUnmount(() => {
  stockStore.stopMockTicker?.()
  fundChart?.dispose()
  klineChart?.dispose()
})
</script>

<style scoped>
/* 外层 */
.market-shell{
  width:100%;
}

/* 主内容 */
.market-page{ width:100%; min-width:0; }
.market-view{
  width:100%;
  min-width:0;
  padding:24px;
  background:#f6f8fb;
  border-radius:14px;
  box-sizing:border-box;
}

/* Header */
.market-header{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
.title-wrap{ display:flex; flex-direction:column; gap:8px; }
.market-title{ display:inline-flex; align-items:center; gap:10px; font-size:24px; font-weight:800; color:#111827; }
.fav-btn{ padding:0 !important; }
.fav-icon{ font-size:18px; color:#c0c4cc; transition:transform .15s ease, color .15s ease; }
.fav-icon.on{ color:#f59e0b; }
.fav-btn:hover .fav-icon{ transform:translateY(-1px); color:#f59e0b; }

/* 概览条 */
.overview-bar{
  display:flex;
  flex-wrap:wrap;
  gap:10px 14px;
  padding:10px 12px;
  background: rgba(255,255,255,.9);
  border:1px solid rgba(0,0,0,.06);
  border-radius:12px;
}
.ov-item{ display:inline-flex; align-items:center; gap:8px; font-size:12px; color:#606266; }
.ov-k{ color:#909399; }
.ov-v{ font-weight:800; color:#303133; }
.ov-v.up{ color:#f56c6c; }
.ov-v.down{ color:#67c23a; }
.arrow{ font-weight:900; margin-right:2px; }
.ov-leader{ flex:1 1 auto; min-width:240px; }
.leader{ display:inline-flex; align-items:center; gap:8px; }
.leader-chg{ font-weight:900; }

/* 9宫格 */
.metric-grid{ display:grid; grid-template-columns: repeat(9, 1fr); gap:18px; margin-bottom:28px; }
.metric-card{ padding:18px; border-radius:14px; text-align:center; }
.metric-label{ font-size:12px; opacity:.85; }
.metric-value{ margin-top:8px; font-size:22px; font-weight:700; }
.metric-card.primary{ background: linear-gradient(135deg, #6c7ae0, #7f60c5); color:#fff; }
.metric-card.danger{ background: linear-gradient(135deg, #ff7a7a, #ff4d79); color:#fff; }
.metric-card.success{ background: linear-gradient(135deg, #67c23a, #3fa36c); color:#fff; }
.metric-card.neutral{ background:#e9edf3; }

/* 图表 */
.panel-row{ display:grid; grid-template-columns: 1.2fr 2.8fr; gap:20px; }
.panel-card{ background:#fff; border-radius:14px; padding:20px; box-shadow:0 6px 18px rgba(0,0,0,.06); }
.panel-title{ font-size:15px; font-weight:800; margin-bottom:14px; color:#303133; }
.panel-header{ display:flex; justify-content:space-between; align-items:center; }
.chart-fund{ height:240px; }
.chart-kline{ height:360px; }
.table-panel{ margin-top:24px; }

/* 表格 */
.stock-table :deep(.el-table__row){ cursor:pointer; }
.stock-table :deep(.el-table__row:hover td){ background:#f5f8ff !important; }
.chg{ display:inline-flex; align-items:center; gap:6px; font-weight:900; }
.chg .arrow{ font-size:14px; line-height:1; }
.up{ color:#f56c6c; }
.down{ color:#67c23a; }
.table-tip{ margin-top:10px; font-size:12px; color:#909399; }
/* 添加收藏按钮的样式 */
.fav-icon {
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;
}

.fav-icon.on {
  color: #f59e0b;
}

.fav-icon:hover {
  transform: translateY(-2px);
}

.table-panel .el-table-column {
  max-width: 120px;
}
/* 响应式 */
@media (max-width: 1100px){
  .metric-grid{ grid-template-columns: repeat(3, 1fr); }
  .panel-row{ grid-template-columns: 1fr; }
}
</style>