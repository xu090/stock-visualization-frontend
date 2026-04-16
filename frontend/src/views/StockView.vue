<template>
  <div class="stock-page">
    <!-- 顶部标题 / 终端头部条 -->
    <div class="market-header">
      <div class="head-left">
        <div class="title-line">
          <div class="market-title">
            {{ stockName }}
            <span class="code">({{ stockCode }})</span>

            <!-- ⭐ 收藏（自选） -->
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
          <span class="sub-item">
            行业：
            <span class="sub-strong">{{ stockSafe.industry || '--' }}</span>
          </span>
        </div>

        <!-- ✅ 行情概览条 -->
        <div class="overview-bar">
          <div class="ov-item">
            <span class="ov-k">最新</span>
            <span class="ov-v price">{{ formatNum(stockSafe.price, 2) }}</span>
          </div>

          <div class="ov-item">
            <span class="ov-k">净流入</span>
            <span class="ov-v bold" :class="moneyClass(stockSafe.netInflow)">
              {{ formatMoney(stockSafe.netInflow) }}
            </span>
          </div>

          <div class="ov-item">
            <span class="ov-k">主力</span>
            <span class="ov-v bold" :class="moneyClass(stockSafe.mainInflow)">
              {{ formatMoney(stockSafe.mainInflow) }}
            </span>
          </div>

          <div class="ov-item">
            <span class="ov-k">换手</span>
            <span class="ov-v">{{ formatPct(stockSafe.turnover) }}</span>
          </div>

          <div class="ov-item">
            <span class="ov-k">振幅</span>
            <span class="ov-v">{{ formatPct(stockSafe.amplitude) }}</span>
          </div>

          <div class="ov-item">
            <span class="ov-k">市值</span>
            <span class="ov-v">{{ formatMoney(stockSafe.mktCap) }}</span>
          </div>

          <div class="ov-item">
            <span class="ov-k">PE/PB</span>
            <span class="ov-v">{{ formatNum(stockSafe.pe, 1) }} / {{ formatNum(stockSafe.pb, 2) }}</span>
          </div>

          <div class="ov-item">
            <span class="ov-k">量比/委比</span>
            <span class="ov-v">{{ stockSafe.volumeRatio ?? '--' }} / {{ stockSafe.orderImbalance ?? '--' }}</span>
          </div>
        </div>
      </div>

    </div>

    <!-- ✅ 核心指标：保持你原来的 9 宫格 -->
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

    <!-- 图表区域 -->
    <div class="panel-row">
      <!-- 资金流图 -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">资金流向（分钟级）</div>
          <el-segmented v-model="fundMode" :options="fundModes" size="small" />
        </div>
        <div ref="fundChartRef" class="chart chart-fund" />
      </div>

      <!-- K线图 -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">K线走势（含成交量）</div>
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
import { Star, StarFilled } from '@element-plus/icons-vue'

const round = (n, d = 2) => {
  const num = Number(n)
  if (Number.isNaN(num)) return 0
  const p = Math.pow(10, d)
  return Math.round(num * p) / p
}

const route = useRoute()
const router = useRouter()
const conceptStore = useConceptStore()
const stockStore = useStockStore()

const stockCode = computed(() => route.params.code)

/** ✅ 反查所属概念（从 stockCodes 找） */
const conceptHit = computed(() => {
  const code = stockCode.value
  const list = conceptStore.conceptList || []
  for (const c of list) if ((c.stockCodes || []).includes(code)) return c
  const myList = conceptStore.myConceptList || []
  for (const c of myList) if ((c.stockCodes || []).includes(code)) return c
  return null
})
const conceptName = computed(() => conceptHit.value?.name || '--')
const conceptId = computed(() => conceptHit.value?.id || '')

/** ✅ 行情统一从 stockStore 拿（终端字段齐全） */
const stockRaw = computed(() => stockStore.getStockByCodeEnriched(stockCode.value, conceptName.value))
const stockSafe = computed(() => stockRaw.value || {})
const stockName = computed(() => stockSafe.value.name || '未知股票')

/** ✅ 自选股票 */
const isFav = computed(() => stockStore.isStockFavorite(stockCode.value))

const toggleFav = () => {
  const code = stockCode.value
  if (!code) return
  if (isFav.value) stockStore.removeStockFromMyStocks(code)
  else stockStore.addStockToMyStocks(code)
}

const goBackConcept = () => {
  if (!conceptId.value) return
  router.push({ path: `/concept/${conceptId.value}` })
}

/** 格式化 */
const formatNum = (v, d = 2) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return n.toFixed(d)
}
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
const formatToYi = (v, d = 2) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n / 1e8).toFixed(d)}`
}
const formatToWanInt = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return Math.round(n / 1e4).toLocaleString()
}
const chgClass = (v) => ({ up: Number(v) > 0, down: Number(v) < 0 })
const moneyClass = (v) => ({ up: Number(v) > 0, down: Number(v) < 0 })

/** ✅ 9宫格：响应式 */
const detailList = computed(() => {
  const s = stockSafe.value
  const open = s.open ?? '--'
  const close = s.close ?? '--'
  const high = s.high ?? '--'
  const low = s.low ?? '--'
  const preClose = s.preClose ?? '--'

  const chg = s.changeAmount
  const chgPct = s.changePercent ?? s.change
  const vol = s.vol ?? s.volume ?? '--'
  const amount = s.amount

  return [
    { label: '开盘价', value: open, style: 'neutral' },
    { label: '收盘价', value: close, style: 'primary' },
    { label: '最高价', value: high, style: 'neutral' },
    { label: '最低价', value: low, style: 'neutral' },
    { label: '昨收价', value: preClose, style: 'neutral' },
    {
      label: '涨跌额',
      value: Number.isNaN(Number(chg)) ? '--' : `${Number(chg) > 0 ? '+' : ''}${Number(chg).toFixed(2)}`,
      style: Number(chg) >= 0 ? 'danger' : 'success'
    },
    { label: '涨跌幅', value: formatPct(chgPct), style: Number(chgPct) >= 0 ? 'danger' : 'success' },
    { label: '成交量(万)', value: formatToWanInt(vol), style: 'neutral' },
    { label: '成交额(亿)', value: formatToYi(amount), style: 'neutral' }
  ]
})

/** 图表 */
const fundChartRef = ref(null)
const klineChartRef = ref(null)
let fundChart = null
let klineChart = null

const klinePeriod = ref('1m')
const fundMode = ref('net')
const fundModes = [
  { label: '净流入', value: 'net' },
  { label: '流入/流出', value: 'io' }
]

const timeAxis = ['09:30', '10:00', '10:30', '11:00', '13:00', '14:00', '14:30', '15:00']
const baseH = computed(() => {
  const code = stockCode.value || 'x'
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h << 5) - h + code.charCodeAt(i)
  return Math.abs(h)
})

const buildFundSeries = () => {
  const h = baseH.value
  const inflow = timeAxis.map((_, i) => 200 + (h % 120) + i * 18 + ((h >> (i % 5)) % 30))
  const outflow = timeAxis.map((_, i) => 180 + (h % 90) + i * 16 + ((h >> ((i + 2) % 6)) % 28))
  const net = inflow.map((v, i) => v - outflow[i])
  return { inflow, outflow, net }
}

const initFundChart = () => {
  if (!fundChartRef.value) return
  fundChart?.dispose()
  fundChart = echarts.init(fundChartRef.value)

  const { inflow, outflow, net } = buildFundSeries()
  const showNet = fundMode.value === 'net'

  fundChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 18, top: 18, bottom: 42 },
    legend: { bottom: 6, left: 'center', data: showNet ? ['净流入'] : ['流入', '流出', '净流入'] },
    xAxis: { type: 'category', data: timeAxis, axisTick: { show: false } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { opacity: 0.35 } } },
    series: showNet
      ? [{ name: '净流入', type: 'bar', data: net, barWidth: 14 }]
      : [
          { name: '流入', type: 'line', smooth: true, data: inflow },
          { name: '流出', type: 'line', smooth: true, data: outflow },
          { name: '净流入', type: 'bar', data: net, barWidth: 14 }
        ]
  })
}

const buildKline = () => {
  const h = baseH.value
  const base = 20 + (h % 30)
  const ohlc = timeAxis.map((_, i) => {
    const o = base + ((h >> (i % 6)) % 8) * 0.4 + i * 0.15
    const c = o + (((h >> ((i + 2) % 7)) % 10) - 5) * 0.25
    const hi = Math.max(o, c) + ((h >> ((i + 1) % 6)) % 5) * 0.22
    const lo = Math.min(o, c) - ((h >> ((i + 3) % 6)) % 5) * 0.20
    return [round(o, 2), round(c, 2), round(lo, 2), round(hi, 2)]
  })
  const vol = timeAxis.map((_, i) => 60 + ((h >> (i % 5)) % 60) + i * 8)
  return { ohlc, vol }
}

const initKlineChart = () => {
  if (!klineChartRef.value) return
  klineChart?.dispose()
  klineChart = echarts.init(klineChartRef.value)

  const { ohlc, vol } = buildKline()

  klineChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: [
      { left: 54, right: 18, top: 18, height: '62%' },
      { left: 54, right: 18, top: '74%', height: '18%' }
    ],
    xAxis: [
      { type: 'category', data: timeAxis, boundaryGap: true, axisLine: { onZero: false } },
      { type: 'category', data: timeAxis, gridIndex: 1, axisTick: { show: false }, axisLabel: { show: false } }
    ],
    yAxis: [
      { scale: true, splitLine: { lineStyle: { opacity: 0.35 } } },
      { gridIndex: 1, splitNumber: 2, splitLine: { show: false } }
    ],
    series: [
      { type: 'candlestick', data: ohlc },
      { type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: vol, barWidth: 10 }
    ]
  })
}

const resizeCharts = () => {
  fundChart?.resize()
  klineChart?.resize()
}

const refresh = async () => {
  await nextTick()
  initFundChart()
  initKlineChart()
  resizeCharts()
}

onMounted(() => {
  // ✅ 演示用：让当前股票行情动起来（如不需要，可删）
  stockStore.startQuotePolling([stockCode.value], 3000)
  refresh()
  window.addEventListener('resize', resizeCharts)
})

watch(() => stockCode.value, async (newCode) => {
  stockStore.startQuotePolling([newCode], 3000)
  await refresh()
})
watch([klinePeriod, fundMode], () => {
  initFundChart()
  initKlineChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  stockStore.stopQuotePolling()
  fundChart?.dispose()
  klineChart?.dispose()
})
</script>

<style scoped>
.stock-page { padding: 24px; background: #f6f8fb; border-radius: 14px; }
.market-header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.head-left { flex: 1 1 auto; min-width: 0; }
.head-right { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.quick-actions { display: flex; gap: 8px; }

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
.arrow { font-weight: 900; margin-right: 2px; }
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

@media (max-width: 1100px) {
  .metric-grid { grid-template-columns: repeat(3, 1fr); }
  .panel-row { grid-template-columns: 1fr; }
}
</style>
