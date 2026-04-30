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

      <button v-if="auth.isAdmin" type="button" class="admin-entry" @click="goAdmin">
        系统管理
      </button>

      <button type="button" class="auth-entry" @click="openAuthDialog">
        <el-icon><User /></el-icon>
        <span>{{ auth.user?.username || '登录 / 注册' }}</span>
      </button>
    </div>

    <el-dialog
      v-model="authDialogVisible"
      :width="auth.isLoggedIn ? '560px' : '480px'"
      class="auth-dialog"
      :show-close="true"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="auth.isLoggedIn" class="account-shell">
        <div class="account-title">
          <el-icon><User /></el-icon>
          <span>账户设置</span>
        </div>

        <div class="account-hero">
          <div class="account-avatar">{{ accountInitial }}</div>
          <div class="account-info">
            <div class="auth-kicker">当前账号</div>
            <div class="account-name">{{ auth.user.username }}</div>
          </div>
        </div>

        <section class="account-card">
          <el-form class="account-form" label-position="top" @submit.prevent>
            <el-form-item label="用户名">
              <div class="account-inline">
                <el-input v-model.trim="accountForm.username" size="large" placeholder="至少 3 个字符" />
              <el-button type="primary" plain size="large" :loading="auth.loading" @click="saveUsername">
                  保存
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </section>

        <section class="account-card">
          <div class="account-card-title">修改密码</div>
          <el-form class="account-form" label-position="top" @submit.prevent>
            <el-form-item>
              <el-input v-model="accountForm.currentPassword" size="large" type="password" show-password placeholder="原密码" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="accountForm.newPassword" size="large" type="password" show-password placeholder="新密码，至少 6 个字符" />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="accountForm.confirmPassword"
                size="large"
                type="password"
                show-password
                placeholder="再次输入新密码"
                @keyup.enter="savePassword"
              />
            </el-form-item>

            <el-button class="account-submit" type="primary" plain :loading="auth.loading" @click="savePassword">
              修改密码
            </el-button>
          </el-form>
        </section>

        <section v-if="auth.isAdmin" class="account-card">
          <el-button class="account-admin" plain @click="goAdmin">
            进入系统管理台
          </el-button>
        </section>

        <section class="account-card">
          <el-button class="account-logout" type="primary" @click="logout">
            <el-icon><SwitchButton /></el-icon>
            退出登录
          </el-button>
        </section>
      </div>

      <div v-else class="auth-shell">
        <section class="auth-main">
          <el-tabs v-model="authMode" class="auth-tabs" stretch>
            <el-tab-pane label="登录" name="login" />
            <el-tab-pane label="注册" name="register" />
          </el-tabs>

          <div class="auth-main-head">
            <div>
              <div class="auth-kicker">{{ authMode === 'login' ? 'Welcome back' : 'Create account' }}</div>
              <h3>{{ authMode === 'login' ? '登录账号' : '注册账号' }}</h3>
            </div>
          </div>

          <el-form class="auth-form" label-position="top" @submit.prevent>
            <el-form-item label="用户名">
              <el-input
                v-model.trim="authForm.username"
                size="large"
                placeholder="至少 3 个字符"
                @keyup.enter="submitAuth"
              >
                <template #prefix>
                  <el-icon><User /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="密码">
              <el-input
                v-model="authForm.password"
                size="large"
                placeholder="至少 6 个字符"
                type="password"
                show-password
                @keyup.enter="submitAuth"
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-form>

          <el-button type="primary" size="large" class="auth-submit" :loading="auth.loading" @click="submitAuth">
            {{ authMode === 'login' ? '登录' : '注册并登录' }}
          </el-button>

          <button type="button" class="auth-switch" @click="toggleAuthMode">
            {{ authMode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录' }}
          </button>
        </section>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'LayoutHeader'
}
</script>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createHomeTour } from '@/utils/homeTour'
import { useAlertCenterStore } from '@/stores/alertCenter'
import { useAuthStore } from '@/stores/auth'
import { useConceptStore } from '@/stores/concept'
import { useStockStore } from '@/stores/stock'
import { useStrategyStore } from '@/stores/strategy'
import { Bell, Lock, SwitchButton, User } from '@element-plus/icons-vue'

const router = useRouter()
const alertCenter = useAlertCenterStore()
const auth = useAuthStore()
const conceptStore = useConceptStore()
const stockStore = useStockStore()
const strategyStore = useStrategyStore()
const unreadCount = computed(() => alertCenter.unreadCount || 0)
const latestAlerts = computed(() => alertCenter.latestAlerts || [])
const accountInitial = computed(() => String(auth.user?.username || 'U').slice(0, 1).toUpperCase())
const authDialogVisible = ref(false)
const authMode = ref('login')
const authForm = reactive({ username: '', password: '' })
const accountForm = reactive({
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const { start } = createHomeTour({ router })

function startTour() {
  start()
}

function openAuthDialog() {
  accountForm.username = auth.user?.username || ''
  accountForm.currentPassword = ''
  accountForm.newPassword = ''
  accountForm.confirmPassword = ''
  authDialogVisible.value = true
}

function goAdmin() {
  authDialogVisible.value = false
  router.push('/admin')
}

function toggleAuthMode() {
  authMode.value = authMode.value === 'login' ? 'register' : 'login'
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

async function refreshUserData() {
  conceptStore.loaded = false
  strategyStore.loaded = false
  stockStore.myStocksLoaded = false
  await Promise.allSettled([
    conceptStore.fetchConceptOverview(),
    strategyStore.fetchSelectStrategies(),
    stockStore.fetchFavoriteStocks()
  ])
}

async function submitAuth() {
  if (!authForm.username || !authForm.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  try {
    if (authMode.value === 'login') await auth.login(authForm.username, authForm.password)
    else await auth.register(authForm.username, authForm.password)
    authForm.password = ''
    authDialogVisible.value = false
    await refreshUserData()
    ElMessage.success(authMode.value === 'login' ? '登录成功' : '注册成功')
  } catch (error) {
    ElMessage.error(error?.message || '操作失败')
  }
}

async function saveUsername() {
  if (!accountForm.username) {
    ElMessage.warning('请输入用户名')
    return
  }
  try {
    await auth.updateAccount({ username: accountForm.username })
    ElMessage.success('用户名已更新')
  } catch (error) {
    ElMessage.error(error?.message || '用户名更新失败')
  }
}

async function savePassword() {
  if (!accountForm.currentPassword || !accountForm.newPassword || !accountForm.confirmPassword) {
    ElMessage.warning('请完整填写原密码和新密码')
    return
  }
  if (accountForm.newPassword !== accountForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  try {
    await auth.updateAccount({
      currentPassword: accountForm.currentPassword,
      newPassword: accountForm.newPassword,
      confirmPassword: accountForm.confirmPassword
    })
    accountForm.currentPassword = ''
    accountForm.newPassword = ''
    accountForm.confirmPassword = ''
    ElMessage.success('密码已更新')
  } catch (error) {
    ElMessage.error(error?.message || '密码更新失败')
  }
}

async function logout() {
  await auth.logout()
  authDialogVisible.value = false
  await refreshUserData()
  ElMessage.success('已退出登录')
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
.admin-entry{
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(255,255,255,.24);
  background: rgba(15,23,42,.16);
  color: rgba(255,255,255,.96);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}
.admin-entry:hover{
  background: rgba(15,23,42,.28);
}
.auth-entry{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255,255,255,.34);
  background: rgba(255,255,255,.14);
  color: rgba(255,255,255,.96);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.auth-entry:hover{
  background: rgba(255,255,255,.20);
}

:deep(.auth-dialog .el-dialog){
  border-radius: 34px;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .24);
  padding: 0;
}
:deep(.auth-dialog .el-dialog__header){
  height: 0;
  padding: 0;
  margin: 0;
}
:deep(.auth-dialog .el-dialog__body){
  padding: 0;
}
:deep(.auth-dialog .el-dialog__headerbtn){
  z-index: 5;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  background: transparent;
}
:deep(.auth-dialog .el-dialog__close){
  color: #64748b;
  font-size: 18px;
  font-weight: 900;
}
.auth-shell{
  min-height: 390px;
  display: block;
  background: #fff;
}
.auth-kicker{
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .04em;
  color: #60a5fa;
}
.auth-main{
  max-width: 100%;
  margin: 0 auto;
  padding: 42px 42px 36px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.auth-main-head{
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.auth-main h3{
  margin: 6px 0 0;
  font-size: 24px;
  line-height: 1.2;
  color: #111827;
  letter-spacing: 0;
}
.auth-tabs{
  margin-bottom: 26px;
}
.auth-tabs :deep(.el-tabs__header){
  margin: 0;
}
.auth-tabs :deep(.el-tabs__item){
  font-weight: 900;
}
.auth-tabs :deep(.el-tabs__active-bar){
  height: 3px;
  border-radius: 999px;
}
.auth-form :deep(.el-form-item){
  margin-bottom: 18px;
}
.auth-form :deep(.el-form-item__label){
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
  color: #374151;
  margin-bottom: 8px;
}
.auth-submit{
  width: 100%;
  margin-top: 4px;
  font-weight: 800;
}
.auth-switch{
  margin: 16px auto 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}
.account-shell{
  min-height: 360px;
  padding: 18px;
  display: grid;
  gap: 12px;
  background: #fff;
}
.account-title{
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 900;
  color: #111827;
}
.account-title .el-icon{
  color: #2563eb;
  font-size: 20px;
}
.account-hero{
  min-height: 78px;
  border: 1px solid #cfe1ff;
  border-radius: 10px;
  background: linear-gradient(100deg, #f5f9ff 0%, #eef6ff 55%, #f8fbff 100%);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
}
.account-avatar{
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #eef6ff;
  border: 3px solid #fff;
  color: #2563eb;
  font-size: 22px;
  font-weight: 900;
  box-shadow: 0 10px 24px rgba(37, 99, 235, .12);
}
.account-name{
  margin-top: 4px;
  font-size: 20px;
  font-weight: 900;
  color: #111827;
}
.account-card{
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
}
.account-card-title{
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 900;
  color: #111827;
}
.account-form{
  display: grid;
  gap: 2px;
}
.account-form :deep(.el-form-item){
  margin-bottom: 8px;
}
.account-form :deep(.el-form-item__label){
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
  color: #374151;
  margin-bottom: 8px;
}
.account-inline{
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 64px;
  gap: 8px;
}
.account-inline :deep(.el-button){
  height: 34px;
  align-self: center;
  padding: 0 14px;
  font-size: 13px;
}
.account-submit{
  width: 100%;
  margin-bottom: 4px;
}
.account-logout{
  width: 100%;
  height: 40px;
  font-weight: 900;
  gap: 10px;
}
.account-admin{
  width: 100%;
  height: 38px;
  font-weight: 800;
}
.account-logout .el-icon{
  margin-right: 8px;
}

@media (max-width: 820px) {
  :deep(.auth-dialog .el-dialog){
    width: min(92vw, 480px) !important;
  }
  .auth-shell{
    grid-template-columns: 1fr;
  }
  .auth-side{
    min-height: 210px;
  }
  .auth-main{
    padding: 28px;
  }
}
</style>
