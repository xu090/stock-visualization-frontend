import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * Home / 概念总览 新手教程
 * 顺序：Sidebar -> 策略 -> 新闻 -> 主界面（含截图这一排）
 * - 自动跳到 /home
 * - 兼容：某些锚点不存在就自动过滤
 */
export function createHomeTour({ router }) {
  const steps = [
    /** ===== 1) 主页 ===== */
    {
      element: '#tour-quick',
      popover: {
        title: '① 主页',
        description: '快速回到主页。',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '#tour-fav-concept',
      popover: {
        title: '② 概念列表',
        description: '这里展示所有概念，星标代表你已收藏的概念，点击进入概念详情。',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '#tour-fav-stock',
      popover: {
        title: '③ 股票自选',
        description: '这里展示所有股票，星标代表你已收藏的股票，点击进入股票详情。',
        side: 'right',
        align: 'start'
      }
    },

    /** ===== 2) 策略中心 ===== */
    {
      element: '#tour-strategy',
      popover: {
        title: '④ 策略中心',
        description: '在这里选择合适的选股策略或交易策略。',
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '#tour-strategy-save',
      popover: {
        title: '⑤ 保存策略',
        description: '筛选和排序调好后保存，后面可以一键套用。',
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '#tour-news',
      popover: {
        title: '⑥ 点击新闻，打开详情',
        description: '点击新闻条，就能打开新闻详情。',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#tour-news-list',
      popover: {
        title: '⑦ 查看新闻列表',
        description: '点这里打开新闻列表，集中浏览并点开查看。',
        side: 'left',
        align: 'start'
      }
    },

    /** ===== 3) 主界面（含截图这一排） ===== */
    {
      element: '#tour-search',
      popover: {
        title: '⑧ 搜索',
        description: '输入关键词快速缩小范围；清空可恢复。',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#tour-metrics',
      popover: {
        title: '⑨ 排序',
        description: '选择你最关心的指标来排顺序，结果会立即变化。',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#tour-actions',
      popover: {
        title: '⑩ 常用操作',
        description: '新建新概念，保存当前策略，重置排序、筛选和搜索，查看自选或自定义概念。',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#tour-filter-pill',
      popover: {
        title: '⑪ 筛选条件选择入口',
        description:
          '这里会显示当前筛选情况（也包含新闻联动）。点“筛选”设置当前筛选条件；不需要时点“清空筛选”。',
        side: 'bottom',
        align: 'start'
      }
    },

    {
      element: '#tour-cards',
      popover: {
        title: '⑫ 概念展示',
        description: '这里是全部概念展示，点“查看详情”进入概念详情页。点击黄色星星收藏当前概念',
        side: 'top',
        align: 'start'
      }
    }
  ]

  const d = driver({
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayClickNext: false,
    popoverClass: 'tour-popover',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '完成',
    steps: []
  })

  function buildSteps() {
    const ok = []
    for (const s of steps) {
      if (!s?.element) continue
      const el = document.querySelector(s.element)
      if (!el) continue
      ok.push(s)
    }
    return ok
  }

  async function start() {
    if (router?.currentRoute?.value?.path !== '/home') {
      await router.push('/home')
      await new Promise(r => requestAnimationFrame(r))
      await new Promise(r => requestAnimationFrame(r))
    }

    const okSteps = buildSteps()
    d.setSteps(okSteps)
    d.drive()
  }

  return { start }
}

export function autoStartHomeTourOnce({ router, key = 'homeTourDone_v1' }) {
  try {
    if (localStorage.getItem(key) === '1') return
    const { start } = createHomeTour({ router })
    start()
    localStorage.setItem(key, '1')
  } catch {}
}