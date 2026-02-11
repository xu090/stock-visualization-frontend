// src/stores/news.js
import { defineStore } from 'pinia'

/**
 * ✅ 用 conceptStore 里的 id 作为唯一关联键：
 * semiconductor / ai / new-energy / blockchain / 5g / clean-energy ...
 *
 * news item 关键字段：
 * - conceptIds: [概念id]     —— 用于联动概念详情页（稳定）
 * - sentiment: 'positive' | 'negative' | 'neutral'
 * - heat: 0~100             —— 热度（用于排序/打标签）
 * - keyPoints / whatToWatch —— 股民关心点
 * - relatedStocks           —— 关联股票（可选）
 */

const now = '2026-01-30' // mock 用（你后续可改成真实时间）

function T(date, hhmm) {
  // 生成 YYYY-MM-DD HH:mm:ss
  return `${date} ${hhmm}:00`
}

/** ✅ 政策新闻：允许关联多个概念（比如“先进制造”同时利好半导体/AI/新能源） */
function buildPolicyNews() {
  return [
    {
      id: 'p-001',
      category: '政策',
      title: '国家发布先进制造支持政策：强化关键技术攻关与资本市场支持',
      source: '新华社',
      time: T(now, '09:20'),
      brief: '政策强调科技创新与先进制造，市场关注“产业链受益顺序”。',
      sentiment: 'positive',
      heat: 82,
      conceptIds: ['semiconductor', 'ai', 'new-energy'],
      keyPoints: [
        '强调关键核心技术攻关、国产替代与产业链安全',
        '完善资本市场支持体系，提升科技企业融资效率'
      ],
      whatToWatch: [
        '是否落地细则（补贴/税收/采购）',
        '板块轮动：先设备材料后设计制造？'
      ],
      relatedStocks: ['000063', '300750', '600703'],
      content: [
        '文件提出将加大对关键核心技术攻关的支持力度。',
        '完善多层次资本市场服务体系，提升对实体经济支持效率。',
        '市场认为先进制造、半导体与人工智能方向关注度将提升。'
      ]
    },

    {
      id: 'p-002',
      category: '政策',
      title: '绿色低碳转型推进：储能、清洁能源与电网侧技术关注度提升',
      source: '人民日报',
      time: T('2026-01-29', '18:10'),
      brief: '政策强调清洁能源比重提升，储能与电网侧技术或成重点。',
      sentiment: 'positive',
      heat: 72,
      conceptIds: ['clean-energy', 'new-energy'],
      keyPoints: [
        '提升清洁能源消纳能力',
        '鼓励储能、智能电网、节能技术创新应用'
      ],
      whatToWatch: [
        '项目落地节奏与订单可见度',
        '补贴/电价机制变化'
      ],
      relatedStocks: ['300750', '600028'],
      content: [
        '会议提出推进能源结构优化与绿色低碳转型。',
        '鼓励储能、智能电网、节能技术等方向创新应用。'
      ]
    }
  ]
}

/** ✅ 概念动态新闻：每条必须有 conceptIds（强关联） */
function buildConceptNewsPool() {
  return [
    // 半导体
    {
      id: 'c-001',
      category: '概念',
      title: '半导体板块走强：国产替代预期升温，资金持续净流入',
      source: '财联社',
      time: T(now, '10:05'),
      brief: '机构提示景气度修复，关注设备与材料环节边际改善。',
      sentiment: 'positive',
      heat: 88,
      conceptIds: ['semiconductor'],
      keyPoints: [
        '资金面：近3日净流入增强',
        '产业面：设备/材料边际改善预期'
      ],
      whatToWatch: [
        '成交额与量能持续性',
        '龙头带动 vs 普涨'
      ],
      relatedStocks: ['000063', '600703', '300059'],
      content: [
        '今日半导体板块震荡走强，盘中多只标的放量上行。',
        '机构认为国产替代逻辑延续，设备与材料环节或迎来边际改善。',
        '资金面上，板块近三日呈现净流入态势。'
      ]
    },

    // 人工智能
    {
      id: 'c-002',
      category: '概念',
      title: 'AI 应用端活跃：算力需求再被上修，关注“业绩兑现”标的',
      source: '券商研报',
      time: T(now, '11:10'),
      brief: '应用端活跃带来算力需求预期提升，市场仍看重业绩兑现。',
      sentiment: 'positive',
      heat: 79,
      conceptIds: ['ai', 'cloud-computing'],
      keyPoints: [
        '算力/云资源需求预期提高',
        '市场偏好：能兑现收入/利润的公司'
      ],
      whatToWatch: [
        '短线冲高回落风险',
        '业绩/订单验证'
      ],
      relatedStocks: ['300059', '300459'],
      content: [
        '近期AI应用端活跃度提升，带动算力需求预期上修。',
        '机构建议重点关注具备订单与业绩兑现能力的公司。'
      ]
    },

    // 新能源
    {
      id: 'c-003',
      category: '概念',
      title: '新能源链条分化：电池材料价格波动，关注“结构性机会”',
      source: '东方财富',
      time: T(now, '13:05'),
      brief: '材料价格波动导致板块分化，资金偏向确定性更强的环节。',
      sentiment: 'neutral',
      heat: 66,
      conceptIds: ['new-energy'],
      keyPoints: [
        '材料价格波动引发盈利预期分歧',
        '资金偏向订单更明确/成本可控环节'
      ],
      whatToWatch: [
        '价格变化对毛利的影响',
        '政策与需求边际'
      ],
      relatedStocks: ['300750', '000651'],
      content: [
        '新能源链条表现分化，部分材料品类价格波动。',
        '市场关注成本传导与订单持续性。'
      ]
    },

    // 区块链
    {
      id: 'c-004',
      category: '概念',
      title: '区块链概念异动：支付与金融IT方向活跃，短线情绪升温',
      source: '东方财富',
      time: T(now, '14:20'),
      brief: '情绪升温带动活跃度，注意回撤与量能。',
      sentiment: 'neutral',
      heat: 60,
      conceptIds: ['blockchain', 'fintech'],
      keyPoints: [
        '支付/金融IT方向活跃',
        '短线情绪驱动明显'
      ],
      whatToWatch: [
        '持续放量还是冲高回落',
        '题材扩散强度'
      ],
      relatedStocks: ['000001', '000002'],
      content: [
        '盘中区块链概念出现异动，多只成分股拉升。',
        '建议关注量能与回撤控制。'
      ]
    },

    // 5G
    {
      id: 'c-005',
      category: '概念',
      title: '5G 方向拉升：通信设备订单预期改善，关注景气验证',
      source: '券商研报',
      time: T(now, '15:00'),
      brief: '订单预期改善带动板块，但仍需景气验证。',
      sentiment: 'positive',
      heat: 64,
      conceptIds: ['5g'],
      keyPoints: [
        '订单预期改善',
        '设备链条关注度提升'
      ],
      whatToWatch: [
        '是否有持续订单数据',
        '板块轮动节奏'
      ],
      relatedStocks: ['600050', '600131'],
      content: [
        '5G相关方向盘中走强，通信设备关注度提升。',
        '机构认为需进一步观察订单与景气验证。'
      ]
    },

    // 清洁能源
    {
      id: 'c-006',
      category: '概念',
      title: '清洁能源走强：电网侧与储能带动，关注持续性与政策细则',
      source: '财联社',
      time: T(now, '15:25'),
      brief: '电网侧与储能带动走强，后续关注政策细则落地。',
      sentiment: 'positive',
      heat: 70,
      conceptIds: ['clean-energy', 'new-energy'],
      keyPoints: [
        '电网侧+储能带动',
        '政策预期增强'
      ],
      whatToWatch: [
        '细则落地',
        '订单兑现节奏'
      ],
      relatedStocks: ['300674', '600423'],
      content: [
        '盘中清洁能源相关方向走强，储能与电网侧带动明显。',
        '后续关注政策细则与订单兑现情况。'
      ]
    },

    // 大消费
    {
      id: 'c-007',
      category: '概念',
      title: '大消费稳中有动：资金偏好防御属性，关注估值与业绩',
      source: '券商研报',
      time: T('2026-01-29', '10:30'),
      brief: '资金偏好防御属性，消费板块关注业绩与估值匹配。',
      sentiment: 'neutral',
      heat: 55,
      conceptIds: ['big-consumption', 'retail'],
      keyPoints: [
        '防御属性吸引资金',
        '估值与业绩匹配度是关键'
      ],
      whatToWatch: [
        '消费数据边际变化',
        '龙头业绩预期'
      ],
      relatedStocks: ['600519', '000858', '600690'],
      content: [
        '大消费板块表现稳健，资金关注防御属性。',
        '机构建议关注估值与业绩匹配度。'
      ]
    },

    // 医药健康
    {
      id: 'c-008',
      category: '概念',
      title: '医药健康回暖：部分细分方向修复，关注政策与集采节奏',
      source: '东方财富',
      time: T('2026-01-29', '14:10'),
      brief: '细分方向修复，政策与集采节奏仍是关注点。',
      sentiment: 'neutral',
      heat: 58,
      conceptIds: ['healthcare'],
      keyPoints: [
        '细分方向修复',
        '政策与集采节奏影响预期'
      ],
      whatToWatch: [
        '政策消息扰动',
        '业绩与估值修复空间'
      ],
      relatedStocks: ['600276', '000999'],
      content: [
        '医药健康部分细分方向出现回暖迹象。',
        '市场关注政策与集采节奏变化。'
      ]
    },

    // 汽车
    {
      id: 'c-009',
      category: '概念',
      title: '汽车链条震荡：关注销量与价格战边际变化',
      source: '券商研报',
      time: T('2026-01-28', '11:00'),
      brief: '价格战仍在，关注销量数据与利润修复信号。',
      sentiment: 'neutral',
      heat: 52,
      conceptIds: ['automobile'],
      keyPoints: [
        '销量数据与利润修复信号',
        '价格战边际变化'
      ],
      whatToWatch: [
        '月度销量数据',
        '价格政策变化'
      ],
      relatedStocks: ['600104', '600371'],
      content: [
        '汽车链条震荡，市场关注销量与价格战边际变化。',
        '机构提示留意利润修复信号。'
      ]
    },

    // 房地产（利空/中性都可以 mock）
    {
      id: 'c-010',
      category: '概念',
      title: '房地产情绪偏谨慎：资金观望，关注政策边际与成交回暖',
      source: '东方财富',
      time: T('2026-01-28', '15:40'),
      brief: '短期情绪偏谨慎，关注政策边际变化与成交数据。',
      sentiment: 'neutral',
      heat: 48,
      conceptIds: ['real-estate'],
      keyPoints: [
        '资金观望情绪',
        '成交数据与政策边际'
      ],
      whatToWatch: [
        '成交回暖信号',
        '政策进一步宽松可能性'
      ],
      relatedStocks: ['000002'],
      content: [
        '房地产板块情绪偏谨慎，资金观望为主。',
        '市场关注政策边际变化与成交数据。'
      ]
    }
  ]
}

/** ✅ 按 conceptId 提取 + 按热度/时间排序（更像“最近发生的大事”） */
function pickDynamicForConcept(conceptId, pool, limit = 8) {
  const list = (pool || []).filter(n => (n.conceptIds || []).includes(conceptId))
  // 先按时间倒序，再按热度（也可以热度优先）
  list.sort((a, b) => (String(b.time).localeCompare(String(a.time))) || ((b.heat || 0) - (a.heat || 0)))
  return list.slice(0, limit)
}

export const useNewsStore = defineStore('news', {
  state: () => ({
    /** ✅ 只做概念：右侧动态新闻由 conceptId 决定 */
    context: { type: 'concept', conceptId: 'semiconductor' },

    /** 政策新闻 */
    policyNews: buildPolicyNews(),

    /** 概念新闻总池（所有概念的动态新闻都在这） */
    conceptNewsPool: buildConceptNewsPool(),

    /** 当前动态列表（根据 context 筛出来的） */
    dynamicNews: []
  }),

  getters: {
    currentConceptId(state) {
      return state.context?.conceptId || 'semiconductor'
    },
    dynamicTitle(state) {
      // 你 NewsPanel 里用 conceptStore id->name 转就行
      return `概念新闻`
    }
  },

  actions: {
    refreshDynamicNews() {
      this.dynamicNews = pickDynamicForConcept(this.context?.conceptId, this.conceptNewsPool, 10)
    },

    /** ✅ 给 NewsPanel 用：切换概念（强关联） */
    setConceptId(conceptId) {
      this.context = { type: 'concept', conceptId }
      this.refreshDynamicNews()
    },

    /** ✅ 可选：如果你只有概念名，也能切（通过传入映射） */
    setConceptByName(conceptName, conceptList) {
      const hit = (conceptList || []).find(x => x.name === conceptName)
      if (!hit?.id) return
      this.setConceptId(hit.id)
    }
  }
})
