<template>
  <div class="stock-page">
    <div class="market-header">
      <div class="head-left">
        <div class="title-line">
          <div class="market-title">
            {{ stockName }}
            <span class="code">({{ stockCode }})</span>

            <el-tooltip
              :content="isFav ? '已加入自选（点击取消）' : '加入自选（点击收藏）'"
              placement="top"
              effect="dark"
            >
              <el-button class="fav-btn" text circle @click="toggleFav">
                <el-icon class="fav-icon" :class="{ on: isFav }">
                  <StarFilled v-if="isFav" />
                  <Star v-else />
                </el-icon>
              </el-button>
            </el-tooltip>
          </div>

          <div class="badges">
            <el-tag v-if="stockSafe.limitUp" type="danger" effect="plain" size="small">涨停</el-tag>
            <el-tag v-else-if="stockSafe.limitDown" type="success" effect="plain" size="small">跌停</el-tag>
            <el-tag v-else-if="Number(stockSafe.change) > 3" type="danger" effect="plain" size="small">强势</el-tag>
            <el-tag v-else-if="Number(stockSafe.change) < -3" type="success" effect="plain" size="small">回撤</el-tag>
            <el-tag v-else type="info" effect="plain" size="small">震荡</el-tag>
          </div>
        </div>

        <div class="sub-line">
          <span class="sub-item">
            所属概念：
            <span
              class="sub-strong concept-link"
              :class="{ disabled: !conceptId }"
              @click="goBackConcept"
            >
              {{ conceptName }}
            </span>
          </span>
        </div>

        <div class="overview-bar">
          <div class="ov-item">
            <span class="ov-k">最新</span>
            <span class="ov-v price">{{ formatNum(stockSafe.price, 2) }}</span>
          </div>
          <div class="ov-item">
            <span class="ov-k">振幅</span>
            <span class="ov-v">{{ formatPct(stockSafe.amplitude) }}</span>
          </div>
          <div class="ov-item">
            <span class="ov-k">市值</span>
            <span class="ov-v">{{ formatUnsignedMoney(stockSafe.mktCap) }}</span>
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
        <div class="panel-header">
          <div class="panel-title">资金流向</div>
        </div>
        <div ref="fundChartRef" class="chart chart-fund" />
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">K线走势</div>
          <el-select v-model="klinePeriod" size="small" style="width: 130px">
            <el-option label="1 分钟" value="1m" />
            <el-option label="5 分钟" value="5m" />
            <el-option label="15 分钟" value="15m" />
          </el-select>
        </div>
        <div ref="klineChartRef" class="chart chart-kline" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { useRoute, useRouter } from 'vue-router'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { useStockDetailStore } from '@/stores/stockDetail'
import { Star, StarFilled } from '@element-plus/icons-vue'

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH|BJ)$/i, '')
  s = s.replace(/^(sz|sh|bj)/i, '')
  return s
}

const route = useRoute()
const router = useRouter()
const conceptStore = useConceptStore()
const stockStore = useStockStore()
const stockDetailStore = useStockDetailStore()

const stockCode = computed(() => normalizeCode(route.params.code))
const routeSector = computed(() => String(route.query.sector || ''))

const conceptHit = computed(() => {
  const code = stockCode.value
  const list = conceptStore.conceptList || []
  for (const item of list) {
    if ((item.stockCodes || []).includes(code)) return item
  }
  const myList = conceptStore.myConceptList || []
  for (const item of myList) {
    if ((item.stockCodes || []).includes(code)) return item
  }
  return null
})

const conceptHintName = computed(() => conceptHit.value?.name || routeSector.value || '')
const conceptHintId = computed(() => conceptHit.value?.id || '')
const stockSafe = computed(() => {
  const detail = stockDetailStore.detailByCode[stockCode.value]
  if (detail) return detail
  const fallback = stockStore.getStockByCodeEnriched?.(stockCode.value, conceptHintName.value)
  return fallback || {}
})
const conceptName = computed(() => stockSafe.value?.concept?.name || conceptHintName.value || '--')
const conceptId = computed(() => stockSafe.value?.concept?.id || conceptHintId.value || '')
const capitalFlowKey = computed(() => `${stockCode.value}:${conceptId.value || ''}:${routeSector.value || ''}`)
const capitalFlow = computed(() => stockDetailStore.capitalFlowByKey[capitalFlowKey.value] || null)
const kline = computed(() => stockDetailStore.klineByKey[`${stockCode.value}:${klinePeriod.value}`] || null)
const stockName = computed(() => stockSafe.value.name || '未知股票')

const isFav = computed(() => stockStore.isStockFavorite(stockCode.value))

async function toggleFav() {
  const code = stockCode.value
  if (!code) return
  try {
    if (isFav.value) await stockStore.removeStockFromMyStocks(code)
    else await stockStore.addStockToMyStocks(code)
  } catch {
    // Store already shows the login prompt.
  }
}

function goBackConcept() {
  if (!conceptId.value) return
  router.push({ path: `/concept/${conceptId.value}` })
}

function formatNum(value, digits = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return n.toFixed(digits)
}

function formatPct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function formatUnsignedMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(abs / 1e4).toFixed(0)}万`
  return abs.toFixed(0)
}

function formatToYi(value, digits = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n / 1e8).toFixed(digits)}`
}

function formatVolumeWan(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  const wan = n / 1e4
  const digits = Math.abs(wan) >= 100 ? 0 : 2
  return wan.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const detailList = computed(() => {
  const stock = stockSafe.value
  const chg = stock.changeAmount
  const chgPct = stock.changePercent ?? stock.change
  const vol = stock.vol ?? stock.volume ?? null

  return [
    { label: '开盘价', value: formatNum(stock.open, 2), style: 'neutral' },
    { label: '收盘价', value: formatNum(stock.close, 2), style: 'primary' },
    { label: '最高价', value: formatNum(stock.high, 2), style: 'neutral' },
    { label: '最低价', value: formatNum(stock.low, 2), style: 'neutral' },
    { label: '昨收价', value: formatNum(stock.preClose, 2), style: 'neutral' },
    {
      label: '涨跌额',
      value: Number.isFinite(Number(chg)) ? `${Number(chg) > 0 ? '+' : ''}${Number(chg).toFixed(2)}` : '--',
      style: Number(chg) >= 0 ? 'danger' : 'success',
    },
    {
      label: '涨跌幅',
      value: formatPct(chgPct),
      style: Number(chgPct) >= 0 ? 'danger' : 'success',
    },
    { label: '成交量(万)', value: formatVolumeWan(vol), style: 'neutral' },
    { label: '成交额(亿)', value: formatToYi(stock.amount), style: 'neutral' },
  ]
})

const klinePeriod = ref('1m')
const fundChartRef = ref(null)
const klineChartRef = ref(null)
let fundChart = null
let klineChart = null

function initFundChart() {
  if (!fundChartRef.value) return
  fundChart?.dispose()
  fundChart = echarts.init(fundChartRef.value)

  fundChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 18, top: 18, bottom: 42 },
    legend: { bottom: 6, left: 'center', data: ['流入', '流出', '净流入'] },
    xAxis: { type: 'category', data: capitalFlow.value?.times || [], axisTick: { show: false } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { opacity: 0.35 } } },
    series: [
      { name: '流入', type: 'line', smooth: true, data: capitalFlow.value?.inflow || [] },
      { name: '流出', type: 'line', smooth: true, data: capitalFlow.value?.outflow || [] },
      { name: '净流入', type: 'bar', data: capitalFlow.value?.netInflow || [], barWidth: 14 },
    ],
  })
}

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
            <b>${stockName.value || '股票'}</b>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;line-height:21px;min-width:150px;">
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>开盘价</span><b>${formatNum(open, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>收盘价</span><b>${formatNum(close, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>最低价</span><b>${formatNum(low, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>最高价</span><b>${formatNum(high, 2)}</b></div>
            <div style="display:flex;justify-content:space-between;gap:24px;"><span>成交量</span><b>${formatUnsignedMoney(volumes[index])}</b></div>
          </div>
        `
      },
    },
    grid: [
      { left: 54, right: 18, top: 18, height: '56%' },
      { left: 54, right: 18, top: '70%', height: '14%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        boundaryGap: true,
        axisLine: { onZero: false },
        axisPointer: { show: true, type: 'line', lineStyle: { color: '#c5ccd6', type: 'dashed' } },
      },
      {
        type: 'category',
        data: times,
        gridIndex: 1,
        axisTick: { show: false },
        axisLabel: { show: false },
        axisPointer: { show: true, type: 'line', lineStyle: { color: '#c5ccd6', type: 'dashed' } },
      },
    ],
    yAxis: [
      { scale: true, splitLine: { lineStyle: { opacity: 0.35 } } },
      { gridIndex: 1, splitNumber: 2, splitLine: { show: false } },
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
        name: stockName.value || '股票',
        type: 'candlestick',
        data: klineData,
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        barWidth: 10,
      },
    ],
  })
}

function resizeCharts() {
  fundChart?.resize()
  klineChart?.resize()
}

async function loadPageData() {
  const code = stockCode.value
  if (!code) return
  await nextTick()
  await stockDetailStore.fetchAllForStockView(code, {
    conceptId: conceptHit.value?.id || '',
    sector: routeSector.value,
    period: klinePeriod.value,
  })
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

watch(() => stockCode.value, async () => {
  await loadPageData()
})

watch(klinePeriod, async value => {
  if (!stockCode.value) return
  await stockDetailStore.fetchKline(stockCode.value, value)
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
.stock-page { padding: 24px; background: #f6f8fb; border-radius: 14px; }
.market-header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.head-left { flex: 1 1 auto; min-width: 0; }

.title-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.market-title { display: inline-flex; align-items: center; gap: 8px; font-size: 24px; font-weight: 900; color: #111827; }
.code { font-size: 14px; font-weight: 800; color: #6b7280; }
.badges { display: inline-flex; gap: 8px; }

.sub-line { margin-top: 6px; display: flex; gap: 16px; flex-wrap: wrap; color: #6b7280; font-size: 12px; }
.sub-item { display: inline-flex; align-items: center; gap: 6px; }
.sub-strong { font-weight: 800; color: #111827; }
.concept-link{
  cursor: pointer;
  color: #2f80ed;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}
.concept-link.disabled{
  cursor: default;
  color: #9ca3af;
  text-decoration: none;
}

.fav-btn { padding: 0 !important; }
.fav-icon { font-size: 18px; color: #c0c4cc; transition: transform .15s ease, color .15s ease; }
.fav-icon.on { color: #f59e0b; }
.fav-btn:hover .fav-icon { transform: translateY(-1px); color: #f59e0b; }

.overview-bar {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 10px 12px;
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(0,0,0,.06);
  border-radius: 12px;
}
.ov-item { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #606266; }
.ov-k { color: #909399; }
.ov-v { font-weight: 900; color: #111827; }
.ov-v.price { font-size: 13px; }
.bold { font-weight: 900; }
.up { color: #f56c6c; }
.down { color: #67c23a; }

.metric-grid{ display:grid; grid-template-columns: repeat(9, 1fr); gap:18px; margin-bottom:28px; }
.metric-card{ padding:18px; border-radius:14px; text-align:center; }
.metric-label{ font-size:12px; opacity:.85; }
.metric-value{ margin-top:8px; font-size:22px; font-weight:700; }
.metric-card.primary{ background: linear-gradient(135deg, #6c7ae0, #7f60c5); color:#fff; }
.metric-card.danger{ background: linear-gradient(135deg, #ff7a7a, #ff4d79); color:#fff; }
.metric-card.success{ background: linear-gradient(135deg, #67c23a, #3fa36c); color:#fff; }
.metric-card.neutral{ background:#e9edf3; }

.panel-row { display: grid; grid-template-columns: 1.2fr 2.8fr; gap: 20px; }
.panel-card { background: #fff; border-radius: 14px; padding: 18px 18px 14px; box-shadow: 0 6px 18px rgba(0,0,0,.06); }
.panel-title { font-size: 15px; font-weight: 900; color: #303133; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.chart { width: 100%; }
.chart-fund { height: 260px; }
.chart-kline { height: 380px; }
.chart-note { margin-top: 10px; font-size: 12px; color: #909399; }

@media (max-width: 1100px) {
  .metric-grid { grid-template-columns: repeat(3, 1fr); }
  .panel-row { grid-template-columns: 1fr; }
}
</style>
