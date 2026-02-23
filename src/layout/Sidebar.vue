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
              <el-tab-pane label="概念列表" name="concept" />
              <el-tab-pane label="行业列表" name="industry" />
            </el-tabs>
          </div>
        </div>

        <div class="fav-table-head">
          <span class="h-name">{{ activeTopTab === 'industry' ? '行业名称' : '概念名称' }}</span>
          <span class="h-mid">涨跌幅</span>
          <span class="h-right">净流入</span>
        </div>

        <!-- 内部滚动 -->
        <div class="fav-list scroll-hidden">
          <div
            v-for="c in topList"
            :key="c.id"
            class="row"
            :class="{ active: isConceptRouteActive(c.id) }"
            @click="goConcept(c.id)"
          >
            <div class="cell name">
              <div class="name-line">
                <el-tooltip :content="c.name" placement="top">
                  <div class="name-main">{{ getFormattedName(c.name) }}</div>
                </el-tooltip>
                <span v-if="c.__fav" class="fav-star-btn">
                  <el-icon class="fav-star on" :size="10"><StarFilled /></el-icon>
                </span>
              </div>
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

          <div v-if="topList.length === 0" class="empty">
            暂无{{ activeTopTab === 'industry' ? '行业列表' : '概念列表' }}
          </div>
        </div>
      </section>

      <!-- 股票自选 -->
      <section class="fav-card" id="tour-fav-stock">
        <div class="fav-head">
          <div class="fav-title">
            <el-icon class="fav-ic"><Tickets /></el-icon>
            <span>股票列表</span>
          </div>
        </div>

        <div class="fav-table-head">
          <span class="h-name">股票</span>
          <span class="h-mid">涨跌幅</span>
          <span class="h-right">涨跌额</span>
        </div>

        <!-- ✅ 内部滚动：展示全部股票，自选置顶且仅自选显示星星 -->
        <div class="fav-list scroll-hidden">
          <div
            v-for="s in allStockList"
            :key="s.code"
            class="row"
            :class="{ active: isStockRouteActive(s.code) }"
            @click="goStock(s.code)"
          >
            <div class="cell name">
              <!-- ✅ 这里保持和概念区一致：name-line + 仅自选显示星星 -->
              <div class="name-line">
                <el-tooltip :content="getFormattedName(s.name)" placement="top">
                  <div class="name-main">{{ getFormattedName(s.name) }}</div>
                </el-tooltip>

                <!-- ✅ 只标注自选股票 -->
                <span v-if="s.__fav" class="fav-star-btn">
                  <el-icon class="fav-star on" :size="10"><StarFilled /></el-icon>
                </span>
              </div>

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

          <div v-if="allStockList.length === 0" class="empty">
            暂无股票
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
import { ElMessage } from 'element-plus'

import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'

/** ✅ 如果你项目里是全局注册 icon，这两行可以删；不影响原逻辑，只是更完整可复制 */
import { HomeFilled, StarFilled, Tickets } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const conceptStore = useConceptStore()
const stockStore = useStockStore()

/** ✅ 顶部 tab：默认 concept */
const activeTopTab = ref('concept')

/** 处理路由 -> tab 同步 */
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

const getFormattedName = (name) => {
  if (name.length > 5) {
    return name.slice(0, 2) + '...' + name.slice(-2);
  }
  return name;
}

/** ✅ “全部概念”列表数据源（优先 conceptOverviewAll） */
const allConceptOverview = computed(() => {
  // if (activeTopTab.value === 'industry') {
  //   return conceptStore.industryOverviewAll || conceptStore.industryOverviewList || []
  // }
  return conceptStore.conceptOverviewAll || conceptStore.conceptOverviewList || []
})

/** ✅ 自选概念 id 集合 */
const favConceptIdSet = computed(() => {
  const list = Array.isArray(conceptStore.myConceptList) ? conceptStore.myConceptList : []
  const set = new Set()
  list.forEach(x => set.add(String(x?.id)))
  return set
})

/** ✅ 列表：自选置顶 + 标注 */
const topList = computed(() => {
  const raw = Array.isArray(allConceptOverview.value) ? allConceptOverview.value : []
  const favSet = favConceptIdSet.value

  // 映射需要显示的字段
  const list = raw.map((c, idx) => {
    const id = String(c?.id ?? '')
    const name = c?.name ?? id
    const change = Number(c?.change ?? 0)
    const netInflow = Number(c?.netInflow ?? 0)
    const __fav = favSet.has(id)
    return { ...c, id, name, change, netInflow, __fav, __idx: idx }
  }).filter(x => x.id)

  // 稳定排序：自选在前，其余保持原顺序
  return list.sort((a, b) => {
    if (a.__fav !== b.__fav) return a.__fav ? -1 : 1
    return a.__idx - b.__idx
  })
})

/** ✅ 切换自选：兼容不同的方法名 */
const toggleConceptFav = (concept) => {
  const id = String(concept?.id || '')
  if (!id) return

  if (typeof conceptStore.toggleFavorite === 'function') {
    conceptStore.toggleFavorite(id)
    return
  }

  const isFav = favConceptIdSet.value.has(id)
  if (isFav) {
    if (typeof conceptStore.removeConceptFromMyConcept === 'function') {
      conceptStore.removeConceptFromMyConcept(id)
    } else {
      ElMessage.warning('缺少取消自选方法')
    }
  } else {
    if (typeof conceptStore.addConceptToMyConcept === 'function') {
      conceptStore.addConceptToMyConcept({ id, name: concept?.name })
    } else {
      ElMessage.warning('缺少加入自选方法')
    }
  }
}

const normalizeCode = (raw) => {
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

/**
 * ✅ 你原来的：自选股票行情（保留，不删除）
 * 现在虽然模板不再用它渲染“股票自选”，但我不删，避免你项目其它地方引用
 */
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

/** ✅ 新增：展示全部股票 + 自选置顶 + 仅自选带星标 */
const favStockCodeSet = computed(() => {
  const set = new Set()
  ;(myStockCodesSafe.value || []).forEach(code => set.add(normalizeCode(code)))
  return set
})

const allStockList = computed(() => {
  const raw = Array.isArray(stockStore?.stockBaseList) ? stockStore.stockBaseList : []
  const favSet = favStockCodeSet.value

  const list = raw.map((s, idx) => {
    const code = normalizeCode(s?.code ?? '')
    const base = stockStore?.getStockBaseByCode?.(code) || { code, name: s?.name || code }
    const q = stockStore?.getStockByCodeEnriched?.(code) || {}
    const __fav = favSet.has(code)

    return {
      code,
      name: base?.name || q?.name || code,
      change: Number(q?.change ?? q?.changePercent ?? 0),
      changeAmount: Number(q?.changeAmount ?? 0),
      __fav,
      __idx: idx
    }
  }).filter(x => x.code)

  // ✅ 自选在前，其余保持原顺序
  return list.sort((a, b) => {
    if (a.__fav !== b.__fav) return a.__fav ? -1 : 1
    return a.__idx - b.__idx
  })
})

/** 总览按钮状态 */
const isActiveTop = computed(() => {
  const p = route.path || ''
  return (activeTopTab.value === 'concept' && p === '/home')
    || (activeTopTab.value === 'industry' && p === '/industry')
})

const goTopOverview = () => {
  router.push('/home')
}

/** 路由高亮判断 */
const isConceptRouteActive = (id) => {
  const sid = String(id)
  const p = route.path || ''
  return p === `/concept/${sid}` || p === `/my-concept/${sid}` || p === `/industry/${sid}`
}

const isStockRouteActive = (code) => {
  const c = normalizeCode(code)
  const p = route.path || ''
  return p === `/my-stocks/${c}` || p === `/stock/${c}`
}

/** 点击：概念/行业 */
const goConcept = (id) => {
  const sid = String(id)
  if (activeTopTab.value === 'industry') router.push(`/industry/${sid}`)
  else router.push(`/concept/${sid}`)
}

const goStock = (code) => router.push(`/my-stocks/${normalizeCode(code)}`)

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
  width: 220px; /* 固定 sidebar 宽度 */
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-right: 1px solid rgba(0,0,0,.06);
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
  font-weight: 600;
  color: #1f2d3d;
  white-space: nowrap;
}

/* ✅ 自选区：外层不滚动，给内部列表滚动空间 */
.fav-wrap{
  padding: 6px 10px 0;
  display: grid;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 卡片 */
.fav-card{
  background: #fff;
  border: 1px solid rgba(0,0,0,.06);
  border-radius: 8px;
  box-shadow: 0 6px 14px rgba(0,0,0,.06);
  overflow: hidden;

  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

/* 头部 */
.fav-head{
  height: 36px; /* 头部高度稍微压缩 */
  padding: 0 10px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0,0,0,.06);
  background: #fbfcfe;
  flex-shrink: 0;
}
.fav-title{
  display:flex;
  align-items:center;
  gap: 6px; /* 缩小间距 */
  font-size: 13px; /* 减小字体 */
  font-weight: 600; 
  color: #1f2d3d;
}
.fav-ic{ color:#2f80ed; font-size: 14px; }

.fav-table-head{
  height: 28px; /* 更小的表头 */
  padding: 0 10px;
  margin-top: 2px;
  display:grid;
  grid-template-columns: 1fr 50px 60px; /* 调整列宽 */
  align-items:center;
  color:#7a8699;
  font-size: 12px;
  font-weight: 800;
  background: #f7f9fc;
  border-bottom: 1px solid rgba(0,0,0,.04);
  flex-shrink: 0;
}
.h-mid, .h-right{ text-align:right; }
.h-name{ min-width: 0; }

.fav-list{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 6px 6px;
}

/* 行 */
.row{
  display:grid;
  grid-template-columns: 1fr 50px 60px; /* 缩小列宽 */
  align-items:center;
  padding: 8px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: .12s ease;
}
.row:hover{ background: rgba(47,128,237,.06); }
.row.active{
  background: rgba(47,128,237,.10);
  outline: 1px solid rgba(47,128,237,.16);
}

/* 名称行：标题 + 自选标签 + 星星 */
.name-line{
  display:flex;
  align-items:center;
  gap: 6px;
  min-width: 0;
}
.name-main{
  font-size: 12px; /* 减小字体 */
  font-weight: 800;
  color: #1f2d3d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
  min-width: 0;
}
.name-sub{
  margin-top: 2px;
  font-size: 9px;
  color: #98a2b3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 星星按钮 */
.fav-star-btn{
 margin-bottom: 3px;
 margin-left: -4px;
}

.fav-star.on{ color:#f59e0b; }
.fav-star-btn:hover .fav-star{
  transform: translateY(-1px);
  color:#f59e0b;
}

/* 数字 */
.cell.mid, .cell.right{ text-align:right; }
.num{
  font-size: 11px; /* 缩小字体 */
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  white-space: nowrap;
}
.arrow{
  font-size: 9px;
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