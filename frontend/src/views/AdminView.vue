<template>
  <div class="admin-view">
    <div class="admin-hero">
      <div>
        <div class="hero-kicker">Administrator Console</div>
        <h1>系统管理台</h1>
      </div>
      <el-button class="home-entry" type="primary" plain @click="goHome">
        <el-icon><House /></el-icon>
        <span>返回主页</span>
      </el-button>
    </div>

    <section class="admin-shell">
      <el-tabs v-model="activeTab" class="admin-tabs">
        <el-tab-pane label="通用概念" name="concepts">
          <AdminConceptsPanel />
        </el-tab-pane>
        <el-tab-pane label="通用策略" name="strategies">
          <AdminStrategiesPanel />
        </el-tab-pane>
        <el-tab-pane label="操作日志" name="logs">
          <AdminOperationLogsPanel />
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { House } from '@element-plus/icons-vue'
import AdminConceptsPanel from '@/components/admin/AdminConceptsPanel.vue'
import AdminStrategiesPanel from '@/components/admin/AdminStrategiesPanel.vue'
import AdminOperationLogsPanel from '@/components/admin/AdminOperationLogsPanel.vue'
import { useConceptStore } from '@/stores/concept'
import { useStrategyStore } from '@/stores/strategy'

const router = useRouter()
const activeTab = ref('concepts')
const conceptStore = useConceptStore()
const strategyStore = useStrategyStore()

function goHome() {
  router.push('/home')
}

onMounted(async () => {
  await Promise.allSettled([
    conceptStore.fetchConceptOverview(),
    strategyStore.fetchSelectStrategies(),
  ])
})
</script>

<style scoped>
.admin-view {
  display: grid;
  gap: 16px;
}

.admin-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0f172a, #1e293b 60%, #334155);
  color: #fff;
}

.home-entry {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 104px;
  border-color: rgba(147, 197, 253, 0.55);
  background: rgba(59, 130, 246, 0.14);
  color: #e0f2fe;
  font-weight: 800;
}

.home-entry:hover,
.home-entry:focus {
  border-color: rgba(191, 219, 254, 0.85);
  background: rgba(59, 130, 246, 0.24);
  color: #fff;
}

.hero-kicker {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(191, 219, 254, 0.9);
}

.admin-hero h1 {
  margin: 8px 0 10px;
  font-size: 28px;
  line-height: 1.1;
}

.admin-hero p {
  margin: 0;
  max-width: 760px;
  color: rgba(226, 232, 240, 0.92);
  line-height: 1.6;
}

.admin-shell {
  padding: 18px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.admin-tabs :deep(.el-tabs__item) {
  font-weight: 800;
}

.admin-tabs :deep(.el-tabs__content) {
  padding-top: 10px;
}

@media (max-width: 640px) {
  .admin-hero {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
