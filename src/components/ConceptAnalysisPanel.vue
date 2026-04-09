<template>
  <div class="panel-card analysis-panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">概念联动分析</div>
        <div class="panel-subtitle">分析层与页面展示分离，后续替换真实历史数据时可直接复用计算逻辑。</div>
      </div>
      <div class="analysis-controls">
        <el-select v-model="analysisWindow" size="small" style="width: 110px">
          <el-option label="20日窗口" :value="20" />
          <el-option label="30日窗口" :value="30" />
          <el-option label="60日窗口" :value="60" />
        </el-select>
        <el-select v-model="selectedCompareCode" size="small" style="width: 160px">
          <el-option
            v-for="item in analysisPayload.stocks"
            :key="item.code"
            :label="`${item.name} ${item.code}`"
            :value="item.code"
          />
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
      <div class="summary-card">
        <div class="summary-k">当前对比</div>
        <div class="summary-v">{{ selectedCompareStockLabel }}</div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-card">
        <div class="mini-title">概念指数与成分股均线对比</div>
        <div ref="compareChartRef" class="chart compare-chart"></div>
      </div>
      <div class="chart-card">
        <div class="mini-title">相关性分类分布</div>
        <div ref="distributionChartRef" class="chart distribution-chart"></div>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        size="small"
        clearable
        placeholder="搜索股票名称/代码"
        style="width: 220px"
      />
      <el-select v-model="query.correlation" size="small" style="width: 130px">
        <el-option label="相关性全部" value="" />
        <el-option label="正相关" value="strong-positive" />
        <el-option label="弱相关" value="weak-positive" />
        <el-option label="不相关" value="neutral" />
        <el-option label="负相关" value="negative" />
      </el-select>
      <el-select v-model="query.direction" size="small" style="width: 120px">
        <el-option label="涨跌全部" value="" />
        <el-option label="上涨" value="up" />
        <el-option label="下跌" value="down" />
        <el-option label="震荡" value="flat" />
      </el-select>
      <el-select v-model="query.maPattern" size="small" style="width: 150px">
        <el-option label="均线形态全部" value="" />
        <el-option v-for="item in maPatternOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-button size="small" plain @click="resetFilters">重置筛选</el-button>
    </div>

    <div class="tag-row">
      <el-tag
        v-for="item in analysisPayload.stocks.slice(0, 6)"
        :key="item.code"
        size="small"
        effect="plain"
        :type="item.correlationType"
      >
        {{ item.name }} {{ item.roleLabel }}
      </el-tag>
    </div>

    <el-table :data="filteredStocks" stripe class="analysis-table">
      <el-table-column prop="code" label="代码" width="92" />
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column label="相关系数" width="110">
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
      <el-table-column label="近窗涨跌" width="110">
        <template #default="{ row }">{{ formatPct(row.recentChangePct) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick, defineProps } from 'vue'
import * as echarts from 'echarts'
import { buildConceptAnalysisPayload, buildConceptCompareSeries } from '@/utils/conceptAnalysis'

const props = defineProps({
  concept: { type: Object, default: null },
  stocks: { type: Array, default: () => [] }
})

const analysisWindow = ref(30)
const selectedCompareCode = ref('')
const query = reactive({ keyword: '', correlation: '', direction: '', maPattern: '' })

const maPatternOptions = [
  { label: '多头排列', value: 'bullish-stack' },
  { label: '空头排列', value: 'bearish-stack' },
  { label: '黄金交叉', value: 'golden-cross' },
  { label: '死亡交叉', value: 'death-cross' },
  { label: '均线缠绕', value: 'mixed' }
]

const analysisPayload = computed(() => buildConceptAnalysisPayload(props.concept, props.stocks, { days: analysisWindow.value }))
const compareSeries = computed(() => buildConceptCompareSeries(analysisPayload.value, selectedCompareCode.value))

const conceptDirectionLabel = computed(() => {
  if (analysisPayload.value.conceptDirection === 'up') return '上涨趋势'
  if (analysisPayload.value.conceptDirection === 'down') return '下跌趋势'
  return '震荡整理'
})
const strongPositiveCount = computed(() => analysisPayload.value.stocks.filter(item => item.correlationCategory === 'strong-positive').length)
const divergentCount = computed(() => analysisPayload.value.stocks.filter(item => item.roleLabel === '背离股' || item.correlationCategory === 'negative').length)
const selectedCompareStockLabel = computed(() => compareSeries.value.selected ? `${compareSeries.value.selected.name} ${compareSeries.value.selected.code}` : '--')

const filteredStocks = computed(() => {
  const keyword = query.keyword.trim().toLowerCase()
  return analysisPayload.value.stocks.filter((item) => {
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

const formatPct = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}
const formatCoeff = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '--'
  return n.toFixed(3)
}
const roleTagType = (role) => {
  if (role === '核心联动股') return 'danger'
  if (role === '领涨股') return 'warning'
  if (role === '背离股') return 'success'
  return 'info'
}
const resetFilters = () => {
  query.keyword = ''
  query.correlation = ''
  query.direction = ''
  query.maPattern = ''
}

const compareChartRef = ref(null)
const distributionChartRef = ref(null)
let compareChart = null
let distributionChart = null

const initCompareChart = () => {
  if (!compareChartRef.value) return
  compareChart?.dispose()
  compareChart = echarts.init(compareChartRef.value)
  compareChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['概念指数(归一)', '概念MA10', '成分股(归一)', '成分股MA10'] },
    grid: { left: 48, right: 18, top: 38, bottom: 24 },
    xAxis: { type: 'category', data: compareSeries.value.dates },
    yAxis: { type: 'value', splitLine: { lineStyle: { opacity: 0.25 } } },
    series: [
      { name: '概念指数(归一)', type: 'line', smooth: true, symbol: 'none', data: compareSeries.value.conceptClose, lineStyle: { width: 2.4, color: '#111827' } },
      { name: '概念MA10', type: 'line', smooth: true, symbol: 'none', data: compareSeries.value.conceptMa10, lineStyle: { width: 1.8, color: '#f59e0b', type: 'dashed' } },
      { name: '成分股(归一)', type: 'line', smooth: true, symbol: 'none', data: compareSeries.value.stockClose, lineStyle: { width: 2.2, color: '#2563eb' } },
      { name: '成分股MA10', type: 'line', smooth: true, symbol: 'none', data: compareSeries.value.stockMa10, lineStyle: { width: 1.8, color: '#10b981', type: 'dashed' } }
    ]
  })
}

const initDistributionChart = () => {
  if (!distributionChartRef.value) return
  const buckets = [
    { key: 'strong-positive', label: '正相关' },
    { key: 'weak-positive', label: '弱相关' },
    { key: 'neutral', label: '不相关' },
    { key: 'negative', label: '负相关' }
  ]
  distributionChart?.dispose()
  distributionChart = echarts.init(distributionChartRef.value)
  distributionChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 16, top: 20, bottom: 28 },
    xAxis: { type: 'category', data: buckets.map(item => item.label), axisTick: { show: false } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { opacity: 0.25 } } },
    series: [{
      type: 'bar',
      barWidth: 28,
      data: buckets.map(item => analysisPayload.value.stocks.filter(stock => stock.correlationCategory === item.key).length),
      itemStyle: { color: ({ dataIndex }) => ['#ef4444', '#f59e0b', '#94a3b8', '#22c55e'][dataIndex] }
    }]
  })
}

const refreshCharts = async () => {
  await nextTick()
  initCompareChart()
  initDistributionChart()
  compareChart?.resize()
  distributionChart?.resize()
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
  [analysisWindow, selectedCompareCode, () => props.concept?.id, () => props.stocks.length],
  () => { refreshCharts() }
)

const handleResize = () => {
  compareChart?.resize()
  distributionChart?.resize()
}

onMounted(() => {
  refreshCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  compareChart?.dispose()
  distributionChart?.dispose()
})
</script>

<style scoped>
.analysis-panel { margin-top: 24px; }
.panel-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.panel-title { font-size: 15px; font-weight: 800; color: #303133; }
.panel-subtitle { margin-top: 6px; font-size: 12px; color: #909399; }
.analysis-controls, .filter-bar, .tag-row { display: flex; gap: 10px; flex-wrap: wrap; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.summary-card { padding: 16px; border-radius: 12px; background: linear-gradient(180deg, #f8fafc, #eef2ff); border: 1px solid rgba(99, 102, 241, 0.12); }
.summary-k { font-size: 12px; color: #6b7280; }
.summary-v { margin-top: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 18px; font-weight: 800; color: #111827; }
.chart-row { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; margin-top: 18px; }
.chart-card { padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.18); }
.mini-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 10px; }
.compare-chart, .distribution-chart { height: 320px; }
.filter-bar { margin-top: 18px; align-items: center; }
.tag-row { margin-top: 14px; }
.analysis-table { margin-top: 14px; }
.up { color: #f56c6c; }
.down { color: #67c23a; }
@media (max-width: 1280px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .chart-row { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .summary-grid { grid-template-columns: 1fr; }
}
</style>
