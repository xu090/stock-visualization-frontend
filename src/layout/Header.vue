<template>
  <div class="header">
    <!-- ✅ 右侧：新手教程 -->
    <div class="right">
      <span class="tour-link" @click="startTour" role="button" tabindex="0">
        新手教程
      </span>
    </div>
  </div>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'
import { createHomeTour } from '@/utils/homeTour'

// ✅ 这些 store 在你 HomeView 里已经用过了
import { useHomeFilterStore } from '@/stores/homeFilter'

const router = useRouter()
const route = useRoute()

const homeFilter = useHomeFilterStore()

const { start } = createHomeTour({ router })

function startTour() {
  start()
}

/** ✅ 回主页 + 清空配置（尽量不耦合，安全调用） */
function goHome() {
  // 1) 跳回主页
  if (route.path !== '/home') router.push('/home')

  // 2) 清空主页“空配置”
  // 你 HomeView 里已经有 resetAll()，但在 Header 这里拿不到函数，
  // 所以我们直接重置 homeFilter store 里的字段（存在才重置）。
  try {
    if ('searchQuery' in homeFilter) homeFilter.searchQuery = ''
    if ('selectedMetrics' in homeFilter) homeFilter.selectedMetrics = []
    if ('newsConceptIds' in homeFilter) homeFilter.newsConceptIds = []

    if ('appliedSelectStrategyId' in homeFilter) homeFilter.appliedSelectStrategyId = null
    if ('appliedTradeStrategyId' in homeFilter) homeFilter.appliedTradeStrategyId = null

    // filters 结构如果存在就清空（你的 HomeView 里 keys 很全）
    if ('filters' in homeFilter && homeFilter.filters) {
      const f = homeFilter.filters
      const keys = [
        'minChange','maxChange',
        'minNetInflowY','maxNetInflowY',
        'minAmountY','maxAmountY',
        'minVolRatio','maxVolRatio',
        'minUpRatio','maxUpRatio',
        'minStrength','minSpike5m',
        'maxVolatility','maxDrawdown20d'
      ]
      keys.forEach(k => { if (k in f) f[k] = null })
    }
  } catch (e) {
    // 不影响跳转；避免因 store 结构不同导致报错
    console.warn('[home] reset failed:', e)
  }
}
</script>

<style scoped>
.header{
  width: 100%;
  display:flex;
  justify-content: flex-end; /* 修改这里，右对齐 */
  align-items:center;
  padding: 10px;
}

/* ✅ 右侧 link */

.tour-link{
  font-size: 13px;
  font-weight: 550;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  user-select: none;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background 0.12s ease, opacity 0.12s ease;
}
.tour-link:hover{
  background: rgba(255, 255, 255, 0.14);
}
.tour-link:active{
  opacity: 0.85;
}
</style>