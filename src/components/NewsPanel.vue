<template>
  <!-- ✅ 给整体加一个锚点：用于新手教程聚焦“新闻条” -->
  <div class="newsbar" id="tour-news">
    <!-- 左：政策新闻 -->
    <div class="col">
      <div class="badge">
        <span class="dot"></span>
        <span class="label">政策</span>
      </div>

      <!-- ✅ 更精准：把“打开详情”的锚点挂在可点击区域上 -->
      <div class="ticker" @click="openDetail(currentPolicy)">
        <span class="title" :title="currentPolicy?.title || ''">
          {{ currentPolicy?.title || '暂无政策新闻' }}
        </span>
        <span class="meta" v-if="currentPolicy">
          {{ currentPolicy.source }} · {{ formatTime(currentPolicy.time) }}
        </span>
      </div>
    </div>

    <div class="split"></div>

    <!-- 右：概念动态新闻 -->
    <div class="col right-col" id="tour-news-dynamic">
      <div class="badge">
        <span class="dot dot2"></span>
        <span class="label">{{ rightLabel }}</span>
      </div>

      <!-- ✅ 同样把锚点挂在可点击区域上 -->
      <div class="ticker" id="tour-news-open-dynamic" @click="openDetail(currentDynamic)">
        <span class="title" :title="currentDynamic?.title || ''">
          {{ currentDynamic?.title || '暂无相关新闻' }}
        </span>
        <span class="meta" v-if="currentDynamic">
          {{ currentDynamic.source }} · {{ formatTime(currentDynamic.time) }}
        </span>
      </div>

      <!-- ✅ 新闻列表按钮锚点 -->
      <el-tooltip content="查看列表" placement="top" effect="dark">
        <el-button
          id="tour-news-list"
          class="list-btn"
          text
          circle
          @click.stop="openListDrawer"
          aria-label="open news list"
        >
          <el-icon><List /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <!-- ✅ 新闻详情弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      width="700px"
      class="news-detail-dialog"
      append-to-body
    >
      <template #header>
        <div class="nd-head">
          <div class="nd-title" :title="current?.title || ''">
            {{ current?.title || '新闻详情' }}
          </div>

          <div class="nd-sub">
            <el-tag size="small" effect="plain" type="info" class="nd-tag">
              {{ current?.category || '新闻' }}
            </el-tag>

            <template v-if="detailConcepts.length">
              <el-tag
                v-for="c in detailConcepts"
                :key="c.id"
                size="small"
                effect="plain"
                class="nd-tag nd-tag-concept"
                :title="`关联概念：${c.name}`"
              >
                {{ c.name }}
              </el-tag>
            </template>

            <span class="nd-meta" v-if="current?.source">{{ current.source }}</span>
            <span class="nd-dot" v-if="current?.time">·</span>
            <span class="nd-meta" v-if="current?.time">{{ current.time }}</span>
          </div>
        </div>
      </template>

      <div v-if="current" class="nd-body">
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

        <div class="nd-content">
          <p v-for="(p, idx) in (current.content || [])" :key="idx">{{ p }}</p>
        </div>
      </div>

      <template #footer>
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
          <el-button
            v-if="activeIds.length"
            id="tour-news-clear"
            type="warning"
            plain
            class="nd-apply"
            @click="clearActiveFilter"
          >
            清空新闻关联
          </el-button>

          <el-button class="nd-close" @click="dialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- ✅ 列表抽屉 -->
    <el-drawer v-model="drawerVisible" title="新闻列表" size="460px" append-to-body>
      <el-tabs v-model="drawerTab" class="drawer-tabs">
        <el-tab-pane label="政策" name="policy" />
        <el-tab-pane :label="rightLabel" name="dynamic" />
      </el-tabs>

      <!-- ✅ 新手教程：抽屉列表区域锚点 -->
      <div class="drawer-list scroll-hidden" id="tour-news-drawer">
        <div
          v-for="(n, i) in drawerList"
          :key="n.id || i"
          class="drawer-item"
          @click="openFromList(i)"
        >
          <div class="di-title">
            <span class="di-dot" :class="{ d2: drawerTab === 'dynamic' }"></span>
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
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

/** ✅ 统一从 store 读“新闻关联筛选” */
const activeIds = computed(() => {
  const ids = homeFilter.newsConceptIds
  return Array.isArray(ids) ? ids : []
})

const policyIdx = ref(0)
const dynamicIdx = ref(0)

const currentPolicy = computed(() => {
  const list = newsStore.policyNews || []
  if (!list.length) return null
  return list[mod(policyIdx.value, list.length)]
})

const currentDynamic = computed(() => {
  const list = newsStore.dynamicNews || []
  if (!list.length) return null
  return list[mod(dynamicIdx.value, list.length)]
})

const rightLabel = computed(() => {
  const cid = newsStore.currentConceptId || newsStore.context?.conceptId
  const name = conceptNameById(cid)
  return `概念 · ${name || '—'}`
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
    if (typeof newsStore.refreshDynamicNews === 'function') newsStore.refreshDynamicNews()
    dynamicIdx.value = 0
  }
)

/** 详情弹窗 */
const dialogVisible = ref(false)
const current = ref(null)

function openDetail(item) {
  if (!item) return
  current.value = item
  dialogVisible.value = true
}

const detailConcepts = computed(() => {
  const ids = (current.value?.conceptIds || []).filter(Boolean)
  return ids.map(id => ({ id, name: conceptNameById(id) || String(id) }))
})

function applyRelatedConcepts() {
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
}

function clearActiveFilter() {
  homeFilter.newsConceptIds = []
  emit('clear-concept-filter')
}

/** 抽屉 */
const drawerVisible = ref(false)
const drawerTab = ref('policy')

const drawerList = computed(() => {
  return drawerTab.value === 'policy'
    ? (newsStore.policyNews || [])
    : (newsStore.dynamicNews || [])
})

function openListDrawer() {
  drawerTab.value = (newsStore.dynamicNews?.length ? 'dynamic' : 'policy')
  drawerVisible.value = true
}

function openFromList(i) {
  const list = drawerList.value || []
  const item = list[i]
  if (!item) return
  if (drawerTab.value === 'policy') policyIdx.value = i
  else dynamicIdx.value = i
  drawerVisible.value = false
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
  return String(t).replace(/^\d{4}-/, '').slice(0, 11)
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
.right-col{ padding-right:6px;}
.split{ width:1px; height:18px; background:rgba(0,0,0,.08); flex-shrink:0;}
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
.drawer-list{ height:calc(100vh - 160px); overflow-y:auto; padding:6px 2px 10px;}
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

.news-detail-dialog :deep(.el-dialog){
  height:800px; border-radius:14px; overflow:hidden;
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
.nd-meta{ font-size:12px; color:#6b7280; font-weight:700;}
.nd-dot{ color:#c0c4cc;}
.nd-body{ display:flex; flex-direction:column; gap:14px;}
.nd-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px;}
@media (max-width:720px){ .nd-grid{ grid-template-columns:1fr; } }
.nd-card{ border:1px solid rgba(0,0,0,.06); background:rgba(0,0,0,.02); border-radius:12px; padding:10px 12px;}
.nd-card-title{ font-size:12px; font-weight:900; color:#374151; margin-bottom:6px;}
.nd-list{ margin:0; padding-left:18px; color:#303133; font-size:13px; line-height:1.7;}
.nd-list li{ margin:3px 0;}
.nd-content{ color:#303133; font-size:14px; line-height:1.85;}
.nd-content p{ margin:0 0 12px 0;}
.nd-footer{ display:flex; justify-content:flex-end; gap:10px; }
.nd-apply{ border-radius:10px; font-weight:800; }
.nd-close{ border-radius:10px; font-weight:800; }
</style>
