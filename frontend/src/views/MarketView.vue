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
              <div class="ov-item ov-leader" v-if="leaderStock">
                <span class="ov-k">领涨</span>
                <span class="ov-v leader">
                  {{ leaderStock.name }}
                  <span class="leader-chg up">↑{{ formatPct(leaderStock.change) }}</span>
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
            <CapitalFlowChart :data="capitalFlow" :fallback-series="kline" empty-text="暂无概念资金流向数据" />
          </div>

          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title">K 线走势</div>
              <el-select v-model="klinePeriod" size="small" style="width: 120px">
                <el-option label="1 分钟" value="1m" />
                <el-option label="5 分钟" value="5m" />
                <el-option label="15 分钟" value="15m" />
              </el-select>
            </div>
            <div ref="klineChartRef" class="chart chart-kline"></div>
          </div>
        </div>
        <ConceptAnalysisPanel
          :key="`analysis-panel-${curId}`"
          :concept="concept"
          :stocks="stocks"
          :analysis-data="analysisData"
          v-model:analysisWindow="analysisWindow"
        />
        <ConceptStockMergedTable
          :key="`analysis-table-${curId}`"
          :concept="concept"
          :stocks="stocks"
          :analysis-data="analysisData"
          :analysis-window="analysisWindow"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
/* global defineProps */
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { Star, StarFilled } from '@element-plus/icons-vue'
import ConceptAnalysisPanel from '@/components/ConceptAnalysisPanel.vue'
import ConceptStockMergedTable from '@/components/ConceptStockMergedTable.vue'
import CapitalFlowChart from '@/components/CapitalFlowChart.vue'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { useConceptDetailStore } from '@/stores/conceptDetail'

const props = defineProps({
  forcedConceptId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})

const route = useRoute()
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
const detailStocks = computed(() => conceptDetailStore.stocksById[curId.value] || [])

const stockCodesNormalized = computed(() => {
  const raw = concept.value?.stockCodes || []
  return (raw || [])
    .map(item => (typeof item === 'object' ? item?.code : item))
    .map(normalizeCode)
    .filter(Boolean)
})

const stocks = computed(() => {
  const codes = stockCodesNormalized.value
  const cname = concept.value?.name || ''
  const detailMap = new Map(
    detailStocks.value
      .filter(item => item?.code)
      .map(item => [normalizeCode(item.code), item])
  )

  return codes.map(code => {
    const detailRow = detailMap.get(code) || {}
    const quoteRow = stockStore.getStockByCodeEnriched?.(code, cname) || {}
    const merged = {
      ...detailRow,
      ...quoteRow,
      code,
      name: detailRow.name || quoteRow.name || code,
      concept: detailRow.concept || quoteRow.concept || cname,
      marketCode: detailRow.marketCode || quoteRow.marketCode || '',
      mktCap: detailRow.mktCap ?? quoteRow.mktCap ?? null,
      pe: detailRow.pe ?? quoteRow.pe ?? null,
      pb: detailRow.pb ?? quoteRow.pb ?? null,
      netInflow: detailRow.netInflow ?? quoteRow.netInflow ?? null,
      mainInflow: detailRow.mainInflow ?? quoteRow.mainInflow ?? null,
    }

    return merged
  })
})

const analysisWindow = ref(30)
const analysisData = ref(null)
let analysisRequestSeq = 0
const ANALYSIS_TTL_MS = 30 * 60 * 1000

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

function formatUnsignedMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  const abs = Math.abs(num)
  if (abs >= 1e8) return `${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(abs / 1e4).toFixed(0)}万`
  return abs.toFixed(0)
}

function formatLargeNum(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  const abs = Math.abs(num)
  if (abs >= 1e8) return `${(num / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(num / 1e4).toFixed(2)}万`
  return num.toFixed(0)
}

const stocksCount = computed(() => {
  if (detail.value?.stockCount != null) return detail.value.stockCount
  if (concept.value?.stockCount != null) return concept.value.stockCount
  return stockCodesNormalized.value.length
})

const countableStocks = computed(() => {
  const rows = stocks.value || []
  const codes = stockCodesNormalized.value
  if (!codes.length || rows.length !== codes.length) return []
  const withChanges = rows
    .map(item => ({
      ...item,
      changeValue: Number(item.change),
    }))
    .filter(item => item.code && Number.isFinite(item.changeValue))
  return withChanges.length === codes.length ? withChanges : []
})

function countFromStocks(direction) {
  const list = countableStocks.value
  if (!list.length) return '--'
  return list.filter(item => direction === 'up' ? item.changeValue > 0 : item.changeValue < 0).length
}

const upCount = computed(() => countFromStocks('up'))

const downCount = computed(() => countFromStocks('down'))

const leaderStock = computed(() => {
  if (detail.value?.leaderStock) return detail.value.leaderStock
  const ranked = countableStocks.value
    .map(item => ({
      code: item.code,
      name: item.name || item.code,
      change: item.changeValue,
    }))
    .sort((a, b) => b.change - a.change)
  return ranked[0] || null
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
    value: formatUnsignedMoney(board.value.volume),
    style: 'neutral',
  },
  {
    label: '成交额',
    value: formatUnsignedMoney(board.value.amount),
    style: 'neutral',
  },
]))

const klinePeriod = ref('1m')
const klineChartRef = ref(null)
let klineChart = null
let quotePollingTimer = null

function initKlineChart() {
  if (!klineChartRef.value) return
  klineChart?.dispose()
  klineChart = echarts.init(klineChartRef.value)

  const times = kline.value?.times || []
  const klineData = kline.value?.data || []
  const volumes = kline.value?.volumes || []

  klineChart.setOption({
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: 'rgba(64, 64, 64, .85)' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        snap: true,
        lineStyle: { color: '#c5ccd6', type: 'dashed' },
      },
      borderWidth: 0,
      padding: [12, 14],
      backgroundColor: 'rgba(255,255,255,.96)',
      textStyle: { color: '#303133', fontSize: 12 },
      extraCssText: 'box-shadow:0 8px 24px rgba(15,23,42,.18);border-radius:6px;',
      formatter(params = []) {
        const point = params[0] || {}
        const index = Number(point.dataIndex)
        if (!Number.isFinite(index)) return ''
        const value = Array.isArray(klineData[index]) ? klineData[index] : []
        const [open, close, low, high] = value
        return `
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${times[index] || point.axisValue || ''}</div>
          <div style="display:flex;align-items:center;gap:7px;line-height:22px;margin-bottom:2px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#67c23a;"></span>
            <b>${title.value || '概念'}</b>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;line-height:21px;min-width:150px;">
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>开盘价</span><b>${formatNum(open, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>收盘价</span><b>${formatNum(close, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>最低价</span><b>${formatNum(low, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>最高价</span><b>${formatNum(high, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>成交量</span><b>${formatLargeNum(volumes[index])}</b></div>
          </div>
        `
      },
    },
    grid: [
      { left: 50, right: 20, top: 20, height: '56%' },
      { left: 50, right: 20, top: '70%', height: '14%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        axisPointer: { show: true, type: 'line', lineStyle: { color: '#c5ccd6', type: 'dashed' } },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: times,
        axisLabel: { show: false },
        axisPointer: { show: true, type: 'line', lineStyle: { color: '#c5ccd6', type: 'dashed' } },
      },
    ],
    yAxis: [
      { scale: true },
      { gridIndex: 1, splitNumber: 2 },
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: 0,
        end: 100,
      },
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        bottom: 4,
        height: 24,
        borderColor: '#d8e3f5',
        fillerColor: 'rgba(64, 132, 255, .16)',
        backgroundColor: 'rgba(245, 248, 255, .9)',
        dataBackground: {
          lineStyle: { color: '#9dbbf7' },
          areaStyle: { color: 'rgba(64, 132, 255, .12)' },
        },
        selectedDataBackground: {
          lineStyle: { color: '#7da7f7' },
          areaStyle: { color: 'rgba(64, 132, 255, .18)' },
        },
        handleSize: '80%',
        handleStyle: { color: '#eef4ff', borderColor: '#a8bee8' },
        moveHandleStyle: { color: '#dbe8ff' },
        brushSelect: false,
      },
    ],
    series: [
      {
        name: title.value || '概念',
        type: 'candlestick',
        data: klineData,
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
      },
    ],
  })
}

function resizeCharts() {
  klineChart?.resize()
}

function stopQuotePolling() {
  if (quotePollingTimer) {
    clearInterval(quotePollingTimer)
    quotePollingTimer = null
  }
}

async function refreshMinuteSnapshot() {
  const codes = stockCodesNormalized.value
  if (!curId.value || !codes.length) return
  await stockStore.fetchQuotes(codes, { snapshotTs: detail.value?.latestTs || null })
}

async function fetchAnalysisData() {
  const requestId = curId.value
  const requestWindow = analysisWindow.value
  const requestSeq = ++analysisRequestSeq
  if (!requestId) {
    analysisData.value = null
    return null
  }
  const normalizedWindow = Math.min(Math.max(Number(requestWindow) || 30, 20), 90)
  const cacheKey = `${requestId}:${normalizedWindow}`
  const cached = conceptDetailStore.analysisByKey[cacheKey]
  if (cached) {
    analysisData.value = cached
    const fetchedAt = Number(conceptDetailStore.fetchedAtByKey[`analysis:${cacheKey}`])
    if (Number.isFinite(fetchedAt) && Date.now() - fetchedAt < ANALYSIS_TTL_MS) {
      return cached
    }
  }
  const hadPreviousForSameConcept = analysisData.value?.id && String(analysisData.value.id) === String(requestId)
  if (!hadPreviousForSameConcept) {
    analysisData.value = null
  }
  try {
    const row = await conceptDetailStore.fetchAnalysis(requestId, normalizedWindow)
    const stillCurrent =
      requestSeq === analysisRequestSeq &&
      String(curId.value) === String(requestId) &&
      Number(analysisWindow.value) === Number(requestWindow)
    if (stillCurrent) {
      analysisData.value = row
    }
    return row
  } catch {
    const stillCurrent =
      requestSeq === analysisRequestSeq &&
      String(curId.value) === String(requestId) &&
      Number(analysisWindow.value) === Number(requestWindow)
    if (stillCurrent && !hadPreviousForSameConcept) {
      analysisData.value = null
    }
    return null
  }
}

function restoreCachedAnalysis() {
  const normalizedWindow = Math.min(Math.max(Number(analysisWindow.value) || 30, 20), 90)
  const cached = conceptDetailStore.analysisByKey[`${curId.value}:${normalizedWindow}`]
  if (cached) {
    analysisData.value = cached
    return cached
  }
  if (analysisData.value?.id && String(analysisData.value.id) === String(curId.value)) {
    return analysisData.value
  }
  analysisData.value = null
  return null
}

function restartQuotePolling() {
  stopQuotePolling()
  quotePollingTimer = setInterval(() => {
    refreshMinuteSnapshot().catch(() => null)
  }, 5000)
}

async function loadPageData() {
  if (!curId.value) return
  const codes = stockCodesNormalized.value
  restoreCachedAnalysis()
  await nextTick()
  const latestDetail = await conceptDetailStore.fetchDetail(curId.value)
  const chartTasks = [
    conceptDetailStore.fetchCapitalFlow(curId.value),
    conceptDetailStore.fetchKline(curId.value, klinePeriod.value),
  ]
  await Promise.all(chartTasks)
  const quoteTask = codes.length
    ? stockStore.fetchQuotes(codes, { snapshotTs: latestDetail?.latestTs || null })
    : Promise.resolve()
  Promise.allSettled([
    conceptDetailStore.fetchStocks(curId.value),
    fetchAnalysisData(),
    quoteTask,
  ]).catch(() => null)
  restartQuotePolling()
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

watch(analysisWindow, async () => {
  await fetchAnalysisData()
})

watch(kline, () => {
  initKlineChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  stopQuotePolling()
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

.chart-kline{
  height:360px;
}

.chart-note{
  margin-top:10px;
  font-size:12px;
  color:#909399;
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

@media (max-width: 1100px){
  .metric-grid{
    grid-template-columns:repeat(3, 1fr);
  }

  .panel-row{
    grid-template-columns:1fr;
  }
}
</style>
