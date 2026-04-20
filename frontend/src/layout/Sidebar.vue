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
              <el-tab-pane label="自选概念" name="concept" />
              <el-tab-pane label="自选行业" name="industry" />
            </el-tabs>
          </div>
        </div>

        <div class="fav-list scroll-hidden">
          <div
            v-for="c in myConceptsEnriched"
            :key="c.id"
            class="fav-item"
            :class="{
              active: isConceptRouteActive(c.id),
              'has-alert': !!conceptAlertById(c.id),
              'has-alert-high': conceptAlertById(c.id)?.level === 'high'
            }"
            @click="goConcept(c.id)"
          >
            <div class="fav-main">
              <div class="fav-main-top">
                <div class="cell name">
                  <el-tooltip :content="c.name" placement="top" effect="dark">
                    <div class="name-main">{{ c.name }}</div>
                  </el-tooltip>
                  <el-tooltip
                    v-if="conceptAlertById(c.id)"
                    :content="conceptAlertText(c.id)"
                    placement="top-start"
                    effect="dark"
                  >
                    <div v-if="conceptAlertLines(c.id).length" class="alert-lines alert-lines--inline">
                      <div
                        v-for="line in conceptAlertLines(c.id)"
                        :key="`${c.id}-${line.code}`"
                        class="alert-chip"
                        :class="alertChipClass(line)"
                      >
                        {{ line.text }}
                      </div>
                    </div>
                  </el-tooltip>
                </div>
                <span v-if="c.editable" class="fav-tag">自定义</span>
              </div>

              <div class="fav-metrics">
                <div class="metric-row">
                  <span class="metric-label">涨跌幅</span>
                  <span class="num" :class="chgClass(c.change)">
                    <span class="arrow">{{ arrow(c.change) }}</span>
                    {{ fmtPctAbs(c.change) }}
                  </span>
                </div>

                <div class="metric-row">
                  <span class="metric-label">涨跌额</span>
                  <span class="num" :class="moneyClass(c.changeAmount)">
                    {{ fmtPriceSigned(c.changeAmount) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="fav-actions" @click.stop>
              <el-button class="btn-act" size="small" plain type="primary" @click="goConcept(c.id)">
                查看
              </el-button>
              <el-button
                v-if="c.editable"
                class="btn-act"
                size="small"
                plain
                @click="editConceptFromSidebar(c)"
              >
                编辑
              </el-button>
              <el-button
                class="btn-act"
                size="small"
                plain
                type="danger"
                @click="unfavoriteConcept(c)"
              >
                删除
              </el-button>
            </div>
          </div>

          <div v-if="myConceptsEnriched.length === 0" class="empty">
            暂无自选概念
          </div>
        </div>

        <div class="fav-foot">
          <el-button
            class="concept-stocks-entry"
            text
            @click="conceptStocksVisible = true"
          >
            <el-icon><Tickets /></el-icon>
            <span>成分股速览</span>
          </el-button>
        </div>
      </section>

      <!-- 自选股票 -->
      <section class="fav-card" id="tour-fav-stock">
        <div class="fav-head">
          <div class="fav-title">
            <el-icon class="fav-ic"><Tickets /></el-icon>
            <span class="stock-title-text">自选股票</span>
          </div>
          
         </div>

        <div class="fav-list scroll-hidden">
          <div
            v-for="s in myStockEnriched"
            :key="s.code"
            class="fav-item"
            :class="{
              active: isStockRouteActive(s.code),
              'has-alert': !!stockAlertByCode(s.code),
              'has-alert-high': stockAlertByCode(s.code)?.level === 'high'
            }"
            @click="goStock(s.code)"
          >
            <div class="fav-main">
              <div class="fav-main-top">
                <div class="cell name">
                  <el-tooltip :content="`${s.name} ${s.code || '--'}`" placement="top" effect="dark">
                    <div class="name-main">
                      <span class="name-main-text">{{ s.name }}</span>
                      <span class="name-inline-code">{{ s.code || '--' }}</span>
                    </div>
                  </el-tooltip>
                  <el-tooltip
                    v-if="stockAlertByCode(s.code)"
                    :content="stockAlertText(s.code)"
                    placement="top-start"
                    effect="dark"
                  >
                    <div v-if="stockAlertLines(s.code).length" class="alert-lines alert-lines--inline">
                      <div
                        v-for="line in stockAlertLines(s.code)"
                        :key="`${s.code}-${line.code}`"
                        class="alert-chip"
                        :class="alertChipClass(line)"
                      >
                        {{ line.text }}
                      </div>
                    </div>
                  </el-tooltip>
                </div>
              </div>

              <div class="fav-metrics">
                <div class="metric-row">
                  <span class="metric-label">涨跌幅</span>
                  <span class="num" :class="chgClass(s.change)">
                    <span class="arrow">{{ arrow(s.change) }}</span>
                    {{ fmtPctSigned(s.change) }}
                  </span>
                </div>

                <div class="metric-row">
                  <span class="metric-label">涨跌额</span>
                  <span class="num" :class="moneyClass(s.changeAmount)">
                    {{ fmtPriceSigned(s.changeAmount) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="fav-actions" @click.stop>
              <el-button class="btn-act" size="small" plain type="primary" @click="goStock(s.code)">
                查看
              </el-button>
              <el-button
                class="btn-act"
                size="small"
                plain
                type="danger"
                @click="unfavoriteStock(s.code)"
              >
                删除
              </el-button>
            </div>
          </div>

          <div v-if="myStockEnriched.length === 0" class="empty">
            暂无自选股票
          </div>
        </div>
      </section>
    </div>

    <div class="pad" />

    <ConceptEditorDrawer
      v-model="conceptDrawerVisible"
      :editing="editingConcept"
      mode="dialog"
      @saved="saveConceptEdit"
    />

    <el-dialog
      v-model="conceptStocksVisible"
      title="自选概念成分股"
      width="min(980px, 92vw)"
      destroy-on-close
      class="concept-stocks-dialog"
    >
      <div class="concept-stocks-shell scroll-hidden">
        <div v-if="favoriteConceptStockSections.length" class="concept-stock-split">
          <aside class="concept-stock-sidebar">
            <div
              v-for="section in favoriteConceptStockSections"
              :key="section.id"
              class="concept-nav-item"
              :class="{ active: selectedConceptStockSectionId === String(section.id) }"
              @click="selectConceptStockSection(section.id)"
            >
              <div class="concept-nav-main">
                <el-icon class="concept-stock-arrow"><ArrowRight /></el-icon>
                <span class="concept-stock-name">{{ section.name }}</span>
              </div>
              <div class="concept-nav-meta">
                <span class="concept-stock-meta">{{ section.stocks.length }} 支</span>
                <span v-if="section.editable" class="concept-stock-tag">自定义</span>
              </div>
            </div>
          </aside>

          <section v-if="selectedConceptStockSection" class="concept-stock-detail">
            <div class="concept-stock-head">
              <div class="concept-stock-title">
                <span class="concept-stock-name">{{ selectedConceptStockSection.name }}</span>
                <span class="concept-stock-meta">{{ selectedConceptStockSection.stocks.length }} 支</span>
                <span v-if="selectedConceptStockSection.editable" class="concept-stock-tag">自定义</span>
              </div>
            </div>

            <div class="concept-stock-list">
              <div
                v-for="row in selectedConceptStockSection.stocks"
                :key="`${selectedConceptStockSection.id}-${row.code}`"
                class="concept-stock-row"
              >
                <div class="concept-stock-main" @click="goStock(row.code)">
                  <div class="concept-stock-main-top">
                    <span class="concept-stock-row-name">{{ row.name }}</span>
                    <span class="concept-stock-row-code">{{ row.code }}</span>
                  </div>
                  <div class="concept-stock-metrics">
                    <span class="metric-inline" :class="chgClass(row.change)">
                      {{ fmtPctSigned(row.change) }}
                    </span>
                    <span class="metric-inline" :class="moneyClass(row.changeAmount)">
                      {{ fmtPriceSigned(row.changeAmount) }}
                    </span>
                    <span class="metric-inline metric-inline--price">
                      {{ fmtPrice(row.price) }}
                    </span>
                  </div>
                </div>

                <div class="concept-stock-actions">
                  <el-tooltip :content="stockStore.isStockFavorite(row.code) ? '取消收藏' : '收藏股票'" placement="top" effect="dark">
                    <el-button
                      link
                      class="op-icon-btn op-icon-btn--cancel"
                      @click.stop="toggleStockFavorite(row.code)"
                    >
                      <el-icon class="icon-fav"><StarFilled v-if="stockStore.isStockFavorite(row.code)" /><Star v-else /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip v-if="selectedConceptStockSection.editable" content="从概念中删除" placement="top" effect="dark">
                    <el-button
                      link
                      class="op-icon-btn op-icon-btn--edit"
                      @click.stop="removeStockFromConcept(selectedConceptStockSection, row.code)"
                    >
                      <el-icon class="icon-edit"><Delete /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div v-else class="empty">暂无自选概念成分股</div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'LeftSidebar'
}
</script>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { useHomeFilterStore } from '@/stores/homeFilter'
import { useAlertCenterStore } from '@/stores/alertCenter'
import { HomeFilled, Tickets, StarFilled, Star, Delete, ArrowRight } from '@element-plus/icons-vue'
import ConceptEditorDrawer from '@/components/ConceptEditorDrawer.vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const conceptStore = useConceptStore()
const stockStore = useStockStore()
const homeFilter = useHomeFilterStore()
const alertCenter = useAlertCenterStore()

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

/** ✅ 自选概念统一从 conceptStore 实时快照读取，避免被多接口反复覆盖 */
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
      changeAmount: ov.changeAmount ?? c.changeAmount ?? null,

      // 兼容字段
      change5d: ov.change5d ?? ov.rtChange5d ?? ov.change5m ?? ov.change ?? 0,
      netInflow5d: ov.netInflow5d ?? ov.rtNetInflow ?? ov.netInflow ?? 0
    }
  })
})

function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH)$/i, '')
  s = s.replace(/^(sz|sh)/i, '')
  return s
}

/** 自选股票：名称/代码 + 涨跌幅/涨跌额 */
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

const latestAlertByTarget = computed(() => alertCenter.latestAlertByTarget || {})
const stockAlertByCode = (code) => latestAlertByTarget.value[`stock:${normalizeCode(code)}`] || null
const conceptAlertById = (id) => latestAlertByTarget.value[`concept:${String(id)}`] || null
const formatAlertText = (alert) => {
  if (!alert) return ''
  const lines = Array.isArray(alert.items) ? alert.items.map(item => item.text).filter(Boolean) : []
  return lines.length ? lines.join('；') : (alert.summary || '')
}
const stockAlertText = (code) => formatAlertText(stockAlertByCode(code))
const conceptAlertText = (id) => formatAlertText(conceptAlertById(id))
const shortenAlertText = (item) => {
  const text = String(item?.text || '')
  if (text === 'price-up') return '价格变涨'
  if (text === 'price-down') return '价格转跌'
  return text
}
const buildAlertLines = (alert) => {
  const items = Array.isArray(alert?.items) ? alert.items : []
  if (!items.length) return []
  return items.slice(0, 2).map(item => ({
    code: item.code,
    level: item.level || 'medium',
    text: shortenAlertText(item)
  }))
}
const stockAlertLines = (code) => buildAlertLines(stockAlertByCode(code))
const conceptAlertLines = (id) => buildAlertLines(conceptAlertById(id))
const isDownAlertText = (text) => /转跌|跌停|走弱|流出|下降|下跌/.test(String(text || ''))
const alertChipClass = (line) => {
  if (isDownAlertText(line?.text)) return 'alert-chip--down'
  return `alert-chip--${line?.level || 'medium'}`
}

watch(
  [myConceptsEnriched, myStockEnriched],
  () => {
    alertCenter.scanAll()
  },
  { immediate: true, deep: true }
)

const conceptDrawerVisible = ref(false)
const conceptStocksVisible = ref(false)
const selectedConceptStockSectionId = ref('')
const editingConcept = ref(null)

const favoriteConceptStockSections = computed(() => {
  return myConceptsEnriched.value.map((concept) => {
    const codes = (Array.isArray(concept.stockCodes) ? concept.stockCodes : [])
      .map(item => normalizeCode(typeof item === 'object' ? item?.code : item))
      .filter(Boolean)

    const stocks = codes
      .map((code) => {
        const base = stockStore.getStockBaseByCode?.(code)
        const q = stockStore.getStockByCodeEnriched?.(code, concept.name || '')
        return {
          code,
          name: base?.name || q?.name || code,
          price: Number(q?.price ?? q?.close ?? 0),
          change: Number(q?.change ?? q?.changePercent ?? 0),
          changeAmount: Number(q?.changeAmount ?? 0)
        }
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change)))

    return {
      id: concept.id,
      name: concept.name,
      editable: !!concept.editable,
      stocks
    }
  })
})

watch(
  [conceptStocksVisible, favoriteConceptStockSections],
  ([visible, sections]) => {
    if (!visible) return
    const ids = (sections || []).map(section => String(section.id))
    if (!ids.length) {
      selectedConceptStockSectionId.value = ''
      return
    }
    if (!ids.includes(String(selectedConceptStockSectionId.value))) {
      selectedConceptStockSectionId.value = ids[0]
    }
  },
  { immediate: true, deep: true }
)

const selectedConceptStockSection = computed(() => {
  return favoriteConceptStockSections.value.find(section => String(section.id) === String(selectedConceptStockSectionId.value)) || null
})
const selectConceptStockSection = (id) => {
  selectedConceptStockSectionId.value = String(id)
}

const unfavoriteConcept = (concept) => {
  if (!concept?.id) return
  conceptStore.removeConceptFromMyConcept?.(concept.id)
}

const unfavoriteStock = (code) => {
  const c = normalizeCode(code)
  if (!c) return
  stockStore.removeStockFromMyStocks?.(c)
}

const toggleStockFavorite = (code) => {
  const c = normalizeCode(code)
  if (!c) return
  if (stockStore.isStockFavorite?.(c)) stockStore.removeStockFromMyStocks?.(c)
  else stockStore.addStockToMyStocks?.(c)
}

const removeStockFromConcept = (section, code) => {
  if (!section?.editable) return
  const concept = conceptStore.getConceptById?.(section.id)
  if (!concept) return
  const nextStockCodes = (Array.isArray(concept.stockCodes) ? concept.stockCodes : [])
    .map(item => typeof item === 'object' ? item?.code : item)
    .map(normalizeCode)
    .filter(itemCode => itemCode && itemCode !== normalizeCode(code))

  conceptStore.updateUserConcept?.({
    ...concept,
    id: concept.id,
    stockCodes: nextStockCodes
  })
  ElMessage.success('已从概念中删除成分股')
}

const editConceptFromSidebar = (concept) => {
  if (!concept?.editable) return
  editingConcept.value = {
    id: String(concept.id),
    name: concept.name || '',
    description: concept.description || '',
    stockCodes: Array.isArray(concept.stockCodes) ? concept.stockCodes : [],
    algorithm: concept.algorithm || '',
    editable: true,
    favorite: !!concept.favorite
  }
  conceptDrawerVisible.value = true
}

const saveConceptEdit = (conceptData) => {
  if (!editingConcept.value?.id) return
  const prev = conceptStore.getConceptById?.(editingConcept.value.id)
  conceptStore.updateUserConcept?.({
    ...conceptData,
    id: editingConcept.value.id,
    editable: true,
    favorite: prev?.favorite ?? true
  })
  conceptDrawerVisible.value = false
  editingConcept.value = null
  ElMessage.success('已更新概念')
}

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
  alertCenter.markTargetRead('concept', sid)
  if (activeTopTab.value === 'industry') router.push(`/industry/${sid}`)
  else router.push(`/concept/${sid}`) // ✅ 主路由
  // else router.push(`/my-concept/${sid}`) // 兼容备选
}

const goStock = (code) => {
  const c = normalizeCode(code)
  alertCenter.markTargetRead('stock', c)
  conceptStocksVisible.value = false
  router.push(`/my-stocks/${c}`)
}

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
const fmtPrice = (v) => {
  const n = Number(v)
  if (Number.isNaN(n) || !n) return '--'
  return n.toFixed(2)
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

.top-tabs{
  width: 100%;
  flex: 1 1 auto;
}
.top-tabs :deep(.el-tabs__header){
  margin: 0;
  width: 100%;
}
.top-tabs :deep(.el-tabs__nav-wrap){
  padding: 0;
}
.top-tabs :deep(.el-tabs__nav){
  display: flex;
  width: 100%;
}
.top-tabs :deep(.el-tabs__item){
  flex: 0 0 50%;
  max-width: 50%;
  justify-content: center;
  text-align: center;
  padding: 8px 4px 9px;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #1f2d3d;
}
.top-tabs :deep(.el-tabs__item.is-active){
  color: #2f80ed;
}
.top-tabs :deep(.el-tabs__item:hover){
  color: #2f80ed;
}
.top-tabs :deep(.el-tabs__active-bar){
  height: 3px;
  border-radius: 3px;
  background-color: #409eff;
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
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.13);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: .12s ease;
}
.quick-item:hover{
  background: #ffffff;
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
  --concept-card-height: 400px;
  --stock-card-height: 400px;
  padding: 4px 8px 0;
  display: grid;
  grid-template-rows: var(--concept-card-height) var(--stock-card-height);
  gap: 10px;
  align-content: start;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}


/* 卡片 */
.fav-card{
  background: #fff;
  border: 1px solid #d8e1ec;
  border-radius: 8px;
  box-shadow: 0 1px 0 rgba(255,255,255,.88), 0 3px 8px rgba(15,23,42,.04);
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
  border-bottom: 1px solid #dfe7f1;
  background: #ffffff;
  flex-shrink: 0;
}
.fav-title{
  display:flex;
  align-items:center;
  gap: 0;
  flex: 1 1 auto;
  width: 100%;
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}
.fav-ic{ color:#2f80ed; font-size: 16px; }
.stock-title-text{ margin-left: 4px; }

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
.fav-list{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fav-foot{
  flex-shrink: 0;
  padding: 8px 10px 10px;
  border-top: 1px solid #e8eef7;
  background: #fcfdff;
}
.concept-stocks-entry{
  width: 100%;
  justify-content: center;
  gap: 6px;
  color: #2f80ed;
  font-size: 12px;
  font-weight: 700;
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(47, 128, 237, .06);
}
.concept-stocks-entry:hover{
  background: rgba(47, 128, 237, .12);
}

/* 卡片 */
.fav-item{
  background:#fff;
  border-radius: 12px;
  border: 1px solid rgba(148,163,184,.24);
  box-shadow: 0 6px 12px rgba(15,23,42,.04);
  min-height: 126px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: .12s ease;
  box-sizing: border-box;
  overflow: hidden;
}
.fav-item:hover{
  border-color: rgba(64,158,255,.24);
  box-shadow: 0 10px 18px rgba(15,23,42,.08);
}
.fav-item.active{
  box-shadow: inset 0 0 0 1px rgba(64,158,255,.28);
  background: rgba(47,128,237,.03);
}
.fav-item.signal-buy{
  border-left: 3px solid rgba(245,108,108,.72);
}
.fav-item.signal-sell{
  border-left: 3px solid rgba(103,194,58,.8);
}
.fav-main{
  flex: 1 1 auto;
  min-height: 0;
  padding: 10px 10px 8px;
}
.fav-main-top{
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.fav-tag{
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  color: #0f766e;
  background: rgba(45,212,191,.12);
  border: 1px solid rgba(45,212,191,.34);
}
.fav-metrics{
  margin-top: 8px;
  display: grid;
  gap: 6px;
}
.metric-row{
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
}
.metric-label{
  font-size: 12px;
  color: #607d8b;
  font-weight: 700;
  white-space: nowrap;
}
.fav-actions{
  border-top: 1px dashed rgba(148,163,184,.32);
  padding: 8px;
  display:flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: flex-end;
}
.btn-act{
  height: 26px !important;
  width: auto;
  padding: 0 8px !important;
  border-radius: 10px !important;
  font-weight: 700;
  font-size: 12px;
}

/* 名称 */
.name-main{
  font-size: 14px;
  font-weight: 900;
  color: #1f2d3d;
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  min-width: 0;
  max-width: 100%;
}
.name-main-text{
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name-inline-code{
  flex: 0 0 auto;
  font-size: 11px;
  color: #6f7f99;
  font-weight: 700;
  letter-spacing: .2px;
}
.name-sub{
  margin-top: 3px;
  font-size: 10px;
  color: #6f7f99;
  font-weight: 700;
  letter-spacing: .2px;
  line-height: 1.2;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.alert-lines{
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  min-width: 0;
}
.alert-lines--inline{
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  overflow: hidden;
}
.alert-chip{
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  width: fit-content;
  max-width: none;
  min-width: fit-content;
  padding: 0;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.45;
  white-space: nowrap;
  overflow: visible;
}
.alert-chip--medium{
  color: #b26a00;
}
.alert-chip--high{
  color: #f56c6c;
}
.alert-chip--down{
  color: #67c23a;
}
.alert-chip--strategy{
  color: #f56c6c;
}

/* 数字 */
.cell.name{
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  min-width: 0;
}
.op-icon-btn{
  margin: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all .12s ease;
}
.op-icon-btn :deep(.el-icon){
  font-size: 13px;
}
.op-icon-btn--cancel{
  background: rgba(230, 162, 60, .10);
  border-color: rgba(230, 162, 60, .28);
}
.op-icon-btn--cancel:hover{
  background: rgba(230, 162, 60, .18);
  border-color: rgba(230, 162, 60, .42);
}
.op-icon-btn--edit{
  background: rgba(64, 158, 255, .10);
  border-color: rgba(64, 158, 255, .30);
}
.op-icon-btn--edit:hover{
  background: rgba(64, 158, 255, .18);
  border-color: rgba(64, 158, 255, .45);
}
.icon-fav{
  color: var(--el-color-warning);
}
.icon-edit{
  color: var(--el-color-primary);
}
.num{
  font-size: 12px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.strategy-hint{
  font-size: 11px;
  font-weight: 800;
  color: #409eff;
  background: rgba(64,158,255,.08);
  border: 1px solid rgba(64,158,255,.25);
  border-radius: 999px;
  padding: 2px 8px;
}

.pad{ height: 10px; flex-shrink: 0; }

.concept-stocks-shell{
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 2px;
}
.concept-stock-split{
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  min-height: 56vh;
}
.concept-stock-sidebar{
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #f7faff;
  padding: 8px;
  overflow-y: auto;
}
.concept-nav-item{
  padding: 10px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: .12s ease;
}
.concept-nav-item + .concept-nav-item{
  margin-top: 6px;
}
.concept-nav-item:hover{
  background: rgba(47,128,237,.06);
}
.concept-nav-item.active{
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(64,158,255,.22);
}
.concept-nav-main{
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.concept-nav-meta{
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 21px;
}
.concept-stock-detail{
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  min-width: 0;
}
.concept-stock-head{
  padding: 10px 12px;
  border-bottom: 1px solid #e6edf6;
  background: #f7faff;
}
.concept-stock-title{
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.concept-stock-arrow{
  font-size: 13px;
  color: #7b8aa3;
  flex-shrink: 0;
}
.concept-stock-name{
  font-size: 14px;
  font-weight: 800;
  color: #1f2d3d;
}
.concept-stock-meta{
  font-size: 12px;
  color: #70819b;
}
.concept-stock-tag{
  font-size: 11px;
  color: #409eff;
  background: rgba(64, 158, 255, .10);
  padding: 2px 6px;
  border-radius: 999px;
}
.concept-stock-list{
  display: grid;
}
.concept-stock-row{
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
}
.concept-stock-row + .concept-stock-row{
  border-top: 1px solid #eef3f9;
}
.concept-stock-main{
  min-width: 0;
  cursor: pointer;
}
.concept-stock-main-top{
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.concept-stock-row-name{
  font-size: 13px;
  font-weight: 800;
  color: #1f2d3d;
}
.concept-stock-row-code{
  font-size: 12px;
  color: #6f7f99;
}
.concept-stock-metrics{
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.metric-inline{
  font-size: 12px;
  font-weight: 700;
}
.metric-inline--price{
  color: #5d6b82;
}
.concept-stock-actions{
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>


