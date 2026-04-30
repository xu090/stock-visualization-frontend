<template>
  <section class="admin-panel">
    <div class="panel-toolbar">
      <el-input v-model="keyword" placeholder="搜索策略名称" clearable class="toolbar-search" />
      <el-button type="primary" @click="openCreate">新建通用策略</el-button>
    </div>

    <el-table :data="filteredStrategies" stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="策略名称" min-width="180" />
      <el-table-column label="排序指标" width="230">
        <template #default="{ row }">
          <span :class="['metric-text', { 'metric-empty': metricText(row.snapshot) === '未设置排序' }]">
            {{ metricText(row.snapshot) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="筛选条件" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="['filter-text', { 'filter-empty': filterText(row.snapshot) === '未设置筛选条件' }]">
            {{ filterText(row.snapshot) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="120" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.enabled"
            @change="toggleStrategyEnabled(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center">
        <template #default="{ row }">
          <el-button size="small" plain @click="openEdit(row)">编辑</el-button>
          <el-button size="small" plain type="danger" @click="removeStrategy(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="!filteredStrategies.length" class="empty-box">暂无通用策略</div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingStrategy?.id ? '编辑通用策略' : '新建通用策略'"
      width="960px"
      destroy-on-close
    >
      <div v-if="form" class="dialog-grid">
        <div class="dialog-col">
          <section class="card">
            <div class="field">
              <div class="field-label">策略名称</div>
              <el-input v-model="form.name" placeholder="请输入策略名称" />
            </div>
            <div class="field">
              <div class="field-label">策略描述</div>
              <el-input v-model="form.desc" type="textarea" :rows="3" placeholder="用于说明这个通用策略的用途" />
            </div>
          </section>

          <section class="card">
            <div class="section-head">
              <div class="field-label">排序指标</div>
              <el-button size="small" plain @click="form.snapshot.selectedMetrics = []">清空</el-button>
            </div>
            <MetricEditor v-model:selectedKeys="form.snapshot.selectedMetrics" :metric-defs="metricDefs" />
          </section>
        </div>

        <div class="dialog-col">
          <section class="card">
            <div class="section-head">
              <div class="field-label">筛选条件</div>
              <el-button size="small" plain @click="resetFilters">重置</el-button>
            </div>
            <FilterEditor :filters="form.snapshot.filters" />
          </section>
        </div>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitStrategy">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import MetricEditor from '@/components/strategy/MetricEditor.vue'
import FilterEditor from '@/components/strategy/FilterEditor.vue'

const authStore = useAuthStore()
const keyword = ref('')
const dialogVisible = ref(false)
const editingStrategy = ref(null)
const form = ref(null)
const strategies = ref([])

const metricDefs = [
  { key: 'change', label: '涨跌幅' },
  { key: 'changeAmount', label: '涨跌额' },
  { key: 'amount', label: '成交额' },
  { key: 'upRatio', label: '上涨占比' },
  { key: 'volatility', label: '波动率' },
]

function emptyFilters() {
  return {
    minChange: null,
    maxChange: null,
    minChangeAmount: null,
    maxChangeAmount: null,
    minAmountY: null,
    maxAmountY: null,
    minUpRatio: null,
    maxUpRatio: null,
    maxVolatility: null,
    maxDrawdown20d: null,
  }
}

function normalizeSnapshot(snapshot = {}) {
  return {
    scope: snapshot.scope || 'all',
    searchQuery: '',
    selectedMetrics: Array.isArray(snapshot.selectedMetrics) ? snapshot.selectedMetrics.slice(0, 3) : [],
    filters: { ...emptyFilters(), ...(snapshot.filters || {}) },
  }
}

const filteredStrategies = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return strategies.value
  return strategies.value.filter(item => String(item.name || '').toLowerCase().includes(q))
})

async function fetchStrategies() {
  if (!authStore.isLoggedIn) {
    console.log('Not logged in, skipping fetch')
    return
  }
  try {
    console.log('Fetching admin strategies...')
    const result = await apiGet('/api/admin/select-strategies')
    console.log('Admin strategies result:', result)
    strategies.value = Array.isArray(result) ? result : (result?.data || [])
    console.log('Strategies set:', strategies.value)
  } catch (error) {
    console.error('Failed to fetch strategies:', error)
    ElMessage.error(error?.message || '获取策略列表失败')
    strategies.value = []
  }
}

function metricText(snapshot = {}) {
  const selected = normalizeSnapshot(snapshot).selectedMetrics
  if (!selected.length) return '未设置排序'
  return selected.map(key => metricDefs.find(item => item.key === key)?.label || key).join(' / ')
}

function filterText(snapshot = {}) {
  const filters = normalizeSnapshot(snapshot).filters
  const parts = []
  if (filters.minChange != null) parts.push(`涨跌幅 >= ${filters.minChange}%`)
  if (filters.minAmountY != null) parts.push(`成交额 >= ${filters.minAmountY}亿`)
  if (filters.minUpRatio != null) parts.push(`上涨占比 >= ${Math.round(filters.minUpRatio * 100)}%`)
  if (filters.maxVolatility != null) parts.push(`波动率 <= ${filters.maxVolatility}`)
  return parts.join('，') || '未设置筛选条件'
}

function openCreate() {
  editingStrategy.value = null
  form.value = {
    name: '',
    desc: '',
    snapshot: normalizeSnapshot(),
  }
  dialogVisible.value = true
}

function openEdit(strategy) {
  editingStrategy.value = strategy
  form.value = {
    id: strategy.id,
    name: strategy.name,
    desc: strategy.desc || '',
    snapshot: normalizeSnapshot(strategy.snapshot),
  }
  dialogVisible.value = true
}

function resetFilters() {
  if (!form.value?.snapshot) return
  form.value.snapshot.filters = emptyFilters()
}

async function toggleStrategyEnabled(strategy) {
  try {
    await apiPatch(`/api/admin/select-strategies/${strategy.id}`, {
      enabled: strategy.enabled
    })
    ElMessage.success(strategy.enabled ? '已启用策略' : '已停用策略')
  } catch (error) {
    // 恢复原状态
    strategy.enabled = !strategy.enabled
    ElMessage.error('操作失败')
  }
}

async function refreshStrategies() {
  await fetchStrategies()
}

async function submitStrategy() {
  if (!form.value?.name?.trim()) {
    ElMessage.warning('请输入策略名称')
    return
  }
  const payload = {
    name: form.value.name.trim(),
    desc: form.value.desc?.trim() || '',
    isFavorite: false,
    enabled: true,
    snapshot: normalizeSnapshot(form.value.snapshot),
  }
  try {
    if (editingStrategy.value?.id) {
      await apiPatch(`/api/admin/select-strategies/${editingStrategy.value.id}`, payload)
      ElMessage.success('已更新通用策略')
    } else {
      await apiPost('/api/admin/select-strategies', payload)
      ElMessage.success('已新建通用策略')
    }
    dialogVisible.value = false
    await refreshStrategies()
  } catch (error) {
    ElMessage.error(error?.message || '通用策略保存失败')
  }
}

async function removeStrategy(strategy) {
  try {
    await ElMessageBox.confirm(`确定删除「${strategy.name}」吗？`, '删除通用策略', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await apiDelete(`/api/admin/select-strategies/${strategy.id}`)
    await refreshStrategies()
    ElMessage.success('已删除通用策略')
  } catch (error) {
    if (error?.message && error.message !== 'cancel') ElMessage.error(error.message)
  }
}

onMounted(() => {
  console.log('AdminStrategiesPanel mounted, auth status:', authStore.isLoggedIn)
  console.log('Auth user:', authStore.user)
  fetchStrategies()
})

watch(() => authStore.isLoggedIn, (loggedIn) => {
  console.log('Auth status changed:', loggedIn)
  if (loggedIn) {
    fetchStrategies()
  }
})
</script>

<style scoped>
.admin-panel {
  display: grid;
  gap: 14px;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-search {
  max-width: 320px;
}

.empty-box {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  border: 1px dashed rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.7);
}

.filter-text {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.filter-empty {
  color: #94a3b8;
  font-style: italic;
}

.metric-text {
  color: #0f172a;
  font-size: 12px;
  font-weight: 500;
}

.metric-empty {
  color: #94a3b8;
  font-weight: 400;
  font-style: italic;
}

:deep(.el-table) {
  border-radius: 8px;
  overflow: hidden;
}

:deep(.el-table__header) {
  background-color: #f8fafc;
}

:deep(.el-table__header th) {
  background-color: #f8fafc;
  color: #475569;
  font-weight: 600;
}

.dialog-grid {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 16px;
}

.dialog-col {
  display: grid;
  gap: 16px;
}

.card {
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  background: #fff;
}

.field {
  display: grid;
  gap: 8px;
}

.field + .field {
  margin-top: 12px;
}

.field-inline {
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: 10px;
}

.field-label {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}

.switch-label {
  font-size: 13px;
  color: #475569;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
</style>
