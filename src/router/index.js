import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/LayoutIndex.vue'
import MarketView from '@/views/MarketView.vue'
import ConceptCreate from '@/views/ConceptCreate.vue'
import StockView from '@/views/StockView.vue' // ✅ 新增：股票详情页（你后面做）

const routes = [
  {
    path: '/',
    component: Layout,
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: '主页' }   
      },
      // 行业详情（可选保留）
      {
        path: 'industry/:id',
        name: 'Industry',
        component: MarketView,
        meta: { title: '行业详情' }
      },

      // 概念详情（系统概念）
      {
        path: 'concept/:id',
        name: 'Concept',
        component: MarketView,
        meta: { title: '概念详情' }
      },

      // 我的概念详情（收藏/自建）
      {
        path: 'my-concept/:id',
        name: 'MyConcept',
        component: MarketView,
        meta: { title: '我的概念详情' }
      },

      // ✅ 股票详情（系统/成分股点击进入）
      {
        path: 'stock/:code',
        name: 'Stock',
        component: StockView,
        meta: { title: '股票详情' }
      },

      // ✅ 股票自选详情（收藏栏进入）
      {
        path: 'my-stocks/:code',
        name: 'MyStock',
        component: StockView,
        meta: { title: '我的股票详情' }
      },

      {
        path: 'concept-create',
        name: 'ConceptCreate',
        component: ConceptCreate,
        meta: { title: '新建概念' }
      }
    ]
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
