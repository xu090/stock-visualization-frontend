<template>
  <div class="sidebar-shell">

      <!-- 顶部快捷入口：不滚动 -->
    <div class="quick" id="tour-quick">
      <div
        class="quick-item"
        id="tour-quick-overview"
        :class="{ active: isActiveTop }"
        @click="goTopOverview"
      >
        <div class="qi-left">
          <el-icon class="qi-ic"><HomeFilled /></el-icon>
          <span class="qi-txt">主页</span>
        </div>
      </div>
    </div>

    <!-- 自选区：外层不滚动，列表内部滚动 -->
    <div class="fav-wrap">
      <!-- 概念/行业列表 -->
      <section class="fav-card" id="tour-fav-concept">
        <div class="fav-head">
          <div class="fav-title">
            <el-tabs v-model="activeTopTab" class="top-tabs" stretch>
              <el-tab-pane label="概念自选" name="concept" />
              <el-tab-pane label="行业自选" name="industry" />
            </el-tabs>
          </div>
        </div>

        <div class="fav-table-head">
          <span class="h-name">{{ activeTopTab === 'industry' ? '行业名称' : '概念名称' }}</span>
          <span class="h-mid">涨跌幅</span>
          <span class="h-right">净流入</span>
        </div>

        <!-- ✅ 内部滚动 -->
        <div class="fav-list scroll-hidden">
          <div
            v-for="c in myConceptsEnriched"
            :key="c.id"
            class="row"
            :class="{ active: isConceptRouteActive(c.id) }"
            @click="goConcept(c.id)"
          >
            <div class="cell name">
              <el-tooltip :content="c.name" placement="top" effect="dark">
                <div class="name-main">{{ shortDisplayName(c.name) }}</div>
              </el-tooltip>
            </div>

            <div class="cell mid">
              <span class="num" :class="chgClass(c.change)">
                <span class="arrow">{{ arrow(c.change) }}</span>
                {{ fmtPctAbs(c.change) }}
              </span>
            </div>

            <div class="cell right">
              <span class="num" :class="moneyClass(c.netInflow)">
                {{ fmtMoneySigned(c.netInflow) }}
              </span>
            </div>
          </div>

          <div v-if="myConceptsEnriched.length === 0" class="empty">
            暂无自选概念
          </div>
        </div>
      </section>

      <!-- 股票自选 -->
      <section class="fav-card" id="tour-fav-stock">
        <div class="fav-head">
          <div class="fav-title">
            <el-icon class="fav-ic"><Tickets /></el-icon>
            <span>股票自选</span>
          </div>
         </div>

        <div class="fav-table-head">
          <span class="h-name">股票</span>
          <span class="h-mid">涨跌幅</span>
          <span class="h-right">涨跌额</span>
        </div>

        <!-- ✅ 内部滚动 -->
        <div class="fav-list scroll-hidden">
          <div
            v-for="s in myStockEnriched"
            :key="s.code"
            class="row"
            :class="{ active: isStockRouteActive(s.code) }"
            @click="goStock(s.code)"
          >
            <div class="cell name">
              <el-tooltip :content="s.name" placement="top" effect="dark">
                <div class="name-main">{{ shortDisplayName(s.name) }}</div>
              </el-tooltip>
              <div class="name-sub">{{ s.code }}</div>
            </div>

            <div class="cell mid">
              <span class="num" :class="chgClass(s.change)">
                <span class="arrow">{{ arrow(s.change) }}</span>
                {{ fmtPctSigned(s.change) }}
              </span>
            </div>

            <div class="cell right">
              <span class="num" :class="moneyClass(s.changeAmount)">
                {{ fmtPriceSigned(s.changeAmount) }}
              </span>
            </div>
          </div>

          <div v-if="myStockEnriched.length === 0" class="empty">
            暂无自选股票
          </div>
        </div>
      </section>
    </div>

    <div class="pad" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { DataAnalysis, Star, Tickets, Document, ArrowRight } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const conceptStore = useConceptStore()
const stockStore = useStockStore()

/**
 * ✅ 顶部 tab：默认 concept
 * - 行业相关路由：/industry、/industry/:id => 自动切换为 industry
 * - 概念相关路由：/home、/concept/:id、/my-concept/:id => 自动切换为 concept
 */
const activeTopTab = ref('concept')

const isIndustryRoute = computed(() => {
  const p = route.path || ''
  return p === '/industry' || p.startsWith('/industry/')
})

watch(
  isIndustryRoute,
  (v) => {
    activeTopTab.value = v ? 'industry' : 'concept'
  },
  { immediate: true }
)

/**
 * ✅ 点击 tab：跳到对应总览（让用户感受到“切换分类”）
 * - concept -> /home
 * - industry -> /industry
 */
watch(activeTopTab, (tab) => {
  const p = route.path || ''
  if (tab === '/home') {
    if (p !== '/home' && !p.startsWith('/home/')) router.push('/home')
  } else {
    // 回概念总览：用 /home（你现在总览页）
    if (p !== '/home' && !p.startsWith('/concept/') && !p.startsWith('/my-concept/')) {
      router.push('/home')
    }
  }
})

/** ✅ 概念自选补齐指标：从 conceptOverviewAll 取 change/netInflow（含系统+自定义） */
const overviewMap = computed(() => {
  const map = Object.create(null)
  ;(conceptStore.conceptOverviewAll || []).forEach(c => { map[String(c.id)] = c })
  return map
})

const myConceptsEnriched = computed(() => {
  const list = Array.isArray(conceptStore.myConceptList) ? conceptStore.myConceptList : []
  return list.map(c => {
    const id = String(c.id)
    const ov = overviewMap.value[id] || {}
    return {
      ...c,
      id,
      change: ov.change ?? c.change ?? 0,
      netInflow: ov.netInflow ?? c.netInflow ?? 0,

      // 兼容字段
      change5d: ov.change5d ?? ov.rtChange5d ?? ov.change5m ?? ov.change ?? 0,
      netInflow5d: ov.netInflow5d ?? ov.rtNetInflow ?? ov.netInflow ?? 0
    }
  })
})

/** 股票自选：名称/代码 + 涨跌幅/涨跌额 */
const shortDisplayName = (name) => {
  const s = String(name ?? '')
  if (s.length <= 4) return s
  return `${s.slice(0, 2)}..${s.slice(-1)}`
}

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH)$/i, '')
  s = s.replace(/^(sz|sh)/i, '')
  return s
}

const myStockCodesSafe = computed(() => {
  const list = stockStore?.myStockCodes
  return Array.isArray(list) ? list : []
})

const myStocksOldSafe = computed(() => {
  const list = conceptStore.myStockList
  return Array.isArray(list) ? list : []
})

const myStockEnriched = computed(() => {
  if (myStockCodesSafe.value.length) {
    return myStockCodesSafe.value
      .map(code => {
        const c = normalizeCode(code)
        const base = stockStore?.getStockBaseByCode?.(c)
        const q = stockStore?.getStockByCodeEnriched?.(c)
        return {
          code: c,
          name: base?.name || q?.name || c,
          change: Number(q?.change ?? q?.changePercent ?? 0),
          changeAmount: Number(q?.changeAmount ?? 0)
        }
      })
      .filter(Boolean)
  }

  return myStocksOldSafe.value.map(s => {
    const c = normalizeCode(s.code)
    return {
      code: c,
      name: s.name || c,
      change: Number(s.change ?? 0),
      changeAmount: Number(s.changeAmount ?? 0)
    }
  })
})

/** 总览按钮状态 */
const isActiveTop = computed(() => {
  const p = route.path || ''
  return (activeTopTab.value === 'concept' && p === '/home')
    || (activeTopTab.value === 'industry' && p === '/industry')
})

const goTopOverview = () => {
  if (activeTopTab.value === 'industry') router.push('/industry')
  else router.push('/home')
}

/** ✅ 路由高亮判断 */
const isConceptRouteActive = (id) => {
  const sid = String(id)
  const p = route.path || ''
  return p === `/concept/${sid}` || p === `/my-concept/${sid}`
}
const isStockRouteActive = (code) => {
  const c = normalizeCode(code)
  const p = route.path || ''
  return p === `/my-stocks/${c}` || p === `/stock/${c}`
}

/**
 * ✅ 你确认概念详情主路由：/concept/:id
 * - 如果你还想走 /my-concept/:id，只要把下面这行改回去即可
 */
const goConcept = (id) => {
  const sid = String(id)
  if (activeTopTab.value === 'industry') router.push(`/industry/${sid}`)
  else router.push(`/concept/${sid}`) // ✅ 主路由
  // else router.push(`/my-concept/${sid}`) // 兼容备选
}

const goStock = (code) => router.push(`/my-stocks/${normalizeCode(code)}`)

/** 格式化 */
const arrow = (v) => {
  const n = Number(v)
  if (Number.isNaN(n) || n === 0) return '—'
  return n > 0 ? '↑' : '↓'
}
const chgClass = (v) => {
  const n = Number(v)
  if (Number.isNaN(n) || n === 0) return 'flat'
  return n > 0 ? 'up' : 'down'
}
const moneyClass = (v) => chgClass(v)

const fmtPctSigned = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}
const fmtPctAbs = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return `${Math.abs(n).toFixed(2)}%`
}
const fmtPriceSigned = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}
const fmtMoneySigned = (v) => {
  const n = Number(v)
  if (Number.isNaN(n)) return '--'
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}万`
  return `${sign}${abs.toFixed(0)}`
}
</script>

<style scoped>
/* ✅ 隐藏滚动条但保留滚动 */
.scroll-hidden{
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scroll-hidden::-webkit-scrollbar{ width: 0; height: 0; }

.sidebar-shell{
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  border-right: 0;
}

/* tabs */
.top-tabbar{
  padding: 10px 10px 0;
  border-bottom: 1px solid rgba(0,0,0,.06);
  background: #fff;

}

.top-tabs .el-tabs__header {
  display: flex;
  justify-content: space-between;
  padding: 0;
}

.top-tabs .el-tabs__header .el-tabs__item {
  font-size: 13px; /* 增大字体 */
  font-weight: bold;
  color: #1f2d3d;
  padding: 5px 10px;
  border-radius: 6px;
  margin: 0 5px;
  cursor: pointer;
}

.top-tabs .el-tabs__header .el-tabs__item.is-active {
  background-color: #eef4ff; /* 激活时背景色 */
  color: #2f80ed; /* 激活时字体颜色 */
  border-color: #2f80ed;
}

.top-tabs .el-tabs__header .el-tabs__item:hover {
  background-color: #f2f6ff; /* 悬停背景色 */
}

.top-tabs .el-tabs__header .el-tabs__item.is-disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}.top-tabs :deep(.el-tabs__header){ 
  margin: 0; 
  margin-left: 10px; 
  width: 100%;
}
.top-tabs :deep(.el-tabs__nav-wrap::after){ 
  height: 1px; 
}
/* 快捷入口 */
.quick{
  padding: 10px 10px 6px;
  display: grid;
  gap: 6px;
  flex-shrink: 0;
}
.quick-item{
  height: 40px;
  padding: 0 10px;
  border-radius: 6px;
  background: #fafbfc;
  border: 1px solid rgba(0,0,0,.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: .12s ease;
}
.quick-item:hover{
  background: #f2f6ff;
  border-color: rgba(64,158,255,.18);
}
.quick-item.active{
  background: #eef4ff;
  border-color: rgba(64,158,255,.28);
}
.qi-left{ display:flex; align-items:center; gap: 8px; min-width:0; }
.qi-ic{ font-size: 16px; color: #2f80ed; }
.qi-txt{
  font-size: 13px;
  font-weight: 800;
  color: #1f2d3d;
  white-space: nowrap;
}
.qi-right{ color:#c0c4cc; }

/* ✅ 自选区：外层不滚动，给内部列表滚动空间 */
.fav-wrap{
  padding: 4px 8px 0;
  display: grid;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}


/* 卡片 */
.fav-card{
  background: #fff;
  border: 1px solid rgba(0,0,0,.06);
  border-radius: 8px;
  box-shadow: none;
  overflow: hidden;

  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 头部 */
.fav-head{
  height: 48px;
  padding: 0 12px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0,0,0,.06);
  background: #f8fafd;
  flex-shrink: 0;
}
.fav-title{
  display:flex;
  align-items:center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2d3d;
}
.fav-ic{ color:#2f80ed; font-size: 16px; }

.fav-badge{
  min-width: 26px;
  height: 22px;
  padding: 0 8px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 12px;
  font-weight: 600;
}

/* 表头 */
.fav-table-head{
  height: 38px;
  padding: 0 8px;
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  column-gap: 4px;
  align-items:center;
  color:#7f8ba2;
  font-size: 12px;
  font-weight: 800;
  background: #f4f6fa;
  border-bottom: 1px solid rgba(0,0,0,.04);
  flex-shrink: 0;
  box-sizing: border-box;
}
.h-mid, .h-right{
  text-align:right;
  white-space: nowrap;
}
.h-name{
  min-width: 0;
  white-space: nowrap;
  letter-spacing: 0;
}

/* 列表 */
.fav-list{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 0 4px;
}

/* 行 */
.row{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  column-gap: 4px;
  align-items:center;
  padding: 9px 8px;
  border-radius: 0;
  cursor: pointer;
  transition: .12s ease;
  box-sizing: border-box;
}
.row:hover{ background: rgba(47,128,237,.05); }
.row.active{
  background: rgba(47,128,237,.08);
  outline: none;
}

/* 名称 */
.name-main{
  font-size: 13px;
  font-weight: 900;
  color: #1f2d3d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  min-width: 4em;
}
.name-sub{
  margin-top: 3px;
  font-size: 10px;
  color: #8c97ab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 数字 */
.cell.name{
  min-width: 0;
}
.cell.mid, .cell.right{ text-align:right; }
.num{
  font-size: 12px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.arrow{
  font-size: 12px;
  font-weight: 900;
  opacity: .95;
}

/* 股民习惯：涨红跌绿 */
.up{ color: #f56c6c; }
.down{ color: #67c23a; }
.flat{ color: #909399; }

.empty{
  padding: 14px 10px 16px;
  text-align: center;
  color: #b0b4bb;
  font-size: 12px;
}

.pad{ height: 10px; flex-shrink: 0; }
</style>

