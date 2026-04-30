<template>
  <section class="tools-grid">
    <div v-for="tool in tools" :key="tool.key" class="tool-card">
      <div class="tool-title">{{ tool.title }}</div>
      <div class="tool-desc">{{ tool.description }}</div>
      <div class="tool-actions">
        <el-button :loading="runningKey === tool.key" type="primary" plain @click="runTool(tool)">
          执行
        </el-button>
      </div>
    </div>

    <div class="log-card">
      <div class="log-title">最近结果</div>
      <pre class="log-body">{{ lastResult }}</pre>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiPost } from '@/utils/api'

const runningKey = ref('')
const lastResult = ref('暂无执行记录')

const tools = [
  {
    key: 'bootstrap-concepts',
    title: '重建通用概念',
    description: '重新写入默认通用概念，适合初始化或校准预设概念内容。',
    url: '/api/admin/bootstrap/concepts',
  },
  {
    key: 'bootstrap-strategies',
    title: '重建通用策略',
    description: '重新写入默认通用策略，适合恢复系统预设策略模板。',
    url: '/api/admin/bootstrap/select-strategies',
  },
  {
    key: 'backfill-stock-names',
    title: '回填股票名称',
    description: '把股票中文名补全回当前 stocks 表，修正旧数据里只有代码的记录。',
    url: '/api/admin/backfill-stock-names',
  },
  {
    key: 'db-indexes',
    title: '重建查询索引',
    description: '补齐数据库查询索引，改善概念、策略与行情查询性能。',
    url: '/api/admin/db-indexes',
  },
]

async function runTool(tool) {
  runningKey.value = tool.key
  try {
    const result = await apiPost(tool.url, {})
    lastResult.value = JSON.stringify(result, null, 2)
    ElMessage.success(`${tool.title}执行完成`)
  } catch (error) {
    lastResult.value = error?.message || '执行失败'
    ElMessage.error(error?.message || `${tool.title}执行失败`)
  } finally {
    runningKey.value = ''
  }
}
</script>

<style scoped>
.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.tool-card,
.log-card {
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  background: #fff;
}

.tool-title,
.log-title {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
}

.tool-desc {
  margin-top: 8px;
  min-height: 42px;
  font-size: 13px;
  line-height: 1.55;
  color: #475569;
}

.tool-actions {
  margin-top: 14px;
}

.log-card {
  grid-column: 1 / -1;
}

.log-body {
  margin: 10px 0 0;
  padding: 12px;
  min-height: 120px;
  max-height: 280px;
  overflow: auto;
  border-radius: 10px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 980px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
}
</style>
