<template>
  <!-- ✅ 给整体加一个锚点：用于新手教程聚焦“新闻条” -->
  <div class="newsbar" id="tour-news">
    <div class="col newsbar-single">
      <div class="badge">
        <span class="dot" :class="{ dot2: isConceptDetailRoute }"></span>
        <span class="label">{{ singleBarLabel }}</span>
      </div>

      <div class="ticker" id="tour-news-open-dynamic" @click="openDetail(currentHeadline)">
        <span class="title" :title="currentHeadline?.title || ''">
          {{ currentHeadline?.title || emptyTickerText }}
        </span>
        <span class="meta" v-if="currentHeadline">
          {{ currentHeadline.source }} · {{ formatTime(currentHeadline.time) }}
        </span>
      </div>

      <el-tooltip content="查看列表" placement="top" effect="dark">
        <el-button
          id="tour-news-list"
          class="list-btn"
          text
          circle
          @click.stop="openListDialog"
          aria-label="open news list"
        >
          <el-icon><List /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <!-- ✅ 新闻详情弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      width="810px"
      class="news-detail-dialog"
      draggable
      append-to-body
    >
      <template #header>
        <div class="nd-head">
          <div class="nd-title" :title="current?.title || ''">
            {{ current?.title || '新闻详情' }}
          </div>

          <div class="nd-sub">
            <el-tag size="small" effect="plain" type="info" class="nd-tag">
              {{ current?.displayCategory || current?.category || '新闻' }}
            </el-tag>

            <el-tag
              v-if="current?.sourceDetail && current.sourceDetail !== current.source"
              size="small"
              effect="plain"
              class="nd-tag"
            >
              {{ current.sourceDetail }}
            </el-tag>

            <template v-if="detailStocks.length">
              <el-tag
                v-for="code in detailStocks"
                :key="code"
                size="small"
                effect="plain"
                class="nd-tag nd-tag-stock"
              >
                {{ code }}
              </el-tag>
            </template>

            <span class="nd-meta" v-if="current?.source">{{ current.source }}</span>
            <span class="nd-dot" v-if="current?.time">·</span>
            <span class="nd-meta" v-if="current?.time">{{ current.time }}</span>
          </div>
        </div>
      </template>

      <div v-if="current" class="nd-body">
        <div class="nd-card" v-if="current.brief">
          <div class="nd-card-title">摘要</div>
          <div class="nd-brief">{{ current.brief }}</div>
        </div>

        <div
          class="nd-grid"
          v-if="(current.keyPoints?.length || 0) + (current.whatToWatch?.length || 0) > 0"
        >
          <div class="nd-card" v-if="Array.isArray(current.keyPoints) && current.keyPoints.length">
            <div class="nd-card-title">要点</div>
            <ul class="nd-list">
              <li v-for="(x, i) in current.keyPoints" :key="i">{{ x }}</li>
            </ul>
          </div>

          <div class="nd-card" v-if="Array.isArray(current.whatToWatch) && current.whatToWatch.length">
            <div class="nd-card-title">关注点</div>
            <ul class="nd-list">
              <li v-for="(x, i) in current.whatToWatch" :key="i">{{ x }}</li>
            </ul>
          </div>
        </div>

        <div class="nd-content" v-if="detailHtml" v-html="detailHtml"></div>
        <div class="nd-content" v-else>
          <p v-for="(p, idx) in (current.content || [])" :key="idx">{{ p }}</p>
        </div>
      </div>

      <template #footer>
        <div class="nd-footer-wrap">
          <div v-if="relatedConceptCards.length" class="nd-related">
            <div class="nd-related-title">关联概念</div>
            <div class="nd-related-list">
              <div
                v-for="card in relatedConceptCards"
                :key="card.id"
                class="nd-related-card"
              >
                <div class="nd-related-main">
                  <div class="nd-related-name">{{ card.name }}</div>
                  <div class="nd-related-metrics">
                    <span class="nd-related-change" :class="changeClass(card.change)">
                      {{ formatSigned(card.change) }}
                    </span>
                    <span class="nd-related-rate" :class="changeClass(card.change)">
                      {{ formatPercent(card.changePercent) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="nd-footer">
          <!-- ✅ 新手教程：讲“查看相关概念（联动）” -->
            <el-button
              v-if="(current?.conceptIds || []).length"
              id="tour-news-apply"
              type="primary"
              plain
              class="nd-apply"
              @click="applyRelatedConcepts"
            >
              查看相关概念
            </el-button>

          <!-- ✅ 新手教程：讲“清空新闻关联（恢复）” -->
            <el-button class="nd-close" @click="dialogVisible = false">关闭</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="listDialogVisible"
      :title="drawerTitle"
      width="760px"
      class="news-list-dialog"
      append-to-body
      draggable
    >
      <div v-if="showConceptFilter" class="drawer-filter-bar">
        <el-select
          v-model="drawerConceptFilter"
          size="small"
          clearable
          filterable
          placeholder="筛选概念"
          class="drawer-filter-select"
        >
          <el-option
            v-for="item in conceptFilterOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <!-- ✅ 新手教程：抽屉列表区域锚点 -->
      <div class="drawer-list scroll-hidden" id="tour-news-drawer">
        <div
          v-for="(n, i) in drawerList"
          :key="n.id || i"
          class="drawer-item"
          @click="openFromList(i)"
        >
          <div class="di-title">
            <span class="di-dot" :class="{ d2: isConceptDetailRoute }"></span>
            <span class="di-text" :title="n.title">{{ n.title }}</span>
          </div>

          <div class="di-concepts" v-if="conceptChips(n).length" @click.stop>
            <span v-for="c in conceptChips(n)" :key="c.id" class="di-chip">
              {{ c.name }}
            </span>
          </div>

          <div class="di-meta">
            <span>{{ n.source }}</span>
            <span class="sep">·</span>
            <span>{{ formatTime(n.time) }}</span>
          </div>
        </div>

        <div v-if="drawerList.length === 0" class="drawer-empty">暂无数据</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, defineEmits, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { List } from '@element-plus/icons-vue'
import { useNewsStore } from '@/stores/news'
import { useConceptStore } from '@/stores/concept'
import { useHomeFilterStore } from '@/stores/homeFilter'

/**
 * ✅ 兼容旧主界面：仍然 emit 这两个事件
 * - apply-concept-filter(payload: string[])
 * - clear-concept-filter()
 */
const emit = defineEmits(['apply-concept-filter', 'clear-concept-filter'])

const newsStore = useNewsStore()
const conceptStore = useConceptStore()
const homeFilter = useHomeFilterStore()
const route = useRoute()
const router = useRouter()

const isConceptDetailRoute = computed(() => {
  const path = route.path || ''
  return path.startsWith('/concept/') || path.startsWith('/my-concept/')
})

const routeConceptId = computed(() => {
  if (!isConceptDetailRoute.value) return ''
  return String(route.params.id || '')
})

const policyIdx = ref(0)
const dynamicIdx = ref(0)

const currentPolicy = computed(() => {
  const list = isConceptDetailRoute.value ? currentConceptNews.value : (newsStore.policyNews || [])
  if (!list.length) return null
  return list[mod(policyIdx.value, list.length)]
})

const currentDynamic = computed(() => {
  const list = currentDynamicPool.value
  if (!list.length) return null
  return list[mod(dynamicIdx.value, list.length)]
})

const currentHeadline = computed(() => {
  return isConceptDetailRoute.value ? currentDynamic.value : currentPolicy.value
})

const currentConceptNews = computed(() => {
  const id = routeConceptId.value || newsStore.currentConceptId || newsStore.context?.conceptId
  if (!id) return []
  return (newsStore.allNews || []).filter(item => (item.conceptIds || []).includes(String(id)))
})

const currentDynamicPool = computed(() => {
  return isConceptDetailRoute.value ? currentConceptNews.value : (newsStore.dynamicNews || [])
})

const routeConceptName = computed(() => {
  const id = routeConceptId.value
  if (!id) return ''
  return conceptNameById(id) || id
})

const leftLabel = computed(() => {
  if (isConceptDetailRoute.value) return routeConceptName.value || '概念新闻'
  return newsStore.leftLabel || '要闻'
})

const singleBarLabel = computed(() => {
  return isConceptDetailRoute.value ? rightLabel.value : leftLabel.value
})

const rightLabel = computed(() => {
  if (isConceptDetailRoute.value) return routeConceptName.value || '概念新闻'
  const cid = newsStore.currentConceptId || newsStore.context?.conceptId
  const name = conceptNameById(cid)
  return `概念 · ${name || '—'}`
})

const emptyTickerText = computed(() => {
  return isConceptDetailRoute.value
    ? `暂无${routeConceptName.value || '该概念'}相关新闻`
    : '暂无相关新闻'
})

let timer = null
onMounted(() => {
  if (typeof newsStore.refreshDynamicNews === 'function') {
    if (!newsStore.dynamicNews?.length) newsStore.refreshDynamicNews()
  }
  timer = window.setInterval(() => {
    if (newsStore.policyNews?.length) policyIdx.value += 1
    if (newsStore.dynamicNews?.length) dynamicIdx.value += 1
  }, 3500)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})

watch(
  () => newsStore.context?.conceptId,
  () => {
    if (isConceptDetailRoute.value) return
    if (typeof newsStore.refreshDynamicNews === 'function') newsStore.refreshDynamicNews()
    dynamicIdx.value = 0
  }
)

watch(
  routeConceptId,
  value => {
    if (!value) return
    if (typeof newsStore.setConceptId === 'function') newsStore.setConceptId(String(value))
    policyIdx.value = 0
    dynamicIdx.value = 0
  },
  { immediate: true }
)

/** 详情弹窗 */
const dialogVisible = ref(false)
const current = ref(null)

function openDetail(item) {
  if (!item) return
  current.value = item
  dialogVisible.value = true
}

const detailStocks = computed(() => {
  return (current.value?.relatedStocks || current.value?.stockCodes || []).filter(Boolean)
})

const detailHtml = computed(() => {
  return String(current.value?.contentHtml || '').trim()
})

const relatedConceptCards = computed(() => {
  const ids = Array.from(new Set((current.value?.conceptIds || []).map(id => String(id)).filter(Boolean)))
  if (!ids.length) return []
  const pool = conceptStore.conceptOverviewAll || []
  return ids
    .map(id => {
      const hit = pool.find(item => String(item.id) === id)
      if (!hit) return null
      const change = Number(hit.change ?? hit.rtChange ?? 0)
      return {
        id,
        name: hit.name || id,
        change,
        changePercent: change,
      }
    })
    .filter(Boolean)
})

async function applyRelatedConcepts() {
  const idsRaw = (current.value?.conceptIds || []).filter(Boolean)
  if (!idsRaw.length) return

  // ✅ 统一成 string，避免 number/string 不匹配导致“筛不到”
  const uniq = Array.from(new Set(idsRaw.map(x => String(x))))

  // ✅ 写入 store，让 Home 自动联动筛选
  homeFilter.newsConceptIds = uniq

  // ✅ 兼容 emit（如果你某些页面还在监听）
  emit('apply-concept-filter', uniq)

  // ✅ 让动态新闻联动到第一个概念
  if (uniq.length && typeof newsStore.setConceptId === 'function') {
    newsStore.setConceptId(uniq[0])
  }

  dialogVisible.value = false
  if (router.currentRoute.value.path !== '/home') {
    await router.push({ path: '/home' })
  }
}

/** 列表弹窗 */
const listDialogVisible = ref(false)
const drawerConceptFilter = ref('')

const conceptFilterOptions = computed(() => {
  const ids = new Set()
  ;(newsStore.allNews || []).forEach(item => {
    (item.conceptIds || []).forEach(id => {
      if (id) ids.add(String(id))
    })
  })
  return Array.from(ids)
    .map(id => ({ value: id, label: conceptNameById(id) || id }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))
})

const filteredAllNews = computed(() => {
  const list = newsStore.allNews || []
  const conceptId = drawerConceptFilter.value ? String(drawerConceptFilter.value) : ''
  if (!conceptId) return list
  return list.filter(item => (item.conceptIds || []).includes(conceptId))
})

const showConceptFilter = computed(() => !isConceptDetailRoute.value)

const drawerTitle = computed(() => {
  if (isConceptDetailRoute.value) {
    return `${routeConceptName.value || '概念'}新闻`
  }
  return '新闻列表'
})

const drawerList = computed(() => {
  if (isConceptDetailRoute.value) return currentConceptNews.value
  return filteredAllNews.value
})

function openListDialog() {
  listDialogVisible.value = true
}

function openFromList(i) {
  const list = drawerList.value || []
  const item = list[i]
  if (!item) return
  if (isConceptDetailRoute.value) {
    policyIdx.value = i
    dynamicIdx.value = i
  } else {
    policyIdx.value = i
  }
  listDialogVisible.value = false
  openDetail(item)
}

function conceptChips(newsItem) {
  const ids = (newsItem?.conceptIds || []).filter(Boolean)
  return ids.map(id => ({ id: String(id), name: conceptNameById(id) || String(id) }))
}

/** utils */
function mod(n, m) {
  if (!m) return 0
  return ((n % m) + m) % m
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return String(t)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

function formatSigned(v) {
  const n = Number(v || 0)
  if (n > 0) return `+${n.toFixed(2)}`
  if (n < 0) return n.toFixed(2)
  return '0.00'
}

function formatPercent(v) {
  const n = Number(v || 0)
  if (n > 0) return `+${n.toFixed(2)}%`
  if (n < 0) return `${n.toFixed(2)}%`
  return '0.00%'
}

function changeClass(v) {
  const n = Number(v || 0)
  if (n > 0) return 'up'
  if (n < 0) return 'down'
  return 'flat'
}

function conceptNameById(id) {
  if (!id) return ''
  const sid = String(id)

  const sys = conceptStore.getConceptById?.(sid) || conceptStore.getConceptById?.(id)
  if (sys?.name) return sys.name

  const fav = conceptStore.getMyConceptById?.(sid) || conceptStore.getMyConceptById?.(id)
  if (fav?.name) return fav.name

  const user = (conceptStore.userConcepts || []).find(x => String(x.id) === sid)
  if (user?.name) return user.name

  return ''
}
</script>

<style scoped>
.newsbar{
  height:40px; min-height:40px; max-height:40px;
  display:flex; align-items:center; gap:8px;
  background:#fff; border:1px solid rgba(0,0,0,.06);
  border-radius:10px; box-shadow:0 10px 24px rgba(0,0,0,.04);
  overflow:hidden;
}
.col{ height:40px; display:flex; align-items:center; gap:8px; flex:1; min-width:0; padding:0 10px;}
.newsbar-single{ width:100%; padding-right:6px; }
.badge{ display:flex; align-items:center; gap:6px; flex-shrink:0; font-weight:900; color:#303133; font-size:12px;}
.dot{ width:7px; height:7px; border-radius:999px; background:rgba(64,158,255,.9);}
.dot2{ background:rgba(103,194,58,.95);}
.label{ white-space:nowrap;}
.ticker{ flex:1; min-width:0; display:flex; align-items:center; gap:6px; cursor:pointer;}
.title{ font-size:12px; font-weight:800; color:#303133; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.meta{ flex-shrink:0; font-size:12px; color:#909399; white-space:nowrap;}
.list-btn{ width:28px; height:28px; padding:0 !important; border-radius:8px; flex-shrink:0;}
.list-btn:hover{ background:rgba(47,128,237,.08);}

/* hide scrollbar */
.scroll-hidden{ scrollbar-width:none; -ms-overflow-style:none;}
.scroll-hidden::-webkit-scrollbar{ width:0; height:0;}

.drawer-tabs :deep(.el-tabs__header){ margin:0 0 8px 0;}
.drawer-filter-bar{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  margin:0 0 8px 0;
}
.drawer-filter-select{
  width:180px;
}
.drawer-list{ height:520px; overflow-y:auto; padding:6px 2px 10px;}
.drawer-item{
  padding:10px 10px; border-radius:10px; border:1px solid rgba(0,0,0,.06);
  background:#fff; box-shadow:0 6px 14px rgba(0,0,0,.04);
  cursor:pointer; transition:.12s ease; margin-bottom:10px;
}
.drawer-item:hover{
  transform:translateY(-1px);
  border-color:rgba(47,128,237,.18);
  box-shadow:0 12px 24px rgba(0,0,0,.06);
}
.di-title{ display:flex; align-items:center; gap:8px; min-width:0;}
.di-dot{ width:8px; height:8px; border-radius:999px; background:rgba(64,158,255,.9); flex-shrink:0;}
.di-dot.d2{ background:rgba(103,194,58,.95);}
.di-text{ font-size:13px; font-weight:900; color:#1f2d3d; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.di-concepts{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;}
.di-chip{
  display:inline-flex; align-items:center; padding:3px 8px; border-radius:999px;
  border:1px solid rgba(64,158,255,.18);
  background:rgba(64,158,255,.06);
  color:#409eff; font-size:12px; font-weight:900;
}
.di-meta{ margin-top:8px; font-size:12px; color:#909399; display:flex; gap:6px;}
.sep{ opacity:.6;}
.drawer-empty{ padding:16px 10px; color:#b0b4bb; font-size:12px; text-align:center;}

.news-list-dialog :deep(.el-dialog){
  height:680px;
  max-height:680px;
  border-radius:14px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
}
.news-list-dialog :deep(.el-dialog__body){
  padding:14px 18px 16px;
  flex:1 1 auto;
  overflow:hidden;
}

.news-detail-dialog :deep(.el-dialog){
  width:810px !important; min-width:810px; max-width:810px; height:720px; min-height:720px; max-height:720px; border-radius:14px; overflow:hidden;
  box-shadow:0 18px 60px rgba(0,0,0,.18);
  display:flex; flex-direction:column;
}
.news-detail-dialog :deep(.el-dialog__header){
  margin:0; padding:16px 18px 10px;
  border-bottom:1px solid rgba(0,0,0,.06); flex:0 0 auto;
}
.news-detail-dialog :deep(.el-dialog__body){
  padding:14px 18px 16px; flex:1 1 auto; overflow:auto;
}
.news-detail-dialog :deep(.el-dialog__footer){
  padding:12px 18px 16px; border-top:1px solid rgba(0,0,0,.06); flex:0 0 auto;
}

.nd-head{ display:flex; flex-direction:column; gap:10px;}
.nd-title{ font-size:20px; font-weight:900; color:#1f2d3d; line-height:1.35;}
.nd-sub{ display:flex; align-items:center; flex-wrap:wrap; gap:8px;}
.nd-tag{ border-radius:999px; font-weight:900;}
.nd-tag-concept{ border-color:rgba(64,158,255,.22); background:rgba(64,158,255,.08); color:#409eff;}
.nd-tag-stock{ border-color:rgba(103,194,58,.24); background:rgba(103,194,58,.08); color:#389e0d;}
.nd-meta{ font-size:12px; color:#6b7280; font-weight:700;}
.nd-dot{ color:#c0c4cc;}
.nd-body{ display:flex; flex-direction:column; gap:14px;}
.nd-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px;}
@media (max-width:720px){ .nd-grid{ grid-template-columns:1fr; } }
.nd-card{ border:1px solid rgba(0,0,0,.06); background:rgba(0,0,0,.02); border-radius:12px; padding:10px 12px;}
.nd-card-title{ font-size:12px; font-weight:900; color:#374151; margin-bottom:6px;}
.nd-brief{ color:#303133; font-size:13px; line-height:1.8; }
.nd-list{ margin:0; padding-left:18px; color:#303133; font-size:13px; line-height:1.7;}
.nd-list li{ margin:3px 0;}
.nd-content{ color:#303133; font-size:14px; line-height:1.85; height:450px; overflow-y:auto; padding-right:6px; }
.nd-content p{ margin:0 0 12px 0;}
.nd-content :deep(p){ margin:0 0 12px 0; }
.nd-content :deep(strong){ font-weight:900; }
.nd-content :deep(br){ line-height:1.85; }
.nd-footer-wrap{ display:flex; flex-direction:column; gap:14px; }
.nd-related{ display:flex; flex-direction:column; gap:10px; align-items:stretch; }
.nd-related-title{ font-size:12px; font-weight:900; color:#6b7280; text-align:left; padding-left:2px; }
.nd-related-list{ display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
.nd-related-card{
  border:1px solid rgba(0,0,0,.06);
  background:#fff;
  border-radius:12px;
  padding:10px 14px;
  min-height:unset;
}
.nd-related-main{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  min-width:0;
  width:100%;
}
.nd-related-name{
  flex:1 1 auto;
  min-width:0;
  font-size:15px;
  font-weight:900;
  color:#1f2d3d;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  text-align:left;
}
.nd-related-metrics{
  flex:0 0 auto;
  display:flex;
  align-items:baseline;
  gap:8px;
  font-weight:900;
  white-space:nowrap;
}
.nd-related-change,.nd-related-rate{ font-size:14px; }
.up{ color:#f56c6c; }
.down{ color:#16a34a; }
.flat{ color:#6b7280; }
.nd-footer{ display:flex; justify-content:flex-end; gap:10px; }
.nd-apply{ border-radius:10px; font-weight:800; }
.nd-close{ border-radius:10px; font-weight:800; }
@media (max-width:900px){
  .news-detail-dialog :deep(.el-dialog){ width:calc(100vw - 24px) !important; max-width:calc(100vw - 24px); height:calc(100vh - 32px); max-height:calc(100vh - 32px); }
  .news-list-dialog :deep(.el-dialog){ width:calc(100vw - 24px) !important; max-width:calc(100vw - 24px); height:calc(100vh - 32px); max-height:calc(100vh - 32px); }
  .nd-related-list{ grid-template-columns:1fr; }
}
</style>
