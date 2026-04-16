<template>
  <div class="concept-management">
    <el-card class="page-card" shadow="never">
      <!-- 顶部：标题 + 工具栏 -->
      <div class="page-head">
        <div class="head-left">
          <div class="title">概念管理</div>
          <div class="sub">
            自定义概念：<span class="count">{{ userConcepts.length }}</span> 个
          </div>
        </div>

        <div class="head-right">
          <el-input
            v-model="kw"
            class="kw"
            clearable
            placeholder="搜索概念名称"
          />

          <el-select v-model="algo" class="algo" clearable placeholder="算法">
            <el-option label="加权平均" value="weighted" />
            <el-option label="涨幅排序" value="percentage" />
          </el-select>

          <el-button type="primary" plain class="btn-create" @click="openCreate">
            <el-icon style="margin-right:6px;"><Plus /></el-icon>
            新建概念
          </el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table
        :data="tableData"
        class="table"
        stripe
        empty-text="暂无自定义概念，点击右上角新建"
      >
        <el-table-column label="概念名称" min-width="240">
          <template #default="{ row }">
            <div class="name-cell">
              <div class="name" :title="row.name">{{ row.name }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="成分股" width="120" align="right">
          <template #default="{ row }">
            <span class="num">{{ row.stockCodes?.length ?? 0 }}</span>
            <span class="unit">支</span>
          </template>
        </el-table-column>

        <el-table-column label="指数算法" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.algorithm === 'weighted'" type="info" effect="plain">
              加权平均
            </el-tag>
            <el-tag v-else-if="row.algorithm === 'percentage'" type="warning" effect="plain">
              涨幅排序
            </el-tag>
            <el-tag v-else type="info" effect="plain">
              未选择
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="描述" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="desc">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="210" align="right">
  <template #default="{ row }">
    <div class="ops">
      <el-button link type="primary" class="op-link" @click="openEdit(row)">
        <el-icon class="op-ic"><EditPen /></el-icon>
        编辑
      </el-button>

      <el-popconfirm
        title="确认删除该概念？"
        confirm-button-text="删除"
        cancel-button-text="取消"
        @confirm="remove(row)"
      >
        <template #reference>
          <el-button link type="danger" class="op-link">
            <el-icon class="op-ic"><Delete /></el-icon>
            删除
          </el-button>
        </template>
      </el-popconfirm>

      <el-button link type="info" class="op-link" @click="goDetail(row)">
        <el-icon class="op-ic"><View /></el-icon>
        详情
      </el-button>
    </div>
  </template>
</el-table-column>

      </el-table>
    </el-card>

    <!-- 复用抽屉：你已有的 ConceptEditorDrawer -->
    <ConceptEditorDrawer
      v-model="drawerVisible"
      :editing="editingConcept"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

import { useConceptStore } from '@/stores/concept'
import ConceptEditorDrawer from '@/components/ConceptEditorDrawer.vue'

const router = useRouter()
const conceptStore = useConceptStore()

const drawerVisible = ref(false)
const editingConcept = ref(null)

const kw = ref('')
const algo = ref('')

/** ✅ 使用 store 里已有的自定义概念数据 */
const userConcepts = computed(() => conceptStore.userConcepts || [])

const tableData = computed(() => {
  const k = (kw.value || '').trim().toLowerCase()
  const a = algo.value || ''
  let list = (userConcepts.value || []).slice()

  if (k) list = list.filter(x => (x.name || '').toLowerCase().includes(k))
  if (a) list = list.filter(x => (x.algorithm || '') === a)

  return list
})

const openCreate = () => {
  editingConcept.value = null
  drawerVisible.value = true
}
const openEdit = (row) => {
  editingConcept.value = row
  drawerVisible.value = true
}

const onSaved = async (conceptData) => {
  const existed = (conceptStore.userConcepts || []).some(c => String(c.id) === String(conceptData.id))
  try {
    if (existed) await conceptStore.updateUserConcept(conceptData)
    else await conceptStore.addUserConcept(conceptData)

    ElMessage.success(existed ? '概念已更新' : '概念已创建')
    router.push(`/concept/${conceptData.id}`)
  } catch (error) {
    ElMessage.error(error?.message || '概念保存失败')
  }
}

const remove = async (row) => {
  try {
    await conceptStore.deleteUserConcept(row.id)
    ElMessage.success('概念已删除')
  } catch (error) {
    ElMessage.error(error?.message || '概念删除失败')
  }
}

const goDetail = (row) => router.push(`/concept/${row.id}`)
</script>

<style scoped>
.concept-management{
  padding: 14px;
  background: #f6f8fb;
}

.page-card{
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 10px 26px rgba(0,0,0,.04);
}

/* 顶部 */
.page-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 14px;
  margin-bottom: 12px;
}
.title{
  font-size: 20px;
  font-weight: 900;
  color:#111827;
  line-height: 1.1;
}
.sub{
  margin-top: 8px;
  font-size: 12px;
  color:#909399;
}
.count{
  font-weight: 900;
  color:#111827;
}

.head-right{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap: wrap;
}
.kw{ width: 260px; }
.algo{ width: 140px; }

.btn-create{
  border-radius: 10px;
  font-weight: 900;
  height: 32px;
}

/* 表格更清爽 */
.table{
  margin-top: 8px;
}
.table :deep(.el-table__header th){
  background: rgba(0,0,0,.02);
  color:#6b7280;
  font-weight: 900 !important;
}
.table :deep(.el-table__row td){
  padding-top: 14px;
  padding-bottom: 14px;
}

/* 名称列：主次信息 */
.name-cell{
  display:flex;
  flex-direction:column;
  gap: 6px;
  min-width: 0;
}
.name{
  font-size: 15px;
  font-weight: 700;
  color:#111827;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.desc-mini{
  font-size: 12px;
  color:#9aa1ad;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* 数字 */
.num{ font-weight: 900; color:#111827; }
.unit{ margin-left: 4px; color:#9aa1ad; font-size: 12px; }
.desc{ color:#374151; }

/* 操作：link 风格 */
.ops{
  display:inline-flex;
  align-items:center;
  gap: 12px;
}
.op-link{
  font-weight: 700;
  padding: 0 !important;
}
.ops :deep(.el-button.is-link:hover){
  opacity: .92;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
