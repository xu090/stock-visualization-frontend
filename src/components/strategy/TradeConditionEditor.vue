<template>
  <div class="cond-editor">
    <div v-if="!rows.length" class="empty-tip">暂无条件，点击下方“新增条件”。</div>

    <div v-for="(row, idx) in rows" :key="idx" class="cond-row">
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

      <el-input-number
        v-model="row.value"
        :step="0.1"
        :precision="2"
        controls-position="right"
        class="w-val"
      />

      <span class="unit">{{ unitOf(row.field) }}</span>

      <el-button link type="danger" @click="removeRow(idx)">删除</el-button>
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
  color:#9ca3af;
  font-weight: 700;
}
.cond-row{
  display:flex;
  align-items:center;
  gap: 8px;
  flex-wrap: wrap;
}
.w-join{ width: 100px; }
.w-field{ width: 140px; }
.w-op{ width: 110px; }
.w-val{ width: 150px; }
.first-tag{
  min-width: 100px;
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
  min-width: 18px;
}
.cond-actions{
  display:flex;
  gap: 8px;
}
</style>
