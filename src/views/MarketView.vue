<template>
  <div
    class="market-shell"
    :class="{
      'with-switcher': showSwitcher,
      'switcher-collapsed': showSwitcher && collapsed
    }"
  >
    <!-- ✅ 左侧概念切换栏 -->
    <aside v-if="showSwitcher" class="switcher">
      <div class="switcher-top">
        <div class="switcher-title-row">
          <div class="switcher-title" v-show="!collapsed">概念切换</div>

          <div class="switcher-tools">
            <!-- ✅ 收起/展开 -->
            <el-tooltip :content="collapsed ? '展开' : '收起'" placement="top" effect="dark">
              <el-button
                class="icon-btn"
                text
                circle
                @click="collapsed = !collapsed"
                aria-label="toggle switcher"
              >
                <el-icon>
                  <Expand v-if="collapsed" />
                  <Fold v-else />
                </el-icon>
              </el-button>
            </el-tooltip>

            <!-- ✅ 返回总览 -->
            <el-tooltip content="返回总览" placement="top" effect="dark">
              <el-button
                class="icon-btn"
                text
                circle
                @click="embedded ? emit('closeEmbedded') : goBackOverview()"
                aria-label="back overview"
              >
                <el-icon><Back /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <div class="switcher-sub" v-show="!collapsed">快速定位板块并查看数据概览</div>

        <el-input
          v-show="!collapsed"
          v-model="switchKeyword"
          placeholder="搜索概念（名称）"
          clearable
          class="switcher-search"
        />

        <!-- ✅ 收起时：用更终端感的小切换按钮（自选/全部） -->
        <div v-if="collapsed" class="mini-tab">
          <el-tooltip content="自选" placement="right" effect="dark">
            <el-button
              class="mini-tab-btn"
              :class="{ active: switchTab === 'fav' }"
              text
              circle
              @click="switchTab = 'fav'"
              aria-label="fav tab"
            >
              <el-icon><Star /></el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip content="全部" placement="right" effect="dark">
            <el-button
              class="mini-tab-btn"
              :class="{ active: switchTab === 'all' }"
              text
              circle
              @click="switchTab = 'all'"
              aria-label="all tab"
            >
              <el-icon><Menu /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <!-- ✅ 展开时：Tabs 自选/全部 -->
      <el-tabs v-if="!collapsed" v-model="switchTab" class="switcher-tabs" stretch>
        <el-tab-pane label="自选" name="fav">
          <div class="switcher-list scroll-hidden">
            <div
              v-for="c in myConceptsFiltered"
              :key="c.id"
              class="switcher-item"
              :class="{ active: c.id === curId }"
              @click="goConcept(c.id)"
            >
              <div class="left">
                <div class="name-line">
                  <span class="name">{{ c.name }}</span>
                  <el-tag size="small" effect="plain" type="warning" class="tag-fav">自选</el-tag>
                </div>
                <div class="meta">
                  <span>成分股 {{ (c.stockCodes?.length ?? 0) }} 支</span>
                </div>
              </div>

              <el-icon class="chev"><ArrowRight /></el-icon>
            </div>

            <div v-if="myConceptsFiltered.length === 0" class="empty">
              暂无匹配自选概念
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="全部" name="all">
          <div class="switcher-list scroll-hidden">
            <div
              v-for="c in allConceptsFiltered"
              :key="c.id"
              class="switcher-item"
              :class="{ active: c.id === curId }"
              @click="goConcept(c.id)"
            >
              <div class="left">
                <div class="name-line">
                  <span class="name">{{ c.name }}</span>
                  <el-tag
                    v-if="isConceptFav(c.id)"
                    size="small"
                    effect="plain"
                    type="warning"
                    class="tag-fav"
                  >
                    自选
                  </el-tag>
                </div>
                <div class="meta">
                  <span>成分股 {{ (c.stockCodes?.length ?? 0) }} 支</span>
                </div>
              </div>

              <el-icon class="chev"><ArrowRight /></el-icon>
            </div>

            <div v-if="allConceptsFiltered.length === 0" class="empty">
              暂无匹配概念
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- ✅ 收起时：紧凑列表（简称 + tooltip） -->
      <div v-else class="switcher-list mini-list scroll-hidden">
        <div
          v-for="c in (switchTab === 'fav' ? myConceptsFiltered : allConceptsFiltered)"
          :key="c.id"
          class="mini-item"
          :class="{ active: c.id === curId }"
          @click="goConcept(c.id)"
        >
          <el-tooltip :content="c.name" placement="right" effect="dark">
            <div class="mini-pill">{{ abbr(c.name) }}</div>
          </el-tooltip>
        </div>

        <div
          v-if="(switchTab === 'fav' ? myConceptsFiltered : allConceptsFiltered).length === 0"
          class="empty mini-empty"
        >
          —
        </div>
      </div>
    </aside>

    <!-- ✅ 主内容：你的 market-page（成分股不动） -->
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
                <el-button class="fav-btn" text circle @click="toggleFav">
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

        <!-- ✅ 成分股列表：加“股民常用排序” -->
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
            <el-table-column prop="code" label="代码" width="120" />

            <el-table-column prop="name" label="名称" width="120" />

            <!-- 最新：排序 -->
            <el-table-column prop="price" label="最新" width="90" sortable="custom">
              <template #default="{ row }">
                {{ row.price?.toFixed?.(2) ?? row.price ?? '--' }}
              </template>
            </el-table-column>

            <!-- 涨跌幅：排序（默认） -->
            <el-table-column prop="change" label="涨跌幅" width="130"  sortable="custom">
              <template #default="{ row }">
                <span class="chg" :class="{ up: row.change > 0, down: row.change < 0 }">
                  <span class="arrow" v-if="row.change > 0">↑</span>
                  <span class="arrow" v-else-if="row.change < 0">↓</span>
                  <span class="num">{{ formatPct(row.change) }}</span>
                </span>
              </template>
            </el-table-column>

            <!-- 成交额：排序 -->
            <el-table-column prop="amount" label="成交额" width="120"  sortable="custom">
              <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
            </el-table-column>

            <!-- 换手：排序 -->
            <el-table-column prop="turnover" label="换手" width="120"  sortable="custom">
              <template #default="{ row }">{{ Number(row.turnover).toFixed(1) }}%</template>
            </el-table-column>

            <!-- 净流入：排序 -->
            <el-table-column prop="netInflow" label="净流入" width="120" sortable="custom">
              <template #default="{ row }">
                <span :class="{ up: row.netInflow > 0, down: row.netInflow < 0 }">
                  {{ formatMoney(row.netInflow) }}
                </span>
              </template>
            </el-table-column>

            <!-- 主力：排序 -->
            <el-table-column prop="mainInflow" label="主力" width="120"  sortable="custom">
              <template #default="{ row }">
                <span :class="{ up: row.mainInflow > 0, down: row.mainInflow < 0 }">
                  {{ formatMoney(row.mainInflow) }}
                </span>
              </template>
            </el-table-column>

            <!-- 市值：排序 -->
            <el-table-column prop="mktCap" label="市值" width="120"  sortable="custom">
              <template #default="{ row }">{{ formatMoney(row.mktCap) }}</template>
            </el-table-column>

            <!-- PE：排序 -->
            <el-table-column prop="pe" label="PE" width="90"  sortable="custom">
              <template #default="{ row }">{{ row.pe?.toFixed?.(1) ?? row.pe ?? '--' }}</template>
            </el-table-column>

            <!-- PB：排序 -->
            <el-table-column prop="pb" label="PB" width="90"  sortable="custom">
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
import {
  Star,
  StarFilled,
  ArrowRight,
  Fold,
  Expand,
  Back,
  Menu
} from '@element-plus/icons-vue'

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
const curId = computed(() => props.forcedConceptId || route.params.id)

/** ✅ 概念切换栏显示：Drawer 或 query.from=overview */
const showSwitcher = computed(() => props.embedded || route.query.from === 'overview')

/** ✅ 收起状态 */
const collapsed = ref(false)

/** ✅ 当前概念：系统优先，否则自选 */
const sysConcept = computed(() => conceptStore.getConceptById(curId.value))
const myConcept = computed(() => conceptStore.getMyConceptById(curId.value))
const concept = computed(() => sysConcept.value || myConcept.value || null)

const conceptName = computed(() => concept.value?.name || curId.value)
const title = computed(() => `${conceptName.value}`)

/** ✅ 成分股：只用 stockCodes，行情从 stockStore enriched 获取 */
const stocks = computed(() => {
  const c = concept.value
  const codes = c?.stockCodes || []
  return stockStore.getStocksByCodesEnriched(codes, c?.name || '')
})

/** ✅ 股民常用：默认按涨跌幅降序 */
const sortState = ref({
  prop: 'change',
  order: 'descending' // 'ascending' | 'descending' | null
})

const defaultSort = computed(() => ({
  prop: sortState.value.prop,
  order: sortState.value.order
}))

/** ✅ 容错：把各种 '--' / null / NaN 变成可排序的数字 */
const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
}

const sortedStocks = computed(() => {
  const list = (stocks.value || []).slice()
  const { prop, order } = sortState.value
  if (!prop || !order) return list

  const dir = order === 'ascending' ? 1 : -1

  // 绝大多数字段都是数字；code/name 不给排序（你也没设置 sortable）
  list.sort((a, b) => {
    const av = toNum(a?.[prop])
    const bv = toNum(b?.[prop])
    if (av === bv) return 0
    return (av > bv ? 1 : -1) * dir
  })
  return list
})

const onSortChange = ({ prop, order }) => {
  // Element Plus：点击同一列会循环 descending -> ascending -> null
  sortState.value = { prop, order }
}

const goStock = (row) => {
  router.push(`/stock/${row.code}`)
}

/** 收藏 */
const isFav = computed(() => conceptStore.isConceptFavorite?.(curId.value) ?? false)
const toggleFav = () => {
  const c = concept.value
  if (!c) return
  if (isFav.value) conceptStore.removeConceptFromMyConcept(curId.value)
  else conceptStore.addConceptToMyConcept(c)
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

/** ===== 概念切换栏 ===== */
const switchKeyword = ref('')
const switchTab = ref('fav')

const allConceptsFiltered = computed(() => {
  const kw = switchKeyword.value.trim().toLowerCase()
  const list = conceptStore.conceptList || []
  return kw ? list.filter(c => (c.name || '').toLowerCase().includes(kw)) : list
})
const myConceptsFiltered = computed(() => {
  const kw = switchKeyword.value.trim().toLowerCase()
  const list = conceptStore.myConceptList || []
  return kw ? list.filter(c => (c.name || '').toLowerCase().includes(kw)) : list
})
const isConceptFav = (id) => conceptStore.isConceptFavorite?.(id) ?? false

const goBackOverview = () => {
  router.push('/home')
}

/** ✅ 切换概念：Drawer 模式 emit；路由模式 push 并确保 from=overview */
const goConcept = (id) => {
  if (id === curId.value) return
  if (props.embedded) {
    emit('update:forcedConceptId', id)
  } else {
    router.push({ path: `/concept/${id}`, query: { ...route.query, from: 'overview' } })
  }
}

/** ✅ 收起时显示简称 */
const abbr = (name = '') => {
  const s = String(name).trim()
  if (!s) return '—'
  return s.slice(0, 2)
}

/** ===== 你原来的 9 宫格 & 图表（保持）===== */
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

const startTickerForCurrent = () => {
  const codes = concept.value?.stockCodes || []
  stockStore.startMockTicker(codes, 3000)
}

onMounted(() => {
  startTickerForCurrent()
  refresh()
})

watch(() => curId.value, () => {
  startTickerForCurrent()
  refresh()
})

watch(klinePeriod, initKlineChart)

onBeforeUnmount(() => {
  stockStore.stopMockTicker()
  fundChart?.dispose()
  klineChart?.dispose()
})
</script>

<style scoped>
/* ✅ 隐藏滚动条但保留滚动能力 */
.scroll-hidden{ scrollbar-width:none; -ms-overflow-style:none; }
.scroll-hidden::-webkit-scrollbar{ width:0; height:0; }

/* ✅ 外层：默认一列 */
.market-shell{
  width:100%;
  display:grid;
  grid-template-columns: 1fr;
  gap:16px;
  align-items:start;
  transition: grid-template-columns .18s ease, gap .18s ease;
}
.market-shell.with-switcher{ grid-template-columns: 220px minmax(0, 1fr); }
.market-shell.with-switcher.switcher-collapsed{ grid-template-columns: 56px minmax(0, 1fr); }

/* ✅ switcher：sticky */
.switcher{
  position:sticky;
  top:12px;
  width:100%;
  z-index:1;
  background:#fff;
  border-radius:14px;
  box-shadow: 0 12px 28px rgba(0,0,0,.12);
  overflow:hidden;
}
.switcher-top{ padding:12px 12px 10px; border-bottom:1px solid rgba(0,0,0,.06); }
.switcher-title-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.switcher-title{ font-weight:900; color:#303133; font-size:14px; }
.switcher-tools{ display:inline-flex; align-items:center; gap:4px; }
.icon-btn{ padding:0 !important; width:28px; height:28px; }
.switcher-sub{ margin-top:4px; font-size:12px; color:#909399; }
.switcher-search{ margin-top:10px; }
.switcher-tabs{ padding:0 10px 10px; }

.switcher-list{
  display:flex;
  flex-direction:column;
  gap:10px;
  max-height:560px;
  overflow:auto;
  padding:10px 6px 12px;
}
.switcher-item{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:10px 12px;
  border-radius:12px;
  cursor:pointer;
  background:#f6f8fb;
  transition:.18s ease;
  border:1px solid transparent;
}
.switcher-item:hover{ background:#eef3ff; border-color: rgba(64,158,255,.25); }
.switcher-item.active{ background:#e8f0ff; border-color: rgba(64,158,255,.45); }
.switcher-item .left{ display:flex; flex-direction:column; gap:6px; min-width:0; }
.name-line{ display:flex; align-items:center; gap:8px; min-width:0; }
.switcher-item .name{
  font-weight:900;
  color:#303133;
  font-size:13px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  max-width:150px;
}
.meta{ font-size:12px; color:#909399; }
.tag-fav{ flex-shrink:0; }
.chev{ color:#c0c4cc; font-size:14px; }
.empty{ color:#c0c4cc; font-size:12px; padding:10px 12px; }

/* mini */
.mini-tab{ display:flex; flex-direction:column; gap:6px; margin-top:6px; align-items:center; }
.mini-tab-btn{ width:34px; height:34px; border-radius:10px; background: rgba(64,158,255,.06); }
.mini-tab-btn.active{ background: rgba(64,158,255,.14); }
.mini-list{ padding:10px 6px 12px; gap:8px; align-items:center; }
.mini-item{ width:100%; display:flex; justify-content:center; cursor:pointer; }
.mini-pill{
  width:40px; height:40px; border-radius:12px;
  display:flex; align-items:center; justify-content:center;
  font-weight:900; font-size:12px; color:#303133;
  background:#f6f8fb; border:1px solid rgba(0,0,0,.06);
  transition:.16s ease;
}
.mini-item:hover .mini-pill{ background:#eef3ff; border-color: rgba(64,158,255,.25); }
.mini-item.active .mini-pill{ background:#e8f0ff; border-color: rgba(64,158,255,.45); }
.mini-empty{ padding:12px 0; text-align:center; }

/* 主内容：防溢出（关键） */
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

/* 响应式 */
@media (max-width: 1100px){
  .market-shell.with-switcher,
  .market-shell.with-switcher.switcher-collapsed{
    grid-template-columns: 1fr;
  }
  .switcher{ position: static; }
  .metric-grid{ grid-template-columns: repeat(3, 1fr); }
  .panel-row{ grid-template-columns: 1fr; }
}
</style>
