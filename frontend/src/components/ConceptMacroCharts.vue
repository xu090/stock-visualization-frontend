<template>
  <section class="macro-wrap">
    <div class="macro-head">
      <div class="macro-title">概念指数强度总览</div>
      <div class="macro-controls">
        <el-segmented v-model="curveMode" :options="modeOptions" size="small" />
        <el-tooltip placement="bottom-end" effect="light" popper-class="macro-mode-tip">
          <template #content>
            <div class="mode-tip">
              <div><b>加权指数</b>：按近几分钟成交额加权，交易越活跃的股票影响越大，用来看资金是否正在打这个概念。</div>
              <div><b>等权指数</b>：所有成分股同等权重，用来看题材是否大面积上涨、有没有扩散。</div>
              <div><b>龙头溢价</b>：加权指数减等权指数，用来看是不是主要由龙头或大成交股票在拉动。</div>
            </div>
          </template>
          <button type="button" class="help-btn" aria-label="概念指数说明">?</button>
        </el-tooltip>
      </div>
    </div>

    <div class="charts-grid">
      <el-card shadow="never" class="chart-card">
        <template #header>
          <div>指数分组代表曲线</div>
        </template>
        <div ref="categoryChartRef" class="chart-box"></div>
        <el-table
          :data="categories"
          size="small"
          class="table"
          @row-click="onClickCategoryRow"
          :row-class-name="rowClassName"
        >
          <el-table-column prop="name" label="分组" min-width="116" />
          <el-table-column prop="count" label="数量" width="58" align="right" />
          <el-table-column label="加权(%)" width="82" align="right">
            <template #default="{ row }">
              <span :class="{ up: row.avgChange > 0, down: row.avgChange < 0 }">
                {{ row.avgChange.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="等权(%)" width="82" align="right">
            <template #default="{ row }">
              <span :class="{ up: row.avgEqualChange > 0, down: row.avgEqualChange < 0 }">
                {{ row.avgEqualChange.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="溢价" width="72" align="right">
            <template #default="{ row }">
              <span :class="{ up: row.avgSpread > 0, down: row.avgSpread < 0 }">
                {{ row.avgSpread.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never" class="chart-card">
        <template #header>
          <div class="detail-head">
            <span>
              组内概念指数
              <em v-if="selectedCategory">({{ selectedCategory.name }})</em>
            </span>
            <div class="detail-tools">
              <el-input
                v-model="detailSearch"
                size="small"
                placeholder="搜索概念"
                clearable
                class="search"
              />
              <el-select v-model="detailSort" size="small" class="sort">
                <el-option label="加权降序" value="changeDesc" />
                <el-option label="等权降序" value="equalDesc" />
                <el-option label="龙头溢价" value="spreadDesc" />
                <el-option label="加权升序" value="changeAsc" />
                <el-option label="名称排序" value="nameAsc" />
              </el-select>
            </div>
          </div>
        </template>
        <div ref="detailChartRef" class="chart-box"></div>
        <div class="detail-list">
          <el-tag
            v-for="item in detailItems"
            :key="item.id"
            effect="plain"
            class="tag"
          >
            {{ item.name }}
          </el-tag>
        </div>
      </el-card>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import { useConceptMacroStore } from '@/stores/conceptMacro'

const macroStore = useConceptMacroStore()
const { categories, categoryChartSeries, detailChartSeries, detailItems, selectedCategory } = storeToRefs(macroStore)

const curveMode = computed({
  get: () => macroStore.curveMode,
  set: (v) => { macroStore.curveMode = v }
})
const detailSearch = computed({
  get: () => macroStore.detailSearch,
  set: (v) => { macroStore.detailSearch = v }
})
const detailSort = computed({
  get: () => macroStore.detailSort,
  set: (v) => { macroStore.detailSort = v }
})

const modeOptions = [
  { label: '加权指数', value: 'weighted' },
  { label: '等权指数', value: 'equal' },
  { label: '龙头溢价', value: 'spread' }
]

const categoryChartRef = ref(null)
const detailChartRef = ref(null)
let categoryChart = null
let detailChart = null

const xAxisLabels = computed(() => macroStore.xAxisLabels)

function buildCommonOption(title, series) {
  return {
    color: ['#2f7ed8', '#f39c12', '#27ae60', '#e74c3c', '#5d6d7e', '#8e44ad'],
    animationDuration: 250,
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0 },
    grid: { left: 40, right: 20, top: 36, bottom: 30 },
    xAxis: {
      type: 'category',
      data: xAxisLabels.value,
      boundaryGap: false,
      axisLabel: { fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: title,
      nameTextStyle: { fontSize: 11 },
      splitLine: { lineStyle: { opacity: 0.25 } },
      axisLabel: { formatter: '{value}%' }
    },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      connectNulls: true,
      showSymbol: false,
      emphasis: { focus: 'series' },
      lineStyle: { width: 2 },
      data: s.data
    }))
  }
}

function renderCategoryChart() {
  if (!categoryChartRef.value) return
  if (!categoryChart) categoryChart = echarts.init(categoryChartRef.value)
  categoryChart.setOption(buildCommonOption('分组指数', categoryChartSeries.value), true)
}

function renderDetailChart() {
  if (!detailChartRef.value) return
  if (!detailChart) detailChart = echarts.init(detailChartRef.value)
  detailChart.setOption(buildCommonOption('概念指数', detailChartSeries.value), true)
}

function onClickCategoryRow(row) {
  macroStore.selectedCategoryId = row.id
}

function rowClassName({ row }) {
  return row.id === macroStore.selectedCategoryId ? 'active-row' : ''
}

function onResize() {
  categoryChart?.resize()
  detailChart?.resize()
}

onMounted(async () => {
  if (!macroStore.loaded && !macroStore.loading) {
    await macroStore.fetchMacroData().catch(() => null)
  }
  macroStore.ensureSelectedCategory()
  await nextTick()
  renderCategoryChart()
  renderDetailChart()
  categoryChart?.on('click', (params) => {
    macroStore.setCategoryByChartName(params?.seriesName)
  })
  window.addEventListener('resize', onResize)
})

watch([categories, curveMode], () => {
  macroStore.ensureSelectedCategory()
  renderCategoryChart()
  renderDetailChart()
}, { deep: true })

watch([detailItems, detailSort, detailSearch], () => {
  renderDetailChart()
}, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  categoryChart?.dispose()
  detailChart?.dispose()
  categoryChart = null
  detailChart = null
})
</script>

<style scoped>
.macro-wrap {
  margin-top: 6px;
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.05);
}

.macro-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.macro-title {
  font-size: 15px;
  font-weight: 900;
  color: #1f2d3d;
}

.macro-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-btn {
  width: 20px;
  height: 20px;
  border: 1px solid #b9d8ff;
  border-radius: 50%;
  background: #eef6ff;
  color: #409eff;
  font-size: 13px;
  font-weight: 900;
  line-height: 18px;
  cursor: help;
}

.mode-tip {
  width: 320px;
  display: grid;
  gap: 8px;
  color: #303133;
  line-height: 1.55;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.chart-card {
  border-radius: 12px;
}

.card-title {
  font-size: 13px;
  font-weight: 800;
  color: #303133;
}

.chart-box {
  height: 260px;
}

.table {
  margin-top: 8px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.detail-head em {
  font-style: normal;
  color: #409eff;
}

.detail-tools {
  display: flex;
  gap: 8px;
}

.search {
  width: 140px;
}

.sort {
  width: 110px;
}

.detail-list {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  margin: 0;
}

.up {
  color: #f56c6c;
}

.down {
  color: #67c23a;
}

:deep(.active-row) {
  background: rgba(64, 158, 255, 0.08);
}

@media (max-width: 1120px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
