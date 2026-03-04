<template>
  <el-dialog
    v-model="visible"
    :title="titleText"
    width="480px"
    class="save-strategy-dialog"
    :close-on-click-modal="false"
    align-center
  >
    <!-- 顶部说明（更专业、更像产品） -->
    <div class="hint">
      <span class="dot" />
      <span class="hint-text">
        将当前条件保存为{{ type === 'select' ? '选股' : '交易' }}策略，方便下次一键应用。
      </span>
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
          placeholder="一句话说明口径（可选）"
          resize="none"
        />
      </el-form-item>

      <!-- 选股：展示“当前排序/当前筛选” -->
      <template v-if="type === 'select'">
        <div class="snap-card">
          <div class="snap-head">
            <span class="snap-title">快照摘要</span>
          </div>

          <div class="snap-row">
            <div class="snap-k">当前排序</div>
            <div class="snap-v">
              <!-- 优先用 tags -->
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

              <!-- 其次用文本 -->
              <template v-else>
                <el-tag
                  size="small"
                  effect="plain"
                  :type="metricsText ? 'success' : 'info'"
                  class="snap-tag"
                  :title="metricsText || '不排序'"
                >
                  {{ metricsText || '不排序' }}
                </el-tag>
              </template>
            </div>
          </div>

          <div class="snap-row">
            <div class="snap-k">当前筛选</div>
            <div class="snap-v">
              <div class="snap-pill" :title="filtersText || '无筛选条件'">
                {{ filtersText || '无筛选条件' }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 交易：占位更“产品化” -->
      <template v-else>
        <div class="snap-card">
          <div class="snap-head">
            <span class="snap-title">快照摘要</span>
            <span class="snap-sub">（结构化信息展示，非JSON）</span>
          </div>
          <div class="snap-row">
            <div class="snap-k">元信息</div>
            <div class="snap-v">
              <div class="snap-pill">
                策略类型 / 适用市场 / 标的类型 / 时间周期
              </div>
            </div>
          </div>
          <div class="snap-row">
            <div class="snap-k">入场/出场</div>
            <div class="snap-v">
              <div class="snap-pill">
                买入条件、触发方式、止盈止损、退出信号
              </div>
            </div>
          </div>
          <div class="snap-row">
            <div class="snap-k">仓位/风控</div>
            <div class="snap-v">
              <div class="snap-pill">
                初始仓位、加减仓规则、回撤约束、黑名单、参数区
              </div>
            </div>
          </div>
        </div>
      </template>
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
  type: { type: String, default: 'select' }, // 'select' | 'trade'
  title: { type: String, default: '' },

  // 选股展示：两种方式（二选一即可）
  metricsTags: { type: Array, default: () => [] }, // [{key,label}]
  metricsText: { type: String, default: '' },      // 纯文本摘要
  filtersText: { type: String, default: '' },

  // 输入框占位
  namePlaceholder: { type: String, default: '例如：资金强势 + 低波回撤' }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const titleText = computed(() => {
  if (props.title) return props.title
  return props.type === 'select' ? '保存策略' : '保存交易策略'
})

const form = reactive({ name: '', desc: '' })

watch(
  () => visible.value,
  (v) => {
    if (v) {
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
/* 让 dialog 内部整体更“高级”：留白、分组、层级 */
.save-strategy-dialog :deep(.el-dialog){
  border-radius: 16px;
  overflow: hidden;
}

.save-strategy-dialog :deep(.el-dialog__header){
  padding: 16px 18px 10px;
}
.save-strategy-dialog :deep(.el-dialog__title){
  font-weight: 900;
  color: #111827;
  letter-spacing: .2px;
}
.save-strategy-dialog :deep(.el-dialog__body){
  padding: 10px 18px 14px;
}
.save-strategy-dialog :deep(.el-dialog__footer){
  padding: 12px 18px 16px;
}

/* 顶部提示 */
.hint{
  display:flex;
  align-items:center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(64,158,255,.16);
  background: rgba(64,158,255,.06);
  margin-bottom: 12px;
}
.dot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(64,158,255,.95);
  box-shadow: 0 0 0 4px rgba(64,158,255,.10);
}
.hint-text{
  font-size: 12px;
  font-weight: 800;
  color:#374151;
}

/* 表单 */
.form :deep(.el-form-item){
  margin-bottom: 12px;
}
.form :deep(.el-form-item__label){
  font-weight: 700;
  color:#6b7280;
}
.form :deep(.el-input__wrapper),
.form :deep(.el-textarea__inner){
  border-radius: 12px;
}
.form :deep(.el-input__inner){
  font-weight: 600;
  color:#111827;
}

/* 快照卡片：更像产品的“信息块” */
.snap-card{
  margin-top: 6px;
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,.06);
  background: rgba(0,0,0,.02);
  padding: 12px;
}
.snap-head{
  display:flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}
.snap-title{
  font-size: 13px;
  font-weight: 800;
  color:#111827;
}
.snap-sub{
  font-size: 12px;
  font-weight: 800;
  color:#9ca3af;
}

/* 摘要行：左 key 右 value */
.snap-row{
  display:grid;
  grid-template-columns: 64px 1fr;
  gap: 10px;
  padding: 8px 0;
}
.snap-row + .snap-row{
  border-top: 1px dashed rgba(0,0,0,.06);
}

.snap-k{
  font-size: 12px;
  font-weight: 900;
  color:#6b7280;
  line-height: 1.4;
  white-space: nowrap;
}
.snap-v{
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items:center;
  min-width: 0;
}

/* tag 更圆润 */
.snap-tag{
  border-radius: 999px;
  font-weight: 900;
}

/* 筛选用 pill，不用 tag，看起来更“信息展示” */
.snap-pill{
  max-width: 100%;
  align-items:center;
  padding: 7px 10px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.7);
  color:#111827;
  font-size: 12px;
  font-weight: 800;
  overflow:hidden;
  text-overflow: ellipsis;
}

/* footer */
.footer{
  display:flex;
  justify-content:flex-end;
  gap: 10px;
}
.btn{
  height: 34px !important;
  border-radius: 12px !important;
  font-weight: 900;
  padding: 0 14px !important;
}
</style>
