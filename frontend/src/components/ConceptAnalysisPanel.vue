<template>
  <div class="panel-card analysis-panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">概念均线结构分析</div>
        <div class="panel-subtitle">先观察概念指数的均线形态，再对比成分股均线的同步与分化。</div>
      </div>
      <div class="analysis-controls">
        <el-select v-model="analysisWindowModel" size="small" style="width: 110px">
          <el-option label="20日窗口" :value="20" />
          <el-option label="30日窗口" :value="30" />
          <el-option label="60日窗口" :value="60" />
        </el-select>
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
        <div class="summary-k">高同步个股</div>
        <div class="summary-v">{{ strongPositiveCount }} 只</div>
      </div>
      <div class="summary-card">
        <div class="summary-k">背离个股</div>
        <div class="summary-v">{{ divergentCount }} 只</div>
      </div>
    </div>

    <div class="chart-row dual-ma-row">
      <div class="chart-card">
        <div class="mini-title">概念指数与均线</div>
        <div ref="conceptTrendChartRef" class="chart trend-chart"></div>
      </div>
      <div class="chart-card">
        <div class="mini-head">
          <div>
            <div class="mini-title">成分股均线对比</div>
        <div class="mini-subtitle">同图展示概念 {{ stockMaLabel }} 与当前选中个股 {{ stockMaLabel }}。</div>
          </div>
          <div class="card-controls">
            <el-select v-model="selectedCompareCode" size="small" style="width: 170px">
              <el-option
                v-for="item in analysisPayload.stocks"
                :key="item.code"
                :label="`${item.name} ${item.code}`"
                :value="item.code"
              />
            </el-select>
            <el-select v-model="stockMaPeriod" size="small" style="width: 120px">
              <el-option label="MA5" value="ma5" />
              <el-option label="MA10" value="ma10" />
              <el-option label="MA20" value="ma20" />
              <el-option label="MA30" value="ma30" />
            </el-select>
          </div>
        </div>
        <div ref="stockMaChartRef" class="chart stock-ma-chart"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, defineProps, defineEmits } from 'vue'
import * as echarts from 'echarts'
import { buildConceptAnalysisPayload } from '@/utils/conceptAnalysis'

const props = defineProps({
  concept: { type: Object, default: null },
  stocks: { type: Array, default: () => [] },
  analysisData: { type: Object, default: null },
  analysisWindow: { type: Number, default: 30 }
})
const emit = defineEmits(['update:analysisWindow'])

const selectedCompareCode = ref('')
const stockMaPeriod = ref('ma10')
const analysisWindowModel = computed({
  get: () => props.analysisWindow,
  set: (value) => emit('update:analysisWindow', value)
})

const analysisPayload = computed(() => buildConceptAnalysisPayload(props.concept, props.stocks, {
  days: props.analysisWindow,
  analysisData: props.analysisData
}))

const conceptDirectionLabel = computed(() => {
  if (analysisPayload.value.conceptDirection === 'up') return '上涨趋势'
  if (analysisPayload.value.conceptDirection === 'down') return '下跌趋势'
  return '震荡整理'
})

const strongPositiveCount = computed(() => analysisPayload.value.stocks.filter(item => item.correlationCategory === 'strong-positive').length)
const divergentCount = computed(() => analysisPayload.value.stocks.filter(item => item.roleLabel === '背离股' || item.correlationCategory === 'negative').length)
const selectedCompareStock = computed(() => analysisPayload.value.stocks.find(item => item.code === selectedCompareCode.value) || analysisPayload.value.stocks[0] || null)
const stockMaLabel = computed(() => stockMaPeriod.value.toUpperCase())

const stockMaSeriesList = computed(() => {
  const conceptSeries = analysisPayload.value.conceptSeries?.[stockMaPeriod.value] || []
  const conceptFallback = analysisPayload.value.conceptSeries?.close || []
  const selected = selectedCompareStock.value
  const selectedSeries = selected?.history?.[stockMaPeriod.value] || []
  const selectedFallback = selected?.history?.close || []

  return [
    {
      code: 'concept-index',
      name: `概念${stockMaLabel.value}`,
      values: conceptSeries.map((value, i) => value ?? conceptFallback[i] ?? null),
      lineWidth: 2.8,
      opacity: 1,
      color: '#111827',
      z: 5
    },
    {
      code: selected?.code || 'selected-stock',
      name: selected ? `${selected.name}${stockMaLabel.value}` : `个股${stockMaLabel.value}`,
      values: selectedSeries.map((value, i) => value ?? selectedFallback[i] ?? null),
      lineWidth: 2.6,
      opacity: 1,
      color: '#2563eb',
      z: 4
    }
  ]
})

const conceptLineSeries = computed(() => {
  const source = analysisPayload.value.conceptSeries
  return [
    { name: '概念指数', data: source.close, color: '#22c55e', width: 2.8 },
    { name: 'MA5', data: source.ma5, color: '#dc2626', width: 1.5 },
    { name: 'MA10', data: source.ma10, color: '#eab308', width: 1.5 },
    { name: 'MA20', data: source.ma20, color: '#9333ea', width: 1.5 },
    { name: 'MA30', data: source.ma30, color: '#111827', width: 1.5 }
  ]
})

const conceptTrendChartRef = ref(null)
const stockMaChartRef = ref(null)
let conceptTrendChart = null
let stockMaChart = null

const initConceptTrendChart = () => {
  if (!conceptTrendChartRef.value) return
  conceptTrendChart?.dispose()
  conceptTrendChart = echarts.init(conceptTrendChartRef.value)

  conceptTrendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      left: 'center',
      data: conceptLineSeries.value.map(item => item.name)
    },
    grid: { left: 48, right: 18, top: 40, bottom: 28 },
    xAxis: {
      type: 'category',
      data: analysisPayload.value.conceptSeries.dates,
      boundaryGap: false,
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } }
    },
    series: conceptLineSeries.value.map(item => ({
      name: item.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: item.data,
      color: item.color,
      itemStyle: { color: item.color },
      lineStyle: { width: item.width, color: item.color }
    }))
  })
}

const initStockMaChart = () => {
  if (!stockMaChartRef.value) return
  stockMaChart?.dispose()
  stockMaChart = echarts.init(stockMaChartRef.value)

  stockMaChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      left: 'center',
      type: 'scroll',
      data: stockMaSeriesList.value.map(item => item.name)
    },
    grid: { left: 48, right: 18, top: 44, bottom: 28 },
    xAxis: {
      type: 'category',
      data: analysisPayload.value.conceptSeries.dates,
      boundaryGap: false,
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { lineStyle: { opacity: 0.22 } }
    },
    series: stockMaSeriesList.value.map(item => ({
      name: item.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: item.values,
      z: item.z,
      ...(item.color ? { color: item.color, itemStyle: { color: item.color } } : {}),
      lineStyle: {
        width: item.lineWidth,
        opacity: item.opacity,
        ...(item.color ? { color: item.color } : {})
      },
      emphasis: { focus: 'series' }
    }))
  })
}

const refreshCharts = async () => {
  await nextTick()
  initConceptTrendChart()
  initStockMaChart()
  conceptTrendChart?.resize()
  stockMaChart?.resize()
}

watch(
  () => analysisPayload.value.stocks.map(item => item.code).join(','),
  () => {
    if (!analysisPayload.value.stocks.length) {
      selectedCompareCode.value = ''
      return
    }
    if (!analysisPayload.value.stocks.some(item => item.code === selectedCompareCode.value)) {
      selectedCompareCode.value = analysisPayload.value.stocks[0].code
    }
  },
  { immediate: true }
)

watch(
  [analysisWindowModel, selectedCompareCode, stockMaPeriod, () => props.concept?.id, () => props.stocks.length, () => props.analysisData],
  () => { refreshCharts() }
)

const handleResize = () => {
  conceptTrendChart?.resize()
  stockMaChart?.resize()
}

onMounted(() => {
  refreshCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  conceptTrendChart?.dispose()
  stockMaChart?.dispose()
})
</script>

<style scoped>
.analysis-panel { margin-top: 24px; }
.panel-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.panel-title { font-size: 15px; font-weight: 800; color: #303133; }
.panel-subtitle { margin-top: 6px; font-size: 12px; color: #909399; }
.analysis-controls { display: flex; gap: 10px; flex-wrap: wrap; }
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
.trend-chart, .stock-ma-chart { height: 330px; }
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
