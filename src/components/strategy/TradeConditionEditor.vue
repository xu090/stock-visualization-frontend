<template>
  <div class="cond-editor">
    <div v-if="!rows.length" class="empty-tip">暂无条件，点击下方“新增条件”开始配置。</div>

    <div v-for="(row, idx) in rows" :key="idx" class="cond-row">
      <div class="cond-row-main">
        <el-select
          v-if="idx > 0"
          v-model="row.connector"
          size="small"
          class="w-join"
        >
          <el-option label="并且(AND)" value="AND" />
          <el-option label="或者(OR)" value="OR" />
        </el-select>
        <div v-else class="first-tag">条件{{ idx + 1 }}</div>

        <el-select v-model="row.field" size="small" class="w-field">
          <el-option
            v-for="f in fields"
            :key="f.key"
            :label="f.label"
            :value="f.key"
          />
        </el-select>

        <el-select v-model="row.op" size="small" class="w-op">
          <el-option
            v-for="op in operators"
            :key="op.value"
            :label="op.label"
            :value="op.value"
          />
        </el-select>
      </div>

      <div class="cond-row-sub">
        <el-input-number
          v-model="row.value"
          :step="0.1"
          :precision="2"
          controls-position="right"
          class="w-val"
        />

        <span class="unit">{{ unitOf(row.field) || '-' }}</span>

        <el-button link type="danger" class="btn-delete" @click="removeRow(idx)">删除</el-button>
      </div>
    </div>

    <div class="cond-actions">
      <el-button size="small" plain @click="addRow">新增条件</el-button>
      <el-button size="small" plain @click="clearRows" :disabled="rows.length === 0">清空</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, defineEmits, defineProps } from 'vue'
import { TRADE_CONDITION_FIELD_OPTIONS, TRADE_CONDITION_OPERATORS } from '@/utils/tradeStrategy'

const props = defineProps({
  modelValue: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const fields = TRADE_CONDITION_FIELD_OPTIONS
const operators = TRADE_CONDITION_OPERATORS

const rows = computed({
  get: () => (Array.isArray(props.modelValue) ? props.modelValue : []),
  set: (v) => emit('update:modelValue', Array.isArray(v) ? v : [])
})

const addRow = () => {
  const next = rows.value.slice()
  next.push({
    field: 'changePercent',
    op: '>=',
    value: 0,
    connector: next.length === 0 ? 'AND' : 'AND'
  })
  rows.value = next
}

const removeRow = (idx) => {
  const next = rows.value.slice()
  next.splice(idx, 1)
  rows.value = next
}

const clearRows = () => {
  rows.value = []
}

const unitOf = (field) => fields.find(x => x.key === field)?.unit || ''
</script>

<style scoped>
.cond-editor{
  display:flex;
  flex-direction: column;
  gap: 10px;
}
.empty-tip{
  font-size: 12px;
  color:#64748b;
  font-weight: 700;
  background: rgba(148, 163, 184, .08);
  border: 1px dashed rgba(148, 163, 184, .3);
  border-radius: 10px;
  padding: 10px 12px;
}
.cond-row{
  display:flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(0,0,0,.06);
  border-radius: 10px;
  padding: 10px;
  background: #fff;
}
.cond-row-main{
  display:grid;
  grid-template-columns: 96px 1fr 118px;
  gap: 8px;
  align-items:center;
}
.cond-row-sub{
  display:grid;
  grid-template-columns: minmax(140px, 1fr) 42px auto;
  gap: 8px;
  align-items:center;
}
.w-join{ width: 100%; }
.w-field{ width: 100%; }
.w-op{ width: 100%; }
.w-val{ width: 100%; }
.first-tag{
  width: 100%;
  height: 32px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  color:#6b7280;
  background: rgba(0,0,0,.03);
  border: 1px solid rgba(0,0,0,.06);
}
.unit{
  font-size: 12px;
  color:#6b7280;
  min-width: 24px;
  font-weight: 700;
}
.btn-delete{
  justify-self: end;
}
.cond-actions{
  display:flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 820px){
  .cond-row-main{
    grid-template-columns: 1fr;
  }
  .cond-row-sub{
    grid-template-columns: 1fr auto auto;
  }
}
</style>
