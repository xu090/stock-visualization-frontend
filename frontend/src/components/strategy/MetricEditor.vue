<template>
  <div class="metric-editor">
    <div class="metric-selected-box">
      <Draggable
        v-model="selectedMetricObjs"
        item-key="key"
        :animation="150"
        handle=".handle"
        ghost-class="ghost"
        chosen-class="chosen"
        drag-class="drag"
        class="metric-selected"
      >
        <template #item="{ element, index }">
          <span class="mchip active" :title="`优先级 ${index + 1}（可拖拽）`">
            <span class="ord">{{ index + 1 }}</span>
            <span class="handle" title="拖拽">⋮⋮</span>
            <span class="mname">{{ element.label }}</span>
            <span class="mx" title="移除" @click.stop="removeMetric(element.key)">×</span>
          </span>
        </template>

        <template #footer>
          <span v-if="selectedMetricObjs.length === 0" class="metric-empty">
            点击下方“可选指标”添加；支持拖拽排序
          </span>
        </template>
      </Draggable>
    </div>

    <div class="metric-opt">
      <div class="opt-title">可选指标</div>
      <div class="mchips">
        <span
          v-for="m in metricDefs"
          :key="m.key"
          class="mchip"
          :class="{ disabled: isSelected(m.key) }"
          :title="m.tip + '（点击添加）'"
          @click="addMetric(m.key)"
        >
          <span class="mname">{{ m.label }}</span>
          <span class="mplus" v-if="!isSelected(m.key)">＋</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
/* global defineProps, defineEmits */
import { computed } from 'vue'
import Draggable from 'vuedraggable'
import { ElMessage } from 'element-plus'

const props = defineProps({
  /** v-model:selectedKeys */
  selectedKeys: { type: Array, default: () => [] }, // string[]
  metricDefs: { type: Array, default: () => [] } // {key,label,tip}[]
})

const emit = defineEmits(['update:selectedKeys'])

const metricLabel = (k) => props.metricDefs.find(x => x.key === k)?.label || k
const visibleMetricKeys = computed(() => new Set(props.metricDefs.map(item => item.key)))
const normalizeMetricKey = key => (key === 'netInflow' ? 'changeAmount' : key)
const normalizedSelectedKeys = computed(() => (props.selectedKeys || [])
  .map(normalizeMetricKey)
  .filter(key => visibleMetricKeys.value.has(key))
  .slice(0, 3))

/** 给 draggable 用的对象数组 */
const selectedMetricObjs = computed({
  get: () => normalizedSelectedKeys.value.map(k => ({ key: k, label: metricLabel(k) })),
  set: (objs) => {
    const keys = (Array.isArray(objs) ? objs : [])
      .map(x => normalizeMetricKey(x?.key))
      .filter(key => visibleMetricKeys.value.has(key))
      .slice(0, 3)
    emit('update:selectedKeys', keys)
  }
})

const isSelected = (key) => normalizedSelectedKeys.value.includes(key)

const addMetric = (key) => {
  if (isSelected(key)) return
  const arr = normalizedSelectedKeys.value.slice()
  if (arr.length >= 3) return ElMessage.warning('最多选择 3 个')
  arr.push(key)
  emit('update:selectedKeys', arr)
}

const removeMetric = (key) => {
  emit('update:selectedKeys', normalizedSelectedKeys.value.filter(x => x !== key))
}
</script>

<style scoped>
.metric-editor{
  border: 1px solid rgba(0,0,0,.06);
  background: rgba(0,0,0,.02);
  border-radius: 14px;
  padding: 12px;
  display:flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  min-height: 220px;
}

.metric-selected-box{
  border: 1px dashed rgba(0,0,0,.14);
  background: rgba(255,255,255,.78);
  border-radius: 14px;
  padding: 12px;
  max-height: 120px;
  overflow: auto;
}

.metric-selected{ display:flex; flex-wrap: wrap; gap: 10px; align-items:center; }
.metric-empty{ font-size: 12px; color:#909399; font-weight: 800; }

.metric-opt{
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
.opt-title{
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 6px 0 10px;
  background: rgba(0,0,0,.02);
  font-weight: 900;
  font-size: 12px;
  color:#6b7280;
}
.mchips{ display:flex; flex-wrap: wrap; gap: 10px; }

.mchip{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.86);
  cursor: pointer;
  user-select:none;
  transition: all .16s ease;
  font-size: 12px;
  font-weight: 900;
  color:#303133;
}
.mchip:hover{ transform: translateY(-1px); box-shadow: 0 10px 18px rgba(0,0,0,.06); }
.mchip.active{ border-color: rgba(64,158,255,.35); background: rgba(64,158,255,.10); }
.mchip.disabled{ opacity: .55; cursor: not-allowed; transform:none; box-shadow:none; }
.mname{ font-weight: 900; }
.mplus{ color:#67c23a; font-weight: 900; }
.mx{ color:#409eff; font-weight: 900; cursor:pointer; }

.ord{
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size: 12px;
  font-weight: 900;
  color:#409eff;
  border: 1px solid rgba(64,158,255,.25);
  background: rgba(64,158,255,.08);
}
.handle{ font-weight: 900; cursor: grab; padding: 0 2px; color:#606266; }
.ghost{ opacity: .45; }
.chosen{ box-shadow: 0 10px 18px rgba(0,0,0,.10); }
.drag{ opacity: .9; }
</style>
