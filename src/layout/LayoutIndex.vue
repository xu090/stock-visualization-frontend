<template>
  <el-container class="layout-root">
    <!-- 顶部 -->
    <el-header :height="headerHeight" class="layout-header" id="tour-header">
      <Header />
    </el-header>

    <el-container class="layout-body">
      <!-- 左侧 -->
      <el-aside width="220px" class="layout-aside" id="tour-sidebar">
        <div class="aside-inner">
          <div class="aside-nav">
            <Sidebar />
          </div>
          <div class="aside-dock" id="tour-strategy">
            <StrategyDock />
          </div>
        </div>
      </el-aside>

      <!-- 主体 -->
      <el-main class="layout-main" id="tour-main">
        <div class="main-inner">
          <!-- ✅ 新闻条：固定在主区域顶部，不参与滚动 -->
          <div class="news-sticky" v-if="showNews" id="tour-news">
            <NewsPanel />
          </div>

          <!-- ✅ 只有这里滚动（滚动条隐藏） -->
          <div class="main-scroll scroll-hidden" id="tour-main-scroll">
            <router-view />
          </div>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import Header from './Header.vue'
import Sidebar from './Sidebar.vue'
import StrategyDock from './StrategyDock.vue'
import NewsPanel from '@/components/NewsPanel.vue'

export default {
  name: 'LayoutIndex',
  components: {
    Header,
    Sidebar,
    StrategyDock,
    NewsPanel
  },
  data() {
    return {
      headerHeight: '45px' // ✅ Header 高度
    }
  },
  computed: {
    // ✅ 新闻条出现的路由范围（已补上 /concept/:id）
    showNews() {
      const p = this.$route.path || ''
      return (
        p === '/home' ||
        p.startsWith('/concept/') ||     // ✅ 关键：概念详情 /concept/:id
        p.startsWith('/my-concept/') ||  // ✅ 兼容旧路由（可保留）
        p === '/industry' ||
        p.startsWith('/industry/')
      )
    }
  }
}
</script>

<style scoped>
/* ✅ 隐藏滚动条但保留滚动能力 */
.scroll-hidden{
  scrollbar-width: none;      /* Firefox */
  -ms-overflow-style: none;   /* IE/Edge legacy */
}
.scroll-hidden::-webkit-scrollbar{
  width: 0;
  height: 0;
}

/* ✅ 统一 Header 高度变量（必须和 headerHeight 一致） */
.layout-root{
  --header-height: 45px; /* ✅ 与 headerHeight 对齐 */
  height: 100vh;
  overflow: hidden;
}

/* Header 固定 */
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

/* body 区域让出 header */
.layout-body{
  margin-top: var(--header-height);
  height: calc(100vh - var(--header-height));
  overflow: hidden;
}

/* Aside 固定 */
.layout-aside{
  background-color: #ffffff;
  border-right: 1px solid #ebeef5;

  position: fixed;
  top: var(--header-height);
  left: 0;
  height: calc(100vh - var(--header-height));
  z-index: 9;

  overflow: hidden;
}

/* aside 内部 column */
.aside-inner{
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.aside-nav{
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.aside-dock{
  flex-shrink: 0;
  height: 350px;
}

/* 主体：不再自己滚动（滚动放到 main-scroll） */
.layout-main{
  background-color: #f5f7fa;
  padding: 16px;

  margin-left: 220px;
  height: calc(100vh - var(--header-height));
  overflow: hidden; /* ✅ 主容器不滚 */
}

/* 主体内部：列布局 */
.main-inner{
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0; /* ✅ 允许子元素滚动 */
}

/* ✅ 新闻条固定：占位+粘性顶部（在 main-inner 里不滚动） */
.news-sticky{
  position: sticky;
  top: 0;
  height: 40px;     /* ✅ NewsPanel 高度 40px */
  flex-shrink: 0;
  margin-left: 10px;
  margin-right: 10px;
  align-items: center;
}

/* ✅ 只有这里滚动（新闻条下面的区域） */
.main-scroll{
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
