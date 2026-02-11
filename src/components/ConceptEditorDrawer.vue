<template>
  <!-- ============ 概念编辑抽屉 ============ -->
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    size="45%"
    append-to-body
    class="drawer concept-drawer"
  >
    <div class="drawer-body">
      <el-form :model="form" label-width="92px" class="concept-form">
        <el-form-item label="概念名称" prop="name" :rules="nameRules">
          <el-input v-model="form.name" placeholder="例如：半导体、军工、AI算力" />
        </el-form-item>

        <el-form-item label="成分股">
          <div class="stock-pick">
            <div class="pick-head">
              <el-button @click="openStockSelectionDialog" type="primary" class="btn-primary">
                <el-icon style="margin-right:6px;"><Search /></el-icon>
                选择股票
              </el-button>

              <div class="pick-count">
                已选 <span class="num">{{ form.stockCodes.length }}</span> 支
              </div>
            </div>

            <!-- 已选股票：可滚动 + 空态 -->
            <div class="picked-box" :class="{ empty: !form.stockCodes.length }">
              <div v-if="form.stockCodes.length" class="picked-tags">
                <el-tag
                  v-for="(s, idx) in form.stockCodes"
                  :key="s.code"
                  closable
                  @close="removePicked(idx)"
                  class="picked-tag"
                  :title="`${s.stockName}（${s.code}）`"
                >
                  {{ s.stockName }}（{{ s.code }}）
                </el-tag>
              </div>

              <div v-else class="empty-picked">暂无已选股票</div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="指数算法" prop="algorithm">
          <el-select v-model="form.algorithm" placeholder="选择算法" style="width: 240px;">
            <el-option label="加权平均（更稳）" value="weighted" />
            <el-option label="涨幅排序（更敏感）" value="percentage" />
          </el-select>
        </el-form-item>

        <el-form-item label="概念描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="描述概念逻辑、选股范围、行业边界等"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" class="btn-save" @click="save">保存</el-button>
      </div>
    </template>
  </el-drawer>

  <!-- ============ 选股抽屉 ============ -->
  <el-drawer
    v-model="stockSelectionVisible"
    title="选择股票"
    size="40%"
    append-to-body
    class="drawer stock-drawer"
  >
    <div class="stock-drawer-head">
      <el-input
        v-model="searchQuery"
        placeholder="搜索（股票名称 / 代码）"
        clearable
        @input="searchStocks"
        style="width: 100%;"
      />

      <div class="stock-drawer-actions">
        <div class="selected-info">
          已勾选 <span class="num">{{ checkedStocks.length }}</span> 支
        </div>

        <div class="actions">
          <el-button size="small" @click="selectAllFiltered" :disabled="filteredStocks.length === 0">
            全选当前
          </el-button>
          <el-button size="small" @click="clearChecked" :disabled="checkedStocks.length === 0">
            清空勾选
          </el-button>
        </div>
      </div>
    </div>

    <el-table
      :data="filteredStocks"
      stripe
      class="stock-table"
      height="520"
      empty-text="暂无匹配股票"
      @row-click="toggleRowChecked"
    >
      <el-table-column label="" width="30" align="center">
        <template #default="{ row }">
          <el-checkbox v-model="checkedStocks" :label="row" :key="row.code" @click.stop />
        </template>
      </el-table-column>

      <el-table-column label="股票名称" prop="stockName" min-width="85" />
      <el-table-column label="股票代码" prop="code" width="80" />
      <el-table-column label="开盘" prop="open" width="70" align="right" />
      <el-table-column label="收盘" prop="close" width="70" align="right" />
      <el-table-column label="最高" prop="high" width="70" align="right" />
      <el-table-column label="最低" prop="low" width="70" align="right" />
      <el-table-column label="成交量" prop="vol" width="82" align="right" />
      <el-table-column label="成交额" prop="amount" width="82" align="right" />
    </el-table>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="stockSelectionVisible = false">关闭</el-button>
        <el-button
          type="primary"
          class="btn-save"
          @click="addSelectedStocks"
          :disabled="checkedStocks.length === 0"
        >
          添加选中
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editing: { type: Object, default: null } // {id,name,description,algorithm,stockCodes:[]}
})
const emit = defineEmits(['update:modelValue', 'saved'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const drawerTitle = computed(() => (props.editing?.id ? '编辑概念' : '新建概念'))
const nameRules = [{ required: true, message: '请输入概念名称', trigger: 'blur' }]

/** form.stockCodes 在组件内部用“对象数组”保存（含 stockName/code），保存时再转字符串数组 */
const form = ref({
  id: '',
  name: '',
  description: '',
  algorithm: '',
  stockCodes: [] // [{code,stockName,...}]
})

watch(
  () => props.editing,
  (val) => {
    if (val?.id) {
      const codes =
        Array.isArray(val.stockCodes) ? val.stockCodes :
        Array.isArray(val.stocks) ? val.stocks.map(s => s.code) :
        []

      form.value = {
        id: val.id,
        name: val.name || '',
        description: val.description || '',
        algorithm: val.algorithm || '',
        stockCodes: codes.map(c => ({ code: String(c), stockName: String(c) }))
      }
    } else {
      form.value = { id: '', name: '', description: '', algorithm: '', stockCodes: [] }
    }
  },
  { immediate: true }
)

/** 选股抽屉（mock） */
const stockSelectionVisible = ref(false)
const searchQuery = ref('')
const stockList = ref([])
const filteredStocks = ref([])
const checkedStocks = ref([])

const fetchStocks = () => {
  stockList.value = [
    { code: '603861', stockName: '白云电器', open: 12.32, close: 12.73, high: 12.75, low: 12.72, vol: '50,400', amount: '641,957' },
    { code: '688651', stockName: '盛邦安全', open: 44.84, close: 44.51, high: 44.51, low: 44.50, vol: '25,341', amount: '1,127,700' },
    { code: '603001', stockName: '奥康国际', open: 8.85, close: 8.73, high: 8.74, low: 8.73, vol: '16,400', amount: '143,211' },
    { code: '601811', stockName: '新华文轩', open: 13.41, close: 13.57, high: 13.57, low: 13.56, vol: '10,900', amount: '147,865' },
    { code: '600641', stockName: '先导惠电', open: 17.72, close: 18.28, high: 18.29, low: 18.30, vol: '39,400', amount: '720,609' }
  ]
  filteredStocks.value = stockList.value
}

const openStockSelectionDialog = () => {
  stockSelectionVisible.value = true
  fetchStocks()
  searchQuery.value = ''
  checkedStocks.value = []
}

const searchStocks = () => {
  const kw = searchQuery.value.trim()
  if (!kw) return (filteredStocks.value = stockList.value)
  filteredStocks.value = stockList.value.filter(s =>
    s.stockName.includes(kw) || String(s.code).includes(kw)
  )
}

const selectAllFiltered = () => {
  const map = new Map(checkedStocks.value.map(s => [s.code, s]))
  filteredStocks.value.forEach(s => map.set(s.code, s))
  checkedStocks.value = Array.from(map.values())
}
const clearChecked = () => { checkedStocks.value = [] }

/** 行点击也能勾选/取消 */
const toggleRowChecked = (row) => {
  if (!row?.code) return
  const idx = checkedStocks.value.findIndex(s => String(s.code) === String(row.code))
  if (idx >= 0) checkedStocks.value.splice(idx, 1)
  else checkedStocks.value.push(row)
}

const addSelectedStocks = () => {
  const map = new Map(form.value.stockCodes.map(s => [s.code, s]))
  checkedStocks.value.forEach(s => map.set(s.code, s))
  form.value.stockCodes = Array.from(map.values())
  stockSelectionVisible.value = false
}

const removePicked = (idx) => {
  form.value.stockCodes.splice(idx, 1)
}

/** 保存：输出标准结构 */
const save = () => {
  if (!form.value.name || !form.value.stockCodes.length) {
    ElMessage.error('概念名称和股票不能为空')
    return
  }

  const conceptData = {
    id: form.value.id || Date.now().toString(),
    name: form.value.name,
    description: form.value.description,
    algorithm: form.value.algorithm,
    stockCodes: form.value.stockCodes.map(s => String(s.code))
  }

  visible.value = false
  emit('saved', conceptData)
}
</script>

<style scoped>
.drawer :deep(.el-drawer__header){ font-weight: 900; }
.drawer-body{ padding: 6px 2px 0; }
.concept-form :deep(.el-form-item){ margin-bottom: 14px; }

/* 成分股 */
.stock-pick{ width: 100%; display:flex; flex-direction:column; gap: 10px; }
.pick-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
}
.pick-count{ font-size: 12px; color:#606266; }
.num{ font-weight: 900; color:#1f2d3d; }

/* 已选区域：可滚动 */
.picked-box{
  border: 1px dashed rgba(0,0,0,.14);
  background: rgba(0,0,0,.015);
  border-radius: 12px;
  padding: 10px;
  max-height: 160px;
  overflow: auto;
}
.picked-box.empty{
  display:flex;
  align-items:center;
  justify-content:center;
  min-height: 86px;
}
.picked-tags{ display:flex; flex-wrap:wrap; gap: 8px; }
.picked-tag{ border-radius: 999px; }
.empty-picked{ font-size: 12px; color:#c0c4cc; }

/* 选股抽屉 */
.stock-drawer-head{ display:flex; flex-direction:column; gap: 10px; margin-bottom: 10px; }
.stock-drawer-actions{ display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.selected-info{ font-size: 12px; color:#606266; }
.actions{ display:flex; gap: 8px; }

.stock-table :deep(.el-table__row){ cursor: pointer; }
.stock-table :deep(.el-table__row:hover td){ background: #f5f8ff !important; }

.drawer-footer{ display:flex; justify-content:flex-end; gap: 10px; }
.btn-save{ border-radius: 10px; font-weight: 900; }
.btn-primary{ border-radius: 10px; font-weight: 800; }
</style>
