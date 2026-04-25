<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div class="filter-editor hide-scrollbar">
    <div class="f-row">
      <div class="f-name">涨跌幅（%）</div>
      <div class="f-range">
        <el-input-number v-model="filters.minChange" :min="-20" :max="20" :step="0.5" controls-position="right" placeholder="≥" />
        <span class="sep">~</span>
        <el-input-number v-model="filters.maxChange" :min="-20" :max="20" :step="0.5" controls-position="right" placeholder="≤" />
      </div>
    </div>

    <div class="f-row">
      <div class="f-name">成交额（亿）</div>
      <div class="f-range">
        <el-input-number v-model="filters.minAmountY" :min="0" :max="200" :step="1" controls-position="right" placeholder="≥" />
        <span class="sep">~</span>
        <el-input-number v-model="filters.maxAmountY" :min="0" :max="200" :step="1" controls-position="right" placeholder="≤" />
      </div>
    </div>

    <div class="f-row">
      <div class="f-name">涨跌额</div>
      <div class="f-range">
        <el-input-number v-model="filters.minChangeAmount" :min="-20" :max="20" :step="0.1" controls-position="right" placeholder="≥" />
        <span class="sep">~</span>
        <el-input-number v-model="filters.maxChangeAmount" :min="-20" :max="20" :step="0.1" controls-position="right" placeholder="≤" />
      </div>
    </div>

    <div class="f-row">
      <div class="f-name">上涨占比（%）</div>
      <div class="f-range slider">
        <el-slider small v-model="upRatioRangePct" range :min="0" :max="100" :step="5" show-input />
      </div>
    </div>

    <div class="f-row">
      <div class="f-name">波动率 / 20日回撤</div>
      <div class="f-range">
        <el-input-number v-model="filters.maxVolatility" :min="0" :max="60" :step="1" controls-position="right" placeholder="波动≤" />
        <span class="sep">/</span>
        <el-input-number v-model="filters.maxDrawdown20d" :min="-60" :max="0" :step="1" controls-position="right" placeholder="回撤≥" />
      </div>
    </div>
  </div>
</template>

<script setup>
/* global defineProps */
/* eslint-disable vue/no-mutating-props */
import { computed } from 'vue'

const props = defineProps({
  filters: { type: Object, required: true }
})

const upRatioRangePct = computed({
  get: () => {
    const f = props.filters || {}
    const min = f.minUpRatio == null ? 0 : Math.round(Number(f.minUpRatio) * 100)
    const max = f.maxUpRatio == null ? 100 : Math.round(Number(f.maxUpRatio) * 100)
    return [min, max]
  },
  set: (arr) => {
    const [min, max] = Array.isArray(arr) ? arr : [0, 100]
    props.filters.minUpRatio = min === 0 ? null : Number(min) / 100
    props.filters.maxUpRatio = max === 100 ? null : Number(max) / 100
  }
})
</script>

<style scoped>
.filter-editor{
  height: 436px;
  border: 1px solid rgba(0,0,0,.06);
  background: rgba(0,0,0,.02);
  border-radius: 14px;
  padding: 12px;
  display:flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.hide-scrollbar{
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar{
  width: 0;
  height: 0;
}

.f-row{
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
}
.f-name{
  flex: 0 0 112px;
  font-size: 12px;
  font-weight: 900;
  color:#303133;
  padding-top: 6px;
}
.f-range{
  flex: 1 1 auto;
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap: wrap;
}
.f-range.slider{ align-items: center; }
.sep{
  color:#909399;
  font-weight: 900;
}

:deep(.el-input-number){
  width: 100px;
}
:deep(.el-slider){
  width: 100%;
  min-width: 260px;
}
</style>
