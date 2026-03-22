<template>
  <div class="header">
    <div class="right">
      <el-popover placement="bottom-end" :width="360" trigger="click">
        <template #reference>
          <div class="alert-entry" role="button" tabindex="0">
            <el-badge :value="unreadCount" :hidden="!unreadCount" :max="99">
              <el-icon class="alert-icon"><Bell /></el-icon>
            </el-badge>
            <span class="alert-text">提醒</span>
          </div>
        </template>

        <div class="alert-panel">
          <div class="alert-panel-head">
            <span class="alert-panel-title">关注提醒</span>
            <el-button link size="small" @click="markAllRead" :disabled="!unreadCount">全部已读</el-button>
          </div>

          <div v-if="latestAlerts.length" class="alert-list">
            <div
              v-for="alert in latestAlerts"
              :key="alert.id"
              class="alert-item"
              :class="[`level-${alert.level || 'medium'}`, { unread: !alert.read }]"
              @click="markRead(alert.id)"
            >
              <div class="alert-item-top">
                <span class="alert-item-name">{{ alert.targetName }}</span>
                <span class="alert-item-time">{{ formatTime(alert.createdAt) }}</span>
              </div>
              <div class="alert-item-summary">{{ alert.summary }}</div>
            </div>
          </div>

          <div v-else class="alert-empty">暂无提醒</div>
        </div>
      </el-popover>

      <span class="tour-link" @click="startTour" role="button" tabindex="0">
        新手教程
      </span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LayoutHeader'
}
</script>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { createHomeTour } from '@/utils/homeTour'
import { useAlertCenterStore } from '@/stores/alertCenter'
import { Bell } from '@element-plus/icons-vue'

const router = useRouter()
const alertCenter = useAlertCenterStore()
const unreadCount = computed(() => alertCenter.unreadCount || 0)
const latestAlerts = computed(() => alertCenter.latestAlerts || [])

const { start } = createHomeTour({ router })

function startTour() {
  start()
}

const formatTime = (ts) => {
  if (!ts) return '--'
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function markAllRead() {
  alertCenter.markAllRead()
}

function markRead(id) {
  alertCenter.markAlertRead(id)
}
</script>

<style scoped>
.header{
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 10px;
}
.right{
  display: flex;
  align-items: center;
  gap: 14px;
}
.alert-entry{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.94);
  cursor: pointer;
  user-select: none;
}
.alert-icon{
  font-size: 16px;
}
.alert-text{
  font-size: 13px;
  font-weight: 600;
}
.alert-panel-head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.alert-panel-title{
  font-size: 14px;
  font-weight: 700;
  color: #1f2d3d;
}
.alert-list{
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.alert-item{
  padding: 8px 10px;
  border-radius: 8px;
  background: #f7f9fc;
  border: 1px solid #e3e8f0;
  cursor: pointer;
}
.alert-item.unread{
  background: #fffaf3;
}
.alert-item.level-high{
  border-color: rgba(245, 108, 108, .28);
}
.alert-item.level-medium{
  border-color: rgba(230, 162, 60, .28);
}
.alert-item-top{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.alert-item-name{
  font-size: 13px;
  font-weight: 700;
  color: #1f2d3d;
}
.alert-item-time{
  font-size: 11px;
  color: #7d8899;
}
.alert-item-summary{
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #4c566a;
}
.alert-empty{
  font-size: 12px;
  color: #7d8899;
  padding: 10px 0;
}
.tour-link{
  font-size: 13px;
  font-weight: 550;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  user-select: none;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background 0.12s ease, opacity 0.12s ease;
}
.tour-link:hover{
  background: rgba(255, 255, 255, 0.14);
}
.tour-link:active{
  opacity: 0.85;
}
</style>
