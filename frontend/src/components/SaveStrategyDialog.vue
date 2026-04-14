<template>
  <el-dialog
    v-model="visible"
    :title="titleText"
    width="480px"
    class="save-strategy-dialog"
    :close-on-click-modal="false"
    draggable
    align-center
  >
    <div class="hint">
      <span class="dot" />
      <span class="hint-text">将当前筛选条件保存为策略，方便下次一键应用。</span>
    </div>

    <el-form label-width="86px" class="form">
      <el-form-item label="策略名称" required>
        <el-input
          v-model="form.name"
          :placeholder="namePlaceholder"
          maxlength="24"
          show-word-limit
          clearable
        />
      </el-form-item>

      <el-form-item label="策略描述">
        <el-input
          v-model="form.desc"
          type="textarea"
          :rows="3"
          maxlength="80"
          show-word-limit
          placeholder="一句话说明这组筛选策略（可选）"
          resize="none"
        />
      </el-form-item>

      <div class="snap-card">
        <div class="snap-head">
          <span class="snap-title">快照摘要</span>
        </div>

        <div class="snap-row">
          <div class="snap-k">当前排序</div>
          <div class="snap-v">
            <template v-if="(metricsTags || []).length">
              <el-tag
                v-for="m in metricsTags"
                :key="m.key || m.label"
                size="small"
                effect="plain"
                class="snap-tag"
              >
                {{ m.label }}
              </el-tag>
            </template>
            <template v-else>
              <el-tag
                size="small"
                effect="plain"
                :type="metricsText ? 'success' : 'info'"
                class="snap-tag"
              >
                {{ metricsText || '未设置排序' }}
              </el-tag>
            </template>
          </div>
        </div>

        <div class="snap-row">
          <div class="snap-k">当前筛选</div>
          <div class="snap-v">
            <div class="snap-pill">{{ filtersText || '无筛选条件' }}</div>
          </div>
        </div>
      </div>
    </el-form>

    <template #footer>
      <div class="footer">
        <el-button class="btn" plain @click="visible = false">取消</el-button>
        <el-button class="btn" type="primary" @click="onConfirm">确认保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, defineEmits, defineProps, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  metricsTags: { type: Array, default: () => [] },
  metricsText: { type: String, default: '' },
  filtersText: { type: String, default: '' },
  namePlaceholder: { type: String, default: '例如：资金优先 + 放量突破' }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const titleText = computed(() => props.title || '保存筛选策略')

const form = reactive({ name: '', desc: '' })

watch(
  () => visible.value,
  value => {
    if (value) {
      form.name = ''
      form.desc = ''
    }
  }
)

const onConfirm = () => {
  if (!form.name?.trim()) {
    ElMessage.warning('请输入策略名称')
    return
  }
  emit('confirm', { name: form.name.trim(), desc: (form.desc || '').trim() })
}
</script>

<style scoped>
.save-strategy-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

.save-strategy-dialog :deep(.el-dialog__header) {
  padding: 16px 18px 10px;
}

.save-strategy-dialog :deep(.el-dialog__title) {
  font-weight: 900;
  color: #111827;
}

.save-strategy-dialog :deep(.el-dialog__body) {
  padding: 10px 18px 14px;
}

.save-strategy-dialog :deep(.el-dialog__footer) {
  padding: 12px 18px 16px;
}

.hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(64, 158, 255, 0.16);
  background: rgba(64, 158, 255, 0.06);
  margin-bottom: 12px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(64, 158, 255, 0.95);
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.1);
}

.hint-text {
  font-size: 12px;
  font-weight: 800;
  color: #374151;
}

.form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.form :deep(.el-form-item__label) {
  font-weight: 700;
  color: #6b7280;
}

.form :deep(.el-input__wrapper),
.form :deep(.el-textarea__inner) {
  border-radius: 12px;
}

.snap-card {
  margin-top: 6px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
  padding: 12px;
}

.snap-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}

.snap-title {
  font-size: 13px;
  font-weight: 800;
  color: #111827;
}

.snap-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 10px;
  padding: 8px 0;
}

.snap-row + .snap-row {
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

.snap-k {
  font-size: 12px;
  font-weight: 900;
  color: #6b7280;
  line-height: 1.4;
  white-space: nowrap;
}

.snap-v {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.snap-tag {
  border-radius: 999px;
  font-weight: 900;
}

.snap-pill {
  max-width: 100%;
  align-items: center;
  padding: 7px 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: #111827;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  height: 34px !important;
  border-radius: 12px !important;
  font-weight: 900;
  padding: 0 14px !important;
}
</style>
