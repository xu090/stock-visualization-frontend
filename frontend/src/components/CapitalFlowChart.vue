<template>
  <div class="capital-flow-chart">
    <div v-if="summaryItems.length" class="flow-summary">
      <div v-for="item in summaryItems" :key="item.label" class="flow-pill">
        <span class="flow-pill-label">{{ item.label }}</span>
        <span class="flow-pill-value" :class="item.tone">{{ item.value }}</span>
      </div>
    </div>
    <div ref="chartRef" class="flow-canvas"></div>
    <div v-if="!hasData" class="flow-empty">{{ emptyText }}</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  fallbackSeries: { type: Object, default: () => ({}) },
  emptyText: { type: String, default: '暂无资金流向数据' },
})

const chartRef = ref(null)
let chart = null

function toFinite(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function buildFallbackFlow(series = {}) {
  const times = Array.isArray(series?.times) ? series.times : []
  const klineData = Array.isArray(series?.data) ? series.data : []
  const amounts = Array.isArray(series?.amounts) ? series.amounts : []
  const volumes = Array.isArray(series?.volumes) ? series.volumes : []

  const inflow = []
  const outflow = []
  const netInflow = []

  for (let index = 0; index < times.length; index += 1) {
    const candle = Array.isArray(klineData[index]) ? klineData[index] : []
    const open = toFinite(candle[0], NaN)
    const close = toFinite(candle[1], NaN)
    const low = toFinite(candle[2], NaN)
    const high = toFinite(candle[3], NaN)
    const spread = Math.max(Math.abs(high - low), 0.001)
    const bias = Number.isFinite(open) && Number.isFinite(close) ? Math.max(-1, Math.min(1, (close - open) / spread)) : 0

    const explicitAmount = toFinite(amounts[index], NaN)
    const fallbackAmount = toFinite(volumes[index], 0) * Math.max(toFinite((open + close) / 2, 0), 0)
    const amount = Number.isFinite(explicitAmount) && explicitAmount > 0 ? explicitAmount : fallbackAmount

    const buyAmount = amount * (0.5 + bias / 2)
    const sellAmount = amount - buyAmount

    inflow.push(Number(buyAmount.toFixed(2)))
    outflow.push(Number(sellAmount.toFixed(2)))
    netInflow.push(Number((buyAmount - sellAmount).toFixed(2)))
  }

  return { times, inflow, outflow, netInflow }
}

const normalizedFlow = computed(() => {
  const direct = {
    times: Array.isArray(props.data?.times) ? props.data.times : [],
    inflow: Array.isArray(props.data?.inflow) ? props.data.inflow : [],
    outflow: Array.isArray(props.data?.outflow) ? props.data.outflow : [],
    netInflow: Array.isArray(props.data?.netInflow) ? props.data.netInflow : [],
  }
  if (direct.times.length && (direct.inflow.length || direct.outflow.length || direct.netInflow.length)) {
    return direct
  }
  return buildFallbackFlow(props.fallbackSeries)
})

const times = computed(() => normalizedFlow.value.times)
const inflow = computed(() => normalizedFlow.value.inflow)
const outflow = computed(() => normalizedFlow.value.outflow)
const netInflow = computed(() => normalizedFlow.value.netInflow)
const hasData = computed(() => times.value.length > 0 && (inflow.value.length > 0 || outflow.value.length > 0 || netInflow.value.length > 0))

const cumulativeNet = computed(() => {
  let total = 0
  return netInflow.value.map(value => {
    const num = Number(value)
    total += Number.isFinite(num) ? num : 0
    return Number(total.toFixed(2))
  })
})

function formatMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  const sign = num > 0 ? '+' : num < 0 ? '-' : ''
  const abs = Math.abs(num)
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)}万`
  return `${sign}${abs.toFixed(0)}`
}

function toneOf(value) {
  const num = Number(value)
  if (num > 0) return 'up'
  if (num < 0) return 'down'
  return 'flat'
}

const summaryItems = computed(() => {
  if (!hasData.value) return []
  const lastNet = netInflow.value.at(-1)
  const peakInflow = inflow.value.reduce((max, value) => {
    const num = Number(value)
    return Number.isFinite(num) ? Math.max(max, num) : max
  }, Number.NEGATIVE_INFINITY)
  const peakOutflow = outflow.value.reduce((max, value) => {
    const num = Number(value)
    return Number.isFinite(num) ? Math.max(max, num) : max
  }, Number.NEGATIVE_INFINITY)
  const lastCumulative = cumulativeNet.value.at(-1)
  return [
    { label: '最新净流入', value: formatMoney(lastNet), tone: toneOf(lastNet) },
    { label: '累计净额', value: formatMoney(lastCumulative), tone: toneOf(lastCumulative) },
    { label: '峰值流入', value: formatMoney(peakInflow), tone: 'up' },
    { label: '峰值流出', value: formatMoney(peakOutflow), tone: 'down' },
  ]
})

function buildOption() {
  return {
    color: ['#e23b3b', '#1f9d68', '#64748b', '#334155'],
    animationDuration: 220,
    tooltip: {
      trigger: 'axis',
      valueFormatter: value => formatMoney(value),
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      borderWidth: 1,
      textStyle: { color: '#1e293b' },
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: '#64748b', fontSize: 11 },
      data: ['流入', '流出', '净流入', '累计净额'],
    },
    grid: { left: 56, right: 16, top: 10, bottom: 40 },
    xAxis: {
      type: 'category',
      data: times.value,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d7dee8' } },
      axisLabel: { color: '#667085', fontSize: 10, margin: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#667085',
        fontSize: 10,
        formatter: value => formatMoney(value),
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.18)' } },
    },
    series: [
      {
        name: '流入',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.35, color: '#ef4444' },
        data: inflow.value,
      },
      {
        name: '流出',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.35, color: '#10b981' },
        data: outflow.value,
      },
      {
        name: '净流入',
        type: 'bar',
        barWidth: 8,
        barGap: '20%',
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: params => (Number(params.value) >= 0 ? '#e95a5a' : '#22a06b'),
        },
        data: netInflow.value,
      },
      {
        name: '累计净额',
        type: 'line',
        smooth: 0.2,
        symbol: 'none',
        lineStyle: { width: 1.4, type: 'dashed', color: '#475569' },
        data: cumulativeNet.value,
      },
    ],
  }
}

function renderChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  chart.setOption(buildOption(), true)
}

function resizeChart() {
  chart?.resize()
}

onMounted(async () => {
  await nextTick()
  renderChart()
  window.addEventListener('resize', resizeChart)
})

watch(() => props.data, () => {
  renderChart()
}, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.capital-flow-chart {
  position: relative;
}

.flow-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.flow-pill {
  min-width: 0;
  padding: 10px 12px 9px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.flow-pill-label {
  display: block;
  font-size: 10px;
  color: #64748b;
}

.flow-pill-value {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.flow-pill-value.up {
  color: #e23b3b;
}

.flow-pill-value.down {
  color: #1f9d68;
}

.flow-pill-value.flat {
  color: #64748b;
}

.flow-canvas {
  height: 270px;
  width: 100%;
}

.flow-empty {
  position: absolute;
  inset: 54px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  pointer-events: none;
}

@media (max-width: 960px) {
  .flow-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
