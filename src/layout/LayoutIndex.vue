<template>
  <el-container class="layout-root">
    <el-header :height="headerHeight" class="layout-header" id="tour-header">
      <Header />
    </el-header>

    <el-container class="layout-body">
      <el-aside width="284px" class="layout-aside layout-aside-left" id="tour-sidebar">
        <div class="aside-inner">
          <div class="aside-nav">
            <Sidebar />
          </div>
        </div>
      </el-aside>

      <el-main class="layout-main" id="tour-main">
        <div class="main-inner">
          <div class="news-sticky" v-if="showNews" id="tour-news">
            <NewsPanel />
          </div>

          <div class="main-scroll scroll-hidden" id="tour-main-scroll">
            <router-view />
          </div>
        </div>
      </el-main>

      <el-aside width="284px" class="layout-aside layout-aside-right">
        <div class="right-inner">
          <div class="right-strategy" id="tour-strategy">
            <StrategyDock />
          </div>
          <div class="right-plan" id="tour-plan">
            <InvestmentPlanDock />
          </div>
        </div>
      </el-aside>
    </el-container>
  </el-container>
</template>

<script>
import Header from './Header.vue'
import Sidebar from './Sidebar.vue'
import StrategyDock from './StrategyDock.vue'
import InvestmentPlanDock from './InvestmentPlanDock.vue'
import NewsPanel from '@/components/NewsPanel.vue'

export default {
  name: 'LayoutIndex',
  components: {
    Header,
    Sidebar,
    StrategyDock,
    InvestmentPlanDock,
    NewsPanel
  },
  data() {
    return {
      headerHeight: '45px'
    }
  },
  computed: {
    showNews() {
      const p = this.$route.path || ''
      return (
        p === '/home' ||
        p.startsWith('/concept/') ||
        p.startsWith('/my-concept/') ||
        p === '/industry' ||
        p.startsWith('/industry/')
      )
    }
  }
}
</script>

<style scoped>
.scroll-hidden{
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scroll-hidden::-webkit-scrollbar{
  width: 0;
  height: 0;
}

.layout-root{
  --header-height: 45px;
  height: 100vh;
  overflow: hidden;
}

.layout-header{
  background: #589eee;
  color: #fff;
  display: flex;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10;
}

.layout-body{
  margin-top: var(--header-height);
  height: calc(100vh - var(--header-height));
  overflow: hidden;
  display: grid;
  grid-template-columns: 284px 1fr 284px;
  background: #f4f7fb;
}

.layout-aside{
  height: 100%;
  overflow: hidden;
  min-width: 0;
  background: #f7f9fc;
}
.layout-aside-left{
  border-right: 1px solid #cfd8e5;
  box-shadow: inset -1px 0 0 rgba(255,255,255,.85);
}
.layout-aside-right{
  border-left: 1px solid #cfd8e5;
  box-shadow: inset 1px 0 0 rgba(255,255,255,.85);
}

.aside-inner{
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 6px 6px 6px 6px;
}
.aside-nav{
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.right-inner{
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1.3fr) minmax(0, 1.2fr);
  gap: 12px;
  padding: 6px;
}
.right-strategy,
.right-plan{
  min-height: 0;
  overflow: hidden;
  display: flex;
  justify-content: stretch;
}
.right-plan{
  padding-top: 10px;
  border-top: 1px solid #cfd8e5;
}

.layout-main{
  background-color: #f5f7fa;
  padding: 16px;
  height: 100%;
  overflow: hidden;
  min-width: 0;
}

.main-inner{
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}

.news-sticky{
  position: sticky;
  top: 0;
  height: 40px;
  flex-shrink: 0;
  margin-left: 10px;
  margin-right: 10px;
  align-items: center;
}

.main-scroll{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
