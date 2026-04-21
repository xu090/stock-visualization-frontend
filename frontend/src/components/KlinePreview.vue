<template>
  <div ref="chartRef" class="kline-preview" :style="{ height: `${height}px` }"></div>
</template>

<script setup>
/* global defineProps */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  times: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  height: { type: Number, default: 104 },
})

const chartRef = ref(null)
let chart = null
let resizeObserver = null

function renderChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)

  chart.setOption({
    animation: false,
    grid: {
      left: 8,
      right: 8,
      top: 8,
      bottom: 8,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: props.times || [],
      boundaryGap: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      scale: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'cross' },
    },
    series: [
      {
        type: 'candlestick',
        data: props.data || [],
        itemStyle: {
          color: '#ef4444',
          color0: '#22c55e',
          borderColor: '#ef4444',
          borderColor0: '#22c55e',
        },
        emphasis: {
          itemStyle: {
            borderWidth: 1,
          },
        },
      },
    ],
  })
}

onMounted(() => {
  renderChart()
  if (typeof ResizeObserver === 'function' && chartRef.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(chartRef.value)
  }
})

watch(
  () => [props.times, props.data],
  () => {
    renderChart()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.kline-preview{
  width: 100%;
}
</style>
