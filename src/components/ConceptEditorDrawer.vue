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

        <!-- ============ 成分股选择（勾选即已选） ============ -->
        <el-form-item label="成分股">
          <div class="stock-pick">
            <!-- 顶部：数量与操作 -->
            <div class="pick-head">
              <div class="pick-left">
                <span class="pick-label">已选</span>
                <span class="pick-num">{{ form.stockCodes.length }}</span>
                <span class="pick-label">支</span>
              </div>

              <div class="pick-actions">
                <el-button
                  size="small"
                  @click="selectAllFiltered"
                  :disabled="filteredStocks.length === 0"
                >
                  全选当前
                </el-button>

                <el-button
                  size="small"
                  @click="clearAllSelected"
                  :disabled="form.stockCodes.length === 0"
                >
                  清空已选
                </el-button>
              </div>
            </div>

            <!-- 已选股票：可滚动 + 空态（高度缩小） -->
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

              <div v-else class="empty-picked">暂无已选股票（在下方表格直接勾选即可）</div>
            </div>

            <!-- 搜索 -->
            <el-input
              v-model="searchQuery"
              placeholder="搜索（股票名称 / 代码）"
              clearable
              class="stock-search"
            />

            <!-- 表格：checkbox 直接绑定到 checkedCodes（它=已选code集合）
                 ✅ 固定：勾选框 + 股票名称 + 股票代码
                 ✅ 右侧数据横向滚动
                 ✅ 滚动条不展示（但可滚动）
            -->
            <el-table
              :data="filteredStocks"
              stripe
              class="stock-table scroll-hidden"
              height="320"
              empty-text="暂无匹配股票"
              @row-click="toggleRowChecked"
              :row-key="row => row.code"
            >
              <!-- ✅ 固定：勾选框 -->
              <el-table-column
                fixed="left"
                label=""
                width="30"
                align="center"
                class-name="col-check"
              >
                <template #default="{ row }">
                  <el-checkbox v-model="checkedCodes" :label="row.code" @click.stop />
                </template>
              </el-table-column>

              <!-- ✅ 固定：股票名称 -->
              <el-table-column
                fixed="left"
                label="股票名称"
                prop="stockName"
                width="100"
                show-overflow-tooltip
                align="center"
              />

              <!-- ✅ 固定：股票代码（你要的） -->
              <el-table-column
                fixed="left"
                label="股票代码"
                prop="code"
                width="100"
                show-overflow-tooltip
                align="center"
              />

              <!-- 下面这些列会在右侧横向滚动 -->
              <el-table-column label="开盘" width="80" align="right">
                <template #default="{ row }">{{ fmtPrice(row.open) }}</template>
              </el-table-column>

              <el-table-column label="收盘" width="80" align="right">
                <template #default="{ row }">{{ fmtPrice(row.close) }}</template>
              </el-table-column>

              <el-table-column label="最高" width="80" align="right">
                <template #default="{ row }">{{ fmtPrice(row.high) }}</template>
              </el-table-column>

              <el-table-column label="最低" width="80" align="right">
                <template #default="{ row }">{{ fmtPrice(row.low) }}</template>
              </el-table-column>

              <el-table-column label="成交量" width="110" align="right">
                <template #default="{ row }">{{ fmtInt(row.vol) }}</template>
              </el-table-column>

              <el-table-column label="成交额" width="120" align="right">
                <template #default="{ row }">{{ fmtInt(row.amount) }}</template>
              </el-table-column>
            </el-table>
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
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useStockStore } from '@/stores/stock'

const stockStore = useStockStore()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editing: { type: Object, default: null } // {id,name,description,algorithm,stockCodes:[]}
})
const emit = defineEmits(['update:modelValue', 'saved'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const isEditing = computed(() => !!props.editing?.id)
const drawerTitle = computed(() => (isEditing.value ? '编辑概念' : '新建概念'))
const nameRules = [{ required: true, message: '请输入概念名称', trigger: 'blur' }]

/** ✅ 统一 code */
function normalizeCode(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  s = s.replace(/\.(SZ|SH)$/i, '')
  s = s.replace(/^(sz|sh)/i, '')
  return s
}
function pickNameByCode(code) {
  const base = stockStore.getStockBaseByCode?.(code)
  return base?.name || String(code)
}

/** 已选：对象数组 */
const form = ref({
  id: '',
  name: '',
  description: '',
  algorithm: '',
  stockCodes: [] // [{code, stockName}]
})

/** ✅ 勾选集合（它=已选code集合） */
const checkedCodes = ref([])

/** 搜索关键字 */
const searchQuery = ref('')

/** 表格行 */
const stockRows = computed(() => {
  const baseList = stockStore.stockBaseList || []
  return baseList.map((b) => {
    const code = normalizeCode(b.code)
    const enriched = stockStore.getStockByCodeEnriched?.(code) || { code, name: b.name }
    return {
      code,
      stockName: enriched.name || b.name || code,
      open: enriched.open,
      close: enriched.close ?? enriched.price,
      high: enriched.high,
      low: enriched.low,
      vol: enriched.volume ?? enriched.vol,
      amount: enriched.amount
    }
  })
})

const filteredStocks = computed(() => {
  const kw = (searchQuery.value || '').trim()
  if (!kw) return stockRows.value
  return stockRows.value.filter(
    (s) => (s.stockName || '').includes(kw) || String(s.code).includes(kw)
  )
})

/** ✅ 初始化：编辑时把已有 stockCodes 同步到 checkedCodes（表格默认勾选） */
watch(
  () => props.editing,
  (val) => {
    if (val?.id) {
      const rawCodes = Array.isArray(val.stockCodes)
        ? val.stockCodes
        : Array.isArray(val.stocks)
          ? val.stocks.map((s) => s?.code)
          : []

      const codes = rawCodes
        .map((x) => (typeof x === 'object' ? x?.code : x))
        .map(normalizeCode)
        .filter(Boolean)

      form.value = {
        id: String(val.id),
        name: val.name || '',
        description: val.description || '',
        algorithm: val.algorithm || '',
        stockCodes: codes.map((c) => ({ code: c, stockName: pickNameByCode(c) }))
      }

      checkedCodes.value = codes.slice()
    } else {
      form.value = { id: '', name: '', description: '', algorithm: '', stockCodes: [] }
      checkedCodes.value = []
    }
  },
  { immediate: true }
)

/**
 * ✅ 核心同步逻辑：checkedCodes 一变，就把 form.stockCodes 同步成对应对象数组
 * - 勾选 => 立即加入已选
 * - 取消勾选 => 立即从已选移除
 */
watch(
  checkedCodes,
  (codes) => {
    const list = Array.isArray(codes) ? codes : []
    const normalized = list.map(normalizeCode).filter(Boolean)

    // 去重但保持“勾选顺序”
    const seen = new Set()
    const orderedUnique = []
    for (const c of normalized) {
      if (seen.has(c)) continue
      seen.add(c)
      orderedUnique.push(c)
    }

    // 保留旧对象避免 name 抖动
    const oldMap = new Map((form.value.stockCodes || []).map((s) => [normalizeCode(s.code), s]))

    form.value.stockCodes = orderedUnique.map((code) => {
      return oldMap.get(code) || { code, stockName: pickNameByCode(code) }
    })
  },
  { deep: true }
)

/** 行点击：勾选/取消 */
const toggleRowChecked = (row) => {
  const code = normalizeCode(row?.code)
  if (!code) return
  const idx = checkedCodes.value.findIndex((c) => normalizeCode(c) === code)
  if (idx >= 0) checkedCodes.value.splice(idx, 1)
  else checkedCodes.value.push(code)
}

/** 全选当前（过滤结果全部加入已选） */
const selectAllFiltered = () => {
  const set = new Set(checkedCodes.value.map(normalizeCode).filter(Boolean))
  filteredStocks.value.forEach((s) => set.add(normalizeCode(s.code)))
  // 让“原有顺序”在前，“新增”在后，体验更自然
  const base = checkedCodes.value.map(normalizeCode).filter(Boolean)
  const extra = Array.from(set).filter((c) => !base.includes(c))
  checkedCodes.value = base.concat(extra)
}

/** 清空已选（等价于清空勾选） */
const clearAllSelected = () => {
  checkedCodes.value = []
}

/** 删除已选 tag：同步取消勾选 */
const removePicked = (idx) => {
  const removed = form.value.stockCodes?.[idx]
  if (!removed) return
  const code = normalizeCode(removed.code)
  const i = checkedCodes.value.findIndex((c) => normalizeCode(c) === code)
  if (i >= 0) checkedCodes.value.splice(i, 1)
}

/** 格式化 */
const fmtPrice = (v) => {
  const n = Number(v)
  return !Number.isFinite(n) ? '--' : n.toFixed(2)
}
const fmtInt = (v) => {
  const n = Number(v)
  return !Number.isFinite(n) ? '--' : Math.round(n).toLocaleString()
}

/** 保存 */
const save = () => {
  if (!form.value.name || !form.value.stockCodes.length) {
    ElMessage.error('概念名称和股票不能为空')
    return
  }

  const isNew = !form.value.id

  const conceptData = {
    id: form.value.id || Date.now().toString(),
    name: form.value.name,
    description: form.value.description,
    algorithm: form.value.algorithm,
    stockCodes: form.value.stockCodes.map((s) => normalizeCode(s.code)),
    isNew,
    mode: isNew ? 'create' : 'edit'
  }

  visible.value = false
  emit('saved', conceptData)
}
</script>

<style scoped>
/* ✅ 隐藏滚动条但保留滚动（通用） */
.scroll-hidden{
  scrollbar-width: none;      /* firefox */
  -ms-overflow-style: none;   /* IE/Edge old */
}
.scroll-hidden::-webkit-scrollbar{ width: 0; height: 0; }

.drawer :deep(.el-drawer__header){ font-weight: 900; }
.drawer-body{ padding: 6px 2px 0; }
.concept-form :deep(.el-form-item){ margin-bottom: 14px; }

.stock-pick{
  width: 100%;
  display:flex;
  flex-direction:column;
  gap: 10px;
}

/* 顶部 */
.pick-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.pick-left{
  display:flex;
  align-items:center;
  gap: 6px;
  color:#606266;
  font-size: 12px;
  font-weight: 800;
}
.pick-label{ color:#606266; }
.pick-num{ font-weight: 900; color:#1f2d3d; }
.pick-tip{ color:#909399; font-weight: 700; }

.pick-actions{
  display:flex;
  align-items:center;
  gap: 8px;
}

/* 已选区域：更小高度 */
.picked-box{
  border: 1px dashed rgba(0,0,0,.14);
  background: rgba(0,0,0,.015);
  border-radius: 12px;
  padding: 8px 10px;
  overflow: auto;
  max-height: 100px;
}
.picked-box.empty{
  display:flex;
  align-items:center;
  justify-content:center;
}
.picked-tags{
  display:flex;
  flex-wrap:wrap;
  gap: 8px;
}
.picked-tag{ border-radius: 999px; }
.empty-picked{ font-size: 12px; color:#c0c4cc; }

/* 搜索 */
.stock-search{ margin-top: 2px; }

/* ✅ 表格更紧凑：行高、padding、表头间距 */
.stock-table :deep(.el-table__cell){
  padding: 6px 2px;
}
.stock-table :deep(.el-table__header .el-table__cell){
  padding: 6px 10px;
  font-weight: 900;
}

/* 表格 hover */
.stock-table :deep(.el-table__row){ cursor: pointer; }
.stock-table :deep(.el-table__row:hover td){ background: #f5f8ff !important; }

/* ✅ 只隐藏竖向滚动条 */
.stock-table :deep(.el-scrollbar__bar.is-vertical){
  display: none !important;
}

/* ✅ 横向滚动条保留（可选：轻微美化） */
.stock-table :deep(.el-scrollbar__bar.is-horizontal){
  height: 6px;          /* 横向条高度 */
  opacity: 1;
}

.stock-table :deep(.el-scrollbar__thumb){
  background: rgba(0,0,0,0.25);
  border-radius: 4px;
}

/* ✅ 兼容：body/横向滚动容器也不展示滚动条 */
.stock-table :deep(.el-table__body-wrapper),
.stock-table :deep(.el-table__header-wrapper){
  scrollbar-width: none;
}
.stock-table :deep(.el-table__body-wrapper::-webkit-scrollbar),
.stock-table :deep(.el-table__header-wrapper::-webkit-scrollbar){
  width: 0;
  height: 0;
}

/* ✅ 固定列视觉更干净：给固定列右侧一个轻微阴影分隔 */
.stock-table :deep(.el-table__fixed){
  box-shadow: 2px 0 10px rgba(0,0,0,.04);
}

/* ✅ 勾选列更紧凑一点 */
.stock-table :deep(.col-check .cell){
  padding-left: 6px;
  padding-right: 6px;
}

/* ✅ 名称/代码列稍微强调 */
.stock-table :deep(.col-name .cell){
  font-weight: 600;
}
.stock-table :deep(.col-code .cell){
  font-weight: 600;
  color: #606266;
}

.drawer-footer{ display:flex; justify-content:flex-end; gap: 10px; }
.btn-save{ border-radius: 10px; font-weight: 900; }
</style>