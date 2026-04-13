import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/LayoutIndex.vue'
import MarketView from '@/views/MarketView.vue'
import ConceptCreate from '@/views/ConceptCreate.vue'
import StockView from '@/views/StockView.vue' // 鉁?鏂板锛氳偂绁ㄨ鎯呴〉锛堜綘鍚庨潰鍋氾級

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
        meta: { title: '涓婚〉' }   
      },
      // 琛屼笟璇︽儏锛堝彲閫変繚鐣欙級
      {
        path: 'industry/:id',
        name: 'Industry',
        component: MarketView,
        meta: { title: '琛屼笟璇︽儏' }
      },

      // 姒傚康璇︽儏锛堢郴缁熸蹇碉級
      {
        path: 'concept/:id',
        name: 'Concept',
        component: MarketView,
        meta: { title: '姒傚康璇︽儏' }
      },

      // 鎴戠殑姒傚康璇︽儏锛堟敹钘?鑷缓锛?
      {
        path: 'my-concept/:id',
        name: 'MyConcept',
        component: MarketView,
        meta: { title: '鎴戠殑姒傚康璇︽儏' }
      },

      // 鉁?鑲＄エ璇︽儏锛堢郴缁?鎴愬垎鑲＄偣鍑昏繘鍏ワ級
      {
        path: 'stock/:code',
        name: 'Stock',
        component: StockView,
        meta: { title: '鑲＄エ璇︽儏' }
      },

      // 鉁?鑲＄エ鑷€夎鎯咃紙鏀惰棌鏍忚繘鍏ワ級
      {
        path: 'my-stocks/:code',
        name: 'MyStock',
        component: StockView,
        meta: { title: '鎴戠殑鑲＄エ璇︽儏' }
      },

      {
        path: 'concept-create',
        name: 'ConceptCreate',
        component: ConceptCreate,
        meta: { title: '鏂板缓姒傚康' }
      }
    ]
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})

