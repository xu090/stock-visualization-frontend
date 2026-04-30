<template>
  <section class="operation-logs-panel">
    <div class="logs-header">
      <div class="header-title">操作日志</div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="fetchLogs" :loading="loading">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 统计信息卡片 -->
    <div class="stats-cards" v-if="stats">
      <div class="stat-card">
        <div class="stat-label">总操作数</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日操作</div>
        <div class="stat-value">{{ stats.todayCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">成功操作</div>
        <div class="stat-value success">{{ stats.byResult.success || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">失败操作</div>
        <div class="stat-value error">{{ stats.byResult.failed || 0 }}</div>
      </div>
    </div>

    <el-table
      :data="logs"
      v-loading="loading"
      stripe
      style="width: 100%"
      :default-sort="{ prop: 'timestamp', order: 'descending' }"
    >
      <el-table-column prop="timestamp" label="时间" width="180" sortable>
        <template #default="{ row }">
          {{ formatTime(row.timestamp) }}
        </template>
      </el-table-column>

      <el-table-column prop="username" label="操作用户" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.role === 'admin'" type="danger" size="small">
            {{ row.username }}
          </el-tag>
          <el-tag v-else type="info" size="small">
            {{ row.username }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="action" label="操作类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getActionType(row.action)" size="small">
            {{ getActionLabel(row.action) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="resource" label="操作对象" width="180" />

      <el-table-column prop="details" label="操作详情" min-width="200" show-overflow-tooltip />

      <el-table-column prop="ip" label="IP地址" width="140" />

      <el-table-column prop="result" label="结果" width="80">
        <template #default="{ row }">
          <el-tag :type="row.result === 'success' ? 'success' : 'danger'" size="small">
            {{ row.result === 'success' ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>

    <div class="empty-state" v-if="!loading && logs.length === 0">
      <el-icon :size="48" color="#94a3b8">
        <Document />
      </el-icon>
      <p>暂无操作日志</p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Document } from '@element-plus/icons-vue'
import { apiGet } from '@/utils/api'

const loading = ref(false)
const logs = ref([])
const stats = ref(null)

async function fetchLogs() {
  loading.value = true
  try {
    console.log('=== 开始获取操作日志 ===')

    // 先获取日志数据
    const logsResponse = await apiGet('/api/admin/operation-logs')
    console.log('1. API原始响应:', logsResponse)
    console.log('2. 响应类型:', typeof logsResponse)
    console.log('3. 是否为数组:', Array.isArray(logsResponse))

    // 处理响应数据
    let processedLogs = []
    if (Array.isArray(logsResponse)) {
      processedLogs = logsResponse
      console.log('4a. 响应是数组，直接使用')
    } else if (logsResponse && Array.isArray(logsResponse.data)) {
      processedLogs = logsResponse.data
      console.log('4b. 响应包含data数组，提取data')
    } else if (logsResponse && typeof logsResponse === 'object') {
      // 如果响应是对象但不是数组，尝试提取数据
      const arrayValue = Object.values(logsResponse).find(item => Array.isArray(item))
      if (arrayValue) {
        processedLogs = arrayValue
        console.log('4c. 从对象中找到数组:', arrayValue.length, '条')
      } else {
        console.log('4d. 对象中没有找到数组，使用空数组')
      }
    } else {
      console.warn('4e. 日志数据格式异常:', logsResponse)
    }

    logs.value = processedLogs
    console.log('5. 最终设置的logs.value:', logs.value.length, '条')

    // 获取统计数据
    try {
      const statsResponse = await apiGet('/api/admin/operation-logs/stats')
      console.log('6. 统计数据响应:', statsResponse)
      stats.value = statsResponse
    } catch (statsError) {
      console.error('7. 获取统计信息失败:', statsError)
      stats.value = null
    }

    if (logs.value.length > 0) {
      ElMessage.success(`成功获取 ${logs.value.length} 条操作日志`)
    } else {
      ElMessage.info('暂无操作日志')
    }

    console.log('=== 获取操作日志完成 ===')
  } catch (error) {
    console.error('=== 获取操作日志异常 ===', error)
    logs.value = []
    stats.value = null
    ElMessage.error(`获取操作日志失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function getActionLabel(action) {
  const labels = {
    'create': '创建',
    'update': '更新',
    'delete': '删除',
    'bootstrap': '系统操作',
    'login': '登录',
    'logout': '登出',
    'export': '导出',
    'import': '导入'
  }
  return labels[action] || action
}

function getActionType(action) {
  const types = {
    'create': 'success',
    'update': 'warning',
    'delete': 'danger',
    'bootstrap': 'info',
    'login': 'info',
    'logout': 'info',
    'export': 'success',
    'import': 'warning'
  }
  return types[action] || 'info'
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.operation-logs-panel {
  padding: 16px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  padding: 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border: 1px solid #e2e8f0;
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.stat-value.success {
  color: #16a34a;
}

.stat-value.error {
  color: #dc2626;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f1f5f9;
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
}

.empty-state p {
  margin: 16px 0 0;
  font-size: 14px;
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

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }
}
</style>
