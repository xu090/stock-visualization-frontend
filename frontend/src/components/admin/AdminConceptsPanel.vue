<template>
  <section class="admin-panel">
    <div class="panel-toolbar">
      <el-input v-model="keyword" placeholder="搜索概念名称或ID" clearable class="toolbar-search" />
      <el-button type="primary" @click="openCreate">新建通用概念</el-button>
    </div>

    <el-table :data="filteredConcepts" stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="150" />
      <el-table-column prop="name" label="概念名称" min-width="180" />
      <el-table-column label="成分股数量" width="120" align="center">
        <template #default="{ row }">
          {{ row.stockCodes?.length || 0 }} 支
        </template>
      </el-table-column>
      <el-table-column label="启用" width="120" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.enabled"
            @change="toggleConceptEnabled(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center">
        <template #default="{ row }">
          <el-button size="small" plain @click="openEdit(row)">编辑</el-button>
          <el-button size="small" plain type="danger" @click="removeConcept(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="!filteredConcepts.length" class="empty-box">暂无通用概念</div>

    <ConceptEditorDrawer
      v-model="editorVisible"
      :editing="editingConcept"
      mode="dialog"
      @saved="submitConcept"
    />
  </section>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import ConceptEditorDrawer from '@/components/ConceptEditorDrawer.vue'

const authStore = useAuthStore()
const keyword = ref('')
const editorVisible = ref(false)
const editingConcept = ref(null)
const concepts = ref([])

const filteredConcepts = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return concepts.value
  return concepts.value.filter(item => {
    return String(item.name || '').toLowerCase().includes(q) || String(item.id || '').toLowerCase().includes(q)
  })
})

async function fetchConcepts() {
  if (!authStore.isLoggedIn) {
    console.log('Not logged in, skipping fetch')
    return
  }
  try {
    console.log('Fetching admin concepts...')
    const result = await apiGet('/api/admin/concepts')
    console.log('Admin concepts result:', result)
    concepts.value = Array.isArray(result) ? result : (result?.data || [])
    console.log('Concepts set:', concepts.value)
  } catch (error) {
    console.error('Failed to fetch concepts:', error)
    ElMessage.error(error?.message || '获取概念列表失败')
    concepts.value = []
  }
}

function openCreate() {
  editingConcept.value = null
  editorVisible.value = true
}

function openEdit(concept) {
  editingConcept.value = {
    id: concept.id,
    name: concept.name,
    stockCodes: concept.stockCodes || [],
    algorithm: concept.algorithm || '',
    editable: true,
    favorite: !!concept.favorite,
  }
  editorVisible.value = true
}

async function toggleConceptEnabled(concept) {
  try {
    await apiPatch(`/api/admin/concepts/${encodeURIComponent(concept.id)}`, {
      enabled: concept.enabled
    })
    ElMessage.success(concept.enabled ? '已启用概念' : '已停用概念')
  } catch (error) {
    // 恢复原状态
    concept.enabled = !concept.enabled
    ElMessage.error('操作失败')
  }
}

async function refreshConcepts() {
  await fetchConcepts()
}

async function submitConcept(payload) {
  try {
    if (payload.isNew) {
      await apiPost('/api/admin/concepts', {
        id: payload.id,
        name: payload.name,
        stockCodes: payload.stockCodes,
        algorithm: payload.algorithm,
        favorite: false,
      })
      ElMessage.success('已新建通用概念')
    } else {
      await apiPatch(`/api/admin/concepts/${encodeURIComponent(payload.id)}`, {
        name: payload.name,
        stockCodes: payload.stockCodes,
        algorithm: payload.algorithm,
      })
      ElMessage.success('已更新通用概念')
    }
    editorVisible.value = false
    await refreshConcepts()
  } catch (error) {
    ElMessage.error(error?.message || '通用概念保存失败')
  }
}

async function removeConcept(concept) {
  try {
    await ElMessageBox.confirm(`确定删除「${concept.name}」吗？`, '删除通用概念', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await apiDelete(`/api/admin/concepts/${encodeURIComponent(concept.id)}`)
    await refreshConcepts()
    ElMessage.success('已删除通用概念')
  } catch (error) {
    if (error?.message && error.message !== 'cancel') ElMessage.error(error.message)
  }
}

onMounted(() => {
  console.log('AdminConceptsPanel mounted, auth status:', authStore.isLoggedIn)
  console.log('Auth user:', authStore.user)
  fetchConcepts()
})

watch(() => authStore.isLoggedIn, (loggedIn) => {
  console.log('Auth status changed:', loggedIn)
  if (loggedIn) {
    fetchConcepts()
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
</style>
