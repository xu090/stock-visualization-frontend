<template>
  <div class="panel-card analysis-panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">概念联动结构分析</div>
        <div class="panel-subtitle">先观察概念当日走势，再对比成分股与概念指数的同步和分化。</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-k">概念趋势</div>
        <div class="summary-v">
          {{ conceptDirectionLabel }}
          <el-tag size="small" effect="plain" :type="analysisPayload.conceptMaPattern.type">
            {{ analysisPayload.conceptMaPattern.label }}
          </el-tag>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-k">强联动个股</div>
        <div class="summary-v">{{ strongPositiveCount }} 只</div>
      </div>
      <div class="summary-card">
        <div class="summary-k">低相关个股</div>
        <div class="summary-v">{{ lowCorrelationCount }} 只</div>
      </div>
    </div>

    <div class="chart-row dual-ma-row">
      <div class="chart-card">
        <div class="mini-title">概念走势与均线</div>
        <div ref="conceptTrendChartRef" class="chart trend-chart"></div>
      </div>
      <div class="chart-card">
        <div class="mini-head">
          <div>
            <div class="mini-title">概念与成分股当日对比</div>
          </div>
        </div>
        <div ref="stockMaChartRef" class="chart stock-ma-chart"></div>
        <div class="compare-picker">
          <div class="compare-picker-head">
            <span class="compare-picker-title">比较对象</span>
            <el-select
              v-model="searchCompareCode"
              size="small"
              filterable
              clearable
              placeholder="搜索成分股添加"
              style="width: 190px"
              @change="addCompareCode"
            >
              <el-option
                v-for="item in availableCompareStocks"
                :key="item.code"
                :label="`${item.name} ${item.code}`"
                :value="item.code"
              />
            </el-select>
          </div>

          <div v-if="selectedCompareStocks.length" class="candidate-row selected-compare-row">
            <span class="candidate-label">已选择</span>
            <button
              v-for="(item, index) in selectedCompareStocks"
              :key="`chosen-${item.code}`"
              type="button"
              class="selected-chip"
              @click="removeCompareCode(item.code)"
            >
              <span class="chip-swatch" :style="{ background: compareColors[index % compareColors.length] }"></span>
              <span>{{ item.name }}</span>
              <b>{{ formatChartValue(item.close ?? item.price) }}</b>
              <em :class="{ up: Number(item.change ?? item.recentChangePct) > 0, down: Number(item.change ?? item.recentChangePct) < 0 }">
                {{ formatPct(item.change ?? item.recentChangePct) }}
              </em>
              <span class="chip-remove">×</span>
            </button>
          </div>

          <div v-if="recommendedCompareStocks.length" class="recommend-row">
            <span class="candidate-label">推荐对比</span>
            <button type="button" class="recommend-nav" @click="scrollRecommend(-1)">‹</button>
            <div ref="recommendScrollRef" class="recommend-scroll">
              <button
                v-for="item in recommendedCompareStocks"
                :key="`recommend-${item.code}`"
              type="button"
              class="stock-chip"
              @click="addCompareCode(item.code)"
              >
                <span>{{ item.name }}</span>
                <b>{{ formatChartValue(item.close ?? item.price) }}</b>
                <em :class="{ up: Number(item.change ?? item.recentChangePct) > 0, down: Number(item.change ?? item.recentChangePct) < 0 }">
                  {{ formatPct(item.change ?? item.recentChangePct) }}
                </em>
              </button>
            </div>
            <button type="button" class="recommend-nav" @click="scrollRecommend(1)">›</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, defineProps } from 'vue'
import * as echarts from 'echarts'
import { buildConceptAnalysisPayload } from '@/utils/conceptAnalysis'
import { useStockStore } from '@/stores/stock'
import { useConceptDetailStore } from '@/stores/conceptDetail'
import { apiGet } from '@/utils/api'

const INTRADAY_TTL_MS = 5 * 60 * 1000
const intradayCache = new Map()
const intradayInflight = new Map()

function isIntradayFresh(row) {
  return row && Date.now() - row.fetchedAt < INTRADAY_TTL_MS
}

function getIntradayCached(key) {
  const cached = intradayCache.get(key)
  return isIntradayFresh(cached) ? cached.data : null
}

function setIntradayCached(key, data) {
  intradayCache.set(key, { data, fetchedAt: Date.now() })
  return data
}

function intradayInflightOnce(key, factory) {
  const cached = getIntradayCached(key)
  if (cached) return Promise.resolve(cached)
  if (intradayInflight.has(key)) return intradayInflight.get(key)
  const promise = Promise.resolve()
    .then(factory)
    .then(data => setIntradayCached(key, data))
    .finally(() => intradayInflight.delete(key))
  intradayInflight.set(key, promise)
  return promise
}

const props = defineProps({
  concept: { type: Object, default: null },
  stocks: { type: Array, default: () => [] },
  analysisData: { type: Object, default: null },
  analysisWindow: { type: Number, default: 30 }
})

const stockStore = useStockStore()
const conceptDetailStore = useConceptDetailStore()
const selectedCompareCodes = ref([])
const searchCompareCode = ref('')
const recommendScrollRef = ref(null)
const intradayCompareData = ref({ concept: null, stocks: {} })
let intradayRequestSeq = 0
let refreshFrame = 0

const analysisPayload = computed(() => buildConceptAnalysisPayload(props.concept, props.stocks, {
  days: props.analysisWindow,
  analysisData: props.analysisData
}))

const conceptDirectionLabel = computed(() => {
  if (analysisPayload.value.conceptDirection === 'up') return '上涨趋势'
  if (analysisPayload.value.conceptDirection === 'down') return '下跌趋势'
  return '震荡整理'
})

const strongPositiveCount = computed(() => analysisPayload.value.stocks.filter(item => Number(item.correlation) >= 0.6).length)
const lowCorrelationCount = computed(() => analysisPayload.value.stocks.filter(item => Number(item.correlation) < 0.2).length)
const conceptKlineName = computed(() => analysisPayload.value.name || props.concept?.name || '概念K线')
const conceptMaWindows = [4, 8, 12, 16, 20]
const conceptMaColors = {
  main: '#00c853',
  MA4: '#dc2626',
  MA8: '#eab308',
  MA12: '#52c41a',
  MA16: '#1d4ed8',
  MA20: '#9333ea',
}

function toChartNum(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function calcConceptMA(values, windowSize) {
  return values.map((_, index) => {
    if (index + 1 < windowSize) return null
    const slice = values.slice(index + 1 - windowSize, index + 1)
    if (slice.some(item => item == null)) return null
    const total = slice.reduce((sum, item) => sum + item, 0)
    return Number((total / windowSize).toFixed(3))
  })
}

function formatAxisDate(value) {
  if (!value) return ''
  const text = String(value)
  const match = text.match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0].slice(5) : text
}

function formatTooltipDate(value) {
  if (!value) return ''
  const text = String(value)
  const match = text.match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : text
}

function formatChartValue(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return num.toFixed(3).replace(/\.?0+$/, '')
}

function formatPct(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
}

function getCandleTooltipValues(item) {
  const raw = Array.isArray(item?.data) ? item.data : Array.isArray(item?.value) ? item.value : []
  if (raw.length >= 5) return raw.slice(-4)
  return raw
}

const stockByCode = computed(() => new Map((analysisPayload.value.stocks || []).map(item => [item.code, item])))

function uniqStocks(rows, limit = 4) {
  const seen = new Set()
  const output = []
  ;(rows || []).forEach(item => {
    if (!item?.code || seen.has(item.code)) return
    seen.add(item.code)
    output.push(item)
  })
  return output.slice(0, limit)
}

const favoriteCompareStocks = computed(() => uniqStocks(
  (stockStore.myStockCodes || [])
    .map(code => stockByCode.value.get(code))
    .filter(Boolean),
  5
))

const leaderCompareStocks = computed(() => uniqStocks(
  (analysisPayload.value.stocks || [])
    .filter(item => item.roleLabel === '领涨股' || Number(item.change ?? item.recentChangePct) > 0)
    .sort((a, b) => Number(b.change ?? b.recentChangePct ?? 0) - Number(a.change ?? a.recentChangePct ?? 0)),
  5
))

const similarCompareStocks = computed(() => uniqStocks(
  (analysisPayload.value.stocks || [])
    .filter(item => Number(item.correlation) > 0.1)
    .slice()
    .sort((a, b) => Number(b.correlation || 0) - Number(a.correlation || 0)),
  5
))

const selectedCompareSet = computed(() => new Set(selectedCompareCodes.value))

const recommendedCompareStocks = computed(() => uniqStocks([
  ...favoriteCompareStocks.value,
  ...leaderCompareStocks.value,
  ...similarCompareStocks.value,
], 12).filter(item => !selectedCompareSet.value.has(item.code)))

const defaultCompareCodes = computed(() => uniqStocks([
  ...leaderCompareStocks.value,
], 1).map(item => item.code))

const availableCompareStocks = computed(() => {
  const selected = new Set(selectedCompareCodes.value)
  return (analysisPayload.value.stocks || []).filter(item => !selected.has(item.code))
})

const selectedCompareStocks = computed(() => selectedCompareCodes.value
  .map(code => stockByCode.value.get(code))
  .filter(Boolean)
)

const compareColors = ['#ec008c', '#2aa6b0', '#9473c6', '#2563eb', '#f97316', '#14b8a6']

function getKlineCloseValues(row = {}) {
  return (row.data || []).map(item => Array.isArray(item) ? toChartNum(item[1]) : null)
}

function buildChangeSeries(values = []) {
  const base = values.find(value => value != null && value > 0)
  return values.map(value => {
    if (value == null || !base) return null
    return Number((((value - base) / base) * 100).toFixed(2))
  })
}

function latestValid(values = []) {
  return [...values].reverse().find(value => value != null)
}

const intradaySeriesList = computed(() => {
  const conceptRow = intradayCompareData.value.concept || {}
  const conceptClose = getKlineCloseValues(conceptRow)
  const conceptSeries = {
    code: 'concept-index',
    name: analysisPayload.value.name || props.concept?.name || '概念',
    color: '#2563eb',
    times: conceptRow.times || [],
    prices: conceptClose,
    changes: buildChangeSeries(conceptClose),
    currentPrice: latestValid(conceptClose),
    currentChange: latestValid(buildChangeSeries(conceptClose)),
    lineWidth: 1.8,
    z: 5,
  }

  const stockSeries = selectedCompareStocks.value.map((stock, index) => {
    const row = intradayCompareData.value.stocks?.[stock.code] || {}
    const close = getKlineCloseValues(row)
    const changes = buildChangeSeries(close)
    return {
      code: stock.code,
      name: stock.name,
      color: compareColors[index % compareColors.length],
      times: row.times || [],
      prices: close,
      changes,
      currentPrice: toChartNum(stock.price ?? stock.close) ?? latestValid(close),
      currentChange: toChartNum(stock.change ?? stock.changePercent) ?? latestValid(changes),
      lineWidth: 1.6,
      z: 4,
    }
  })

  return [conceptSeries, ...stockSeries]
})

const intradayTimes = computed(() => {
  const first = intradaySeriesList.value.find(item => item.times.length)
  return first?.times || []
})

function alignSeriesToTimes(series, times) {
  const map = new Map((series.times || []).map((time, index) => [time, series.changes[index]]))
  return times.map(time => map.has(time) ? map.get(time) : null)
}

function formatChartAxisValue(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return num.toFixed(2)
}

function addCompareCode(code) {
  const value = String(code || '')
  if (value && !selectedCompareCodes.value.includes(value)) {
    selectedCompareCodes.value = [...selectedCompareCodes.value, value].slice(0, 6)
  }
  searchCompareCode.value = ''
}

function scrollRecommend(direction) {
  const el = recommendScrollRef.value
  if (!el) return
  el.scrollBy({ left: direction * 260, behavior: 'smooth' })
}

function removeCompareCode(code) {
  selectedCompareCodes.value = selectedCompareCodes.value.filter(item => item !== code)
}

const conceptLineSeries = computed(() => {
  const source = analysisPayload.value.conceptSeries
  const close = (source.close || []).map(toChartNum)
  return conceptMaWindows.map(days => {
    const name = `MA${days}`
    const key = `ma${days}`
    const serverData = Array.isArray(source[key]) ? source[key].map(toChartNum) : []
    return {
      name,
      data: serverData.length === close.length ? serverData : calcConceptMA(close, days),
      color: conceptMaColors[name],
      width: 1.4
    }
  })
})

const conceptCandleSeries = computed(() => {
  const source = analysisPayload.value.conceptSeries
  const open = source.open || []
  const close = source.close || []
  const low = source.low || []
  const high = source.high || []
  return (source.dates || []).map((_, index) => {
    const closeValue = toChartNum(close[index])
    const openValue = toChartNum(open[index]) ?? closeValue
    const lowValue = toChartNum(low[index]) ?? Math.min(openValue ?? 0, closeValue ?? 0)
    const highValue = toChartNum(high[index]) ?? Math.max(openValue ?? 0, closeValue ?? 0)
    if (openValue == null || closeValue == null || lowValue == null || highValue == null) return null
    return [openValue, closeValue, lowValue, highValue]
  })
})

const conceptTrendChartRef = ref(null)
const stockMaChartRef = ref(null)
let conceptTrendChart = null
let stockMaChart = null

const initConceptTrendChart = () => {
  if (!conceptTrendChartRef.value) return
  if (!conceptTrendChart || conceptTrendChart.isDisposed?.()) {
    conceptTrendChart = echarts.init(conceptTrendChartRef.value)
  }

  conceptTrendChart.setOption({
    animation: false,
    color: [conceptMaColors.main, ...conceptLineSeries.value.map(item => item.color)],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        snap: true,
        lineStyle: { color: '#c5ccd6', type: 'dashed' },
        crossStyle: { color: '#c5ccd6', type: 'dashed' },
        label: { backgroundColor: 'rgba(64, 64, 64, .85)' }
      },
      borderWidth: 0,
      padding: [10, 12],
      backgroundColor: 'rgba(255,255,255,.96)',
      textStyle: { color: '#303133', fontSize: 12 },
      extraCssText: 'box-shadow:0 8px 24px rgba(15,23,42,.18);border-radius:4px;',
      formatter(params = []) {
        const rows = params.filter(item => item.value != null)
        const title = formatTooltipDate(rows[0]?.axisValue || params[0]?.axisValue)
        const body = rows.map(item => {
          if (item.seriesType === 'candlestick') {
            const [open, close, low, high] = getCandleTooltipValues(item)
            return `
              <div style="display:flex;align-items:center;gap:7px;line-height:22px;margin-bottom:2px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:2px solid #00c853;background:#fff;"></span>
                <span>${item.seriesName}</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(2, minmax(72px, 1fr));gap:2px 14px;line-height:21px;margin-bottom:3px;">
                <span>开盘价 <b>${formatChartValue(open)}</b></span>
                <span>收盘价 <b>${formatChartValue(close)}</b></span>
                <span>最低价 <b>${formatChartValue(low)}</b></span>
                <span>最高价 <b>${formatChartValue(high)}</b></span>
              </div>
            `
          }
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;line-height:22px;">
              <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color || '#909399'};margin-right:7px;"></span>${item.seriesName}</span>
              <b>${formatChartValue(item.value)}</b>
            </div>
          `
        }).join('')
        return `<div style="font-weight:700;margin-bottom:5px;">${title}</div>${body}`
      }
    },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: '#4b5563', fontSize: 12 },
      data: [conceptKlineName.value, ...conceptLineSeries.value.map(item => item.name)]
    },
    grid: [
      { left: 48, right: 18, top: 40, height: '68%' },
      { left: 48, right: 18, top: '86%', height: '6%' }
    ],
    xAxis: {
      type: 'category',
      data: analysisPayload.value.conceptSeries.dates,
      boundaryGap: false,
      axisTick: { show: true, lineStyle: { color: '#6b7280' } },
      axisLabel: { color: '#6b7280', formatter: formatAxisDate, hideOverlap: true },
      axisLine: { lineStyle: { color: '#6b7280' } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#6b7280' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eef2f7' } }
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 18,
        bottom: 2,
        start: 0,
        end: 100,
        borderColor: '#d8e1ef',
        fillerColor: 'rgba(64, 128, 255, .10)',
        backgroundColor: '#f7faff',
        dataBackground: {
          lineStyle: { color: '#d6e1f1' },
          areaStyle: { color: '#edf4ff' }
        },
        selectedDataBackground: {
          lineStyle: { color: '#b8cbee' },
          areaStyle: { color: '#dce9ff' }
        },
        handleSize: '95%',
        handleStyle: { color: '#e8f0ff', borderColor: '#b8c6dc' },
        moveHandleStyle: { color: '#c9d8ee' },
        textStyle: { color: 'transparent' },
        brushSelect: false
      }
    ],
    series: [
      {
        name: conceptKlineName.value,
        type: 'candlestick',
        data: conceptCandleSeries.value,
        itemStyle: {
          color: '#ffffff',
          color0: '#ffffff',
          borderColor: '#00c853',
          borderColor0: '#ff1f1f'
        }
      },
      ...conceptLineSeries.value.map(item => ({
        name: item.name,
        type: 'line',
        smooth: true,
        symbol: 'none',
        connectNulls: true,
        data: item.data,
        color: item.color,
        itemStyle: { color: item.color },
        lineStyle: { width: item.width, color: item.color },
        emphasis: { focus: 'series' }
      }))
    ]
  }, { notMerge: true, lazyUpdate: true })
}

const initStockMaChart = () => {
  if (!stockMaChartRef.value) return
  if (!stockMaChart || stockMaChart.isDisposed?.()) {
    stockMaChart = echarts.init(stockMaChartRef.value)
  }
  const times = intradayTimes.value
  const seriesList = intradaySeriesList.value

  stockMaChart.setOption({
    animation: false,
    color: seriesList.map(item => item.color),
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        snap: true,
        lineStyle: { color: '#c5ccd6', type: 'dashed' },
        crossStyle: { color: '#c5ccd6', type: 'dashed' },
        label: { backgroundColor: 'rgba(64, 64, 64, .85)' },
      },
      borderWidth: 0,
      padding: [10, 12],
      backgroundColor: 'rgba(255,255,255,.96)',
      textStyle: { color: '#303133', fontSize: 12 },
      extraCssText: 'box-shadow:0 8px 24px rgba(15,23,42,.18);border-radius:4px;',
      formatter(params = []) {
        const time = params[0]?.axisValue || ''
        const rows = params.filter(item => item.value != null)
        const body = rows.map(item => {
          const series = seriesList.find(row => row.name === item.seriesName)
          const price = series?.prices?.[item.dataIndex]
          const changeColor = Number(item.value) >= 0 ? '#f56c6c' : '#67c23a'
          return `
            <div style="display:flex;justify-content:space-between;gap:24px;line-height:22px;">
              <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};margin-right:7px;"></span>${item.seriesName}</span>
              <b>${formatChartAxisValue(price)} / <span style="color:${changeColor};">${formatPct(item.value)}</span></b>
            </div>
          `
        }).join('')
        return `
          <div style="font-weight:700;margin-bottom:6px;">${time}</div>
          ${body}
        `
      }
    },
    legend: {
      top: 0,
      left: 0,
      type: 'scroll',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: '#4b5563', fontSize: 12 },
      data: seriesList.map(item => item.name)
    },
    grid: { left: 48, right: 18, top: 42, bottom: 28 },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: false,
      axisTick: { show: true, lineStyle: { color: '#6b7280' } },
      axisLabel: {
        color: '#6b7280',
        hideOverlap: true
      },
      axisLine: { lineStyle: { color: '#6b7280' } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#6b7280', formatter: value => `${Number(value).toFixed(1)}%` },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eef2f7' } }
    },
    series: seriesList.map(item => ({
      name: item.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      connectNulls: true,
      data: alignSeriesToTimes(item, times),
      z: item.z,
      color: item.color,
      itemStyle: { color: item.color },
      lineStyle: {
        width: item.lineWidth,
        color: item.color,
      },
      emphasis: { focus: 'series' }
    }))
  }, { notMerge: true, lazyUpdate: true })
}

async function fetchIntradayCompareData() {
  const requestId = props.concept?.id || analysisPayload.value.id
  const requestCodes = selectedCompareCodes.value.slice()
  const seq = ++intradayRequestSeq
  if (!requestId) {
    intradayCompareData.value = { concept: null, stocks: {} }
    return
  }

  const getStockKline = (code) => {
    return intradayInflightOnce(`stock:${code}:1m`, () => (
      apiGet(`/api/stocks/${encodeURIComponent(code)}/kline?period=1m`)
    ))
  }

  try {
    const [conceptRow, stockRows] = await Promise.all([
      intradayInflightOnce(`concept:${requestId}:1m`, () => (
        conceptDetailStore.fetchKline(requestId, '1m')
      )),
      Promise.all(requestCodes.map(code => (
        getStockKline(code)
          .then(row => [code, row])
          .catch(() => [code, null])
      )))
    ])
    if (seq !== intradayRequestSeq) return
    intradayCompareData.value = {
      concept: conceptRow,
      stocks: Object.fromEntries(stockRows.filter(([, row]) => row))
    }
  } catch {
    if (seq === intradayRequestSeq) intradayCompareData.value = { concept: null, stocks: {} }
  }
}

const refreshCharts = async () => {
  await nextTick()
  initConceptTrendChart()
  initStockMaChart()
  conceptTrendChart?.resize()
  stockMaChart?.resize()
}

const scheduleRefreshCharts = () => {
  if (refreshFrame) return
  refreshFrame = window.requestAnimationFrame(() => {
    refreshFrame = 0
    refreshCharts()
  })
}

watch(
  () => analysisPayload.value.stocks.map(item => item.code).join(','),
  () => {
    if (!analysisPayload.value.stocks.length) {
      selectedCompareCodes.value = []
      return
    }
    const validCodes = new Set(analysisPayload.value.stocks.map(item => item.code))
    const current = selectedCompareCodes.value.filter(code => validCodes.has(code))
    selectedCompareCodes.value = current.length ? current : defaultCompareCodes.value
    if (selectedCompareCodes.value.length > 6) {
      selectedCompareCodes.value = selectedCompareCodes.value.slice(0, 6)
    }
  },
  { immediate: true }
)

watch(
  [() => props.analysisWindow, () => selectedCompareCodes.value.join(','), () => props.concept?.id, () => props.stocks.length, () => props.analysisData],
  async () => {
    await fetchIntradayCompareData()
    scheduleRefreshCharts()
  }
)

watch(
  intradayCompareData,
  () => {
    scheduleRefreshCharts()
  }
)

const handleResize = () => {
  conceptTrendChart?.resize()
  stockMaChart?.resize()
}

onMounted(async () => {
  await fetchIntradayCompareData()
  scheduleRefreshCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (refreshFrame) {
    window.cancelAnimationFrame(refreshFrame)
    refreshFrame = 0
  }
  conceptTrendChart?.dispose()
  stockMaChart?.dispose()
})
</script>

<style scoped>
.analysis-panel { margin-top: 24px; }
.panel-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.panel-title { font-size: 15px; font-weight: 800; color: #303133; }
.panel-subtitle { margin-top: 6px; font-size: 12px; color: #909399; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.summary-card { padding: 16px; border-radius: 12px; background: linear-gradient(180deg, #f8fafc, #eef2ff); border: 1px solid rgba(99, 102, 241, 0.12); }
.summary-k { font-size: 12px; color: #6b7280; }
.summary-v { margin-top: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 18px; font-weight: 800; color: #111827; }
.chart-row { display: grid; gap: 18px; margin-top: 18px; }
.dual-ma-row { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
.chart-card { padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.18); }
.mini-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 10px; }
.mini-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.card-controls { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.mini-subtitle { margin-top: -4px; margin-bottom: 10px; font-size: 12px; color: #64748b; }
.trend-chart { height: 330px; }
.stock-ma-chart { height: 300px; }
.compare-picker { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.compare-picker-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.compare-picker-title { font-size: 13px; font-weight: 800; color: #2563eb; }
.selected-row,
.candidate-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.selected-compare-row {
  flex-wrap: nowrap;
  overflow: hidden;
}
.selected-compare-row .candidate-label { flex: 0 0 72px; }
.selected-compare-row .selected-chip {
  min-width: 0;
  max-width: none;
  flex: 0 1 auto;
  padding: 0 8px;
}
.selected-compare-row .selected-chip span:not(.chip-swatch):not(.chip-remove) {
  flex: 1 1 auto;
  min-width: 44px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-compare-row .selected-chip b,
.selected-compare-row .selected-chip em {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@container (max-width: 620px) {
  .selected-compare-row .selected-chip {
    max-width: 92px;
    flex-basis: 44px;
  }
  .selected-compare-row .selected-chip b,
  .selected-compare-row .selected-chip em {
    display: none;
  }
}
@media (max-width: 1120px) {
  .selected-compare-row .selected-chip em {
    display: none;
  }
}
@media (max-width: 920px) {
  .selected-compare-row .selected-chip b {
    display: none;
  }
}
.recommend-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.recommend-scroll {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 0 6px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}
.recommend-scroll::-webkit-scrollbar { display: none; }
.recommend-scroll .stock-chip {
  flex: 0 0 auto;
  scroll-snap-align: start;
}
.recommend-nav {
  width: 28px;
  height: 34px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(148, 163, 184, .28);
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(15, 23, 42, .08);
}
.recommend-nav:hover { border-color: rgba(37, 99, 235, .45); color: #2563eb; }
.candidate-label { flex: 0 0 72px; font-size: 12px; color: #64748b; font-weight: 700; }
.stock-chip,
.selected-chip {
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid rgba(148, 163, 184, .32);
  background: #fff;
  border-radius: 6px;
  color: #111827;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.stock-chip.active { border-color: rgba(37, 99, 235, .55); background: rgba(37, 99, 235, .07); }
.stock-chip b,
.selected-chip b { font-size: 12px; color: #111827; }
.stock-chip em,
.selected-chip em { font-style: normal; font-weight: 800; }
.selected-chip { background: #f8fafc; }
.chip-swatch { width: 10px; height: 10px; border-radius: 2px; flex: 0 0 auto; }
.chip-remove {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #64748b;
  font-size: 14px;
  line-height: 1;
}
.selected-chip:hover .chip-remove { background: rgba(15, 23, 42, .08); color: #111827; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
@media (max-width: 1280px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dual-ma-row { grid-template-columns: 1fr; }
  .mini-head { flex-direction: column; }
  .card-controls { justify-content: flex-start; }
}
@media (max-width: 768px) {
  .summary-grid { grid-template-columns: 1fr; }
}
</style>
