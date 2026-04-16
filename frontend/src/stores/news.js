import { defineStore } from 'pinia'

const RAW_NEWS_ITEMS = [
  {
    id: '10000002342608',
    type: '文章',
    uuid: '10000002342608',
    brief: '①国晟科技于4月13日宣布终止收购铜陵市孚悦科技有限公司100%股权，因并购贷款未达成。②国晟科技近半年股价累计上涨10倍有余。',
    title: '因并购贷款未达成，10倍光伏概念牛股收购事项告吹',
    source: '财联社',
    stocks: '',
    content: '<p>财联社4月13日讯，10倍光伏概念大牛股国晟科技筹划近五个月的资产收购事项宣告终止。</p><p>由于本次交易先决条件中的并购贷款未达成，公司决定终止收购。</p><p>公开资料显示，孚悦科技主要从事高精密度新型锂电池外壳材料生产，主要产品为动力电池铝壳等结构件。</p>',
    subType: 0,
    recommend: 0,
    publishTime: 'Apr 13, 2026, 8:02:07 PM',
    thirdPartyId: '2342608',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343373',
    type: '文章',
    uuid: '10000002343373',
    brief: '锂电材料股再度拉升，海科新源涨超14%创历史新高。',
    title: '锂电材料股再度拉升 海科新源涨超14%创历史新高',
    source: '财联社',
    stocks: '002759,301292,300497,600773,002083,688353',
    content: '【锂电材料股再度拉升 海科新源涨超14%创历史新高】财联社4月14日电，锂电材料股再度拉升，海科新源涨超14%，创历史新高，孚日股份涨停，华盛锂电、天际股份、西藏城投、富祥药业等冲高。消息面上，据鑫椤锂电数据，4月中国内地样本企业中电池排产达151.1GWh，环比+3.8%，带动中游材料环节走高。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:42:04 PM',
    thirdPartyId: '2343373',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343374',
    type: '文章',
    uuid: '10000002343374',
    brief: '全球首个“自动驾驶移动空间”路线贵阳“奇遇环线”4月20日将正式启动试运营。',
    title: '全球首个自动驾驶移动空间路线4月20日试运营',
    source: '财联社',
    stocks: '',
    content: '【全球首个自动驾驶移动空间路线4月20日试运营】财联社4月14日电，全球首个“自动驾驶移动空间”路线——贵阳“奇遇环线”4月20日将正式启动试运营。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:44:42 PM',
    thirdPartyId: '2343374',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343375',
    type: '文章',
    uuid: '10000002343375',
    brief: '力箭一号“一箭8星”成功入轨，卫星产业指数走强。',
    title: '力箭一号“一箭8星”成功入轨，卫星ETF易方达（563530）标的指数超3%',
    source: '财联社',
    stocks: '',
    content: '【力箭一号“一箭8星”成功入轨，卫星ETF易方达（563530）标的指数超3%】4月14日午后，商业航天板块持续走高，中证卫星产业指数上涨3.8%，臻镭科技、信科移动-U涨超10%。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:46:53 PM',
    thirdPartyId: '2343375',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343376',
    type: '文章',
    uuid: '10000002343376',
    brief: 'AI叙事外溢叠加基本面超预期，储能电池板块获资金关注。',
    title: 'AI叙事外溢叠加基本面超预期，储能电池ETF易方达（159566）盘中获2300万份净申购',
    source: '财联社',
    stocks: '',
    content: '【AI叙事外溢叠加基本面超预期，储能电池ETF易方达（159566）盘中获2300万份净申购】储能板块迎来AI叙事外溢与基本面超预期的双重催化。AI Agent爆发带动AI硬件需求提速，AIDC配套储能空间进一步打开。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:46:45 PM',
    thirdPartyId: '2343376',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343379',
    type: '文章',
    uuid: '10000002343379',
    brief: '富时中国A50指数期货涨幅扩大至1%。',
    title: '财联社4月14日电，富时中国A50指数期货涨幅扩大至1%。',
    source: '财联社',
    stocks: '',
    content: '财联社4月14日电，富时中国A50指数期货涨幅扩大至1%。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:46:49 PM',
    thirdPartyId: '2343379',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343382',
    type: '文章',
    uuid: '10000002343382',
    brief: '印尼能矿部修订矿产基准价测算规则，镍矿HPM计算公式自4月15日起调整。',
    title: '印尼能矿部：镍矿HPM计算公式自4月15日起调整',
    source: '财联社',
    stocks: '',
    content: '【印尼能矿部：镍矿HPM计算公式自4月15日起调整】财联社4月14日电，印尼能源与矿产资源部修订矿产基准价（HPM）测算规则，新规将于2026年4月15日起生效。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:49:30 PM',
    thirdPartyId: '2343382',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343383',
    type: '文章',
    uuid: '10000002343383',
    brief: '证监会开展2026年信息技术系统服务机构年度备案。',
    title: '证监会开展2026年信息技术系统服务机构年度备案',
    source: '财联社',
    stocks: '',
    content: '【证监会开展2026年信息技术系统服务机构年度备案】财联社4月14日电，中国证监会发布《关于开展2026年信息技术系统服务机构年度备案的通知》。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:50:56 PM',
    thirdPartyId: '2343383',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343392',
    type: '文章',
    uuid: '10000002343392',
    brief: '沪指涨近1%重返4000点，锂电、算力硬件方向反复走强。',
    title: '收评：沪指涨近1%重返4000点 锂电、算力硬件方向反复走强',
    source: '财联社',
    stocks: '000001',
    content: '【收评：沪指涨近1%重返4000点 锂电、算力硬件方向反复走强】市场震荡反弹，创业板指涨超2%，沪指涨近1%重返4000点。盘面上，PCB、存储芯片、液冷服务器、算力租赁、锂电池概念反复活跃。',
    subType: -1,
    recommend: 1,
    publishTime: 'Apr 14, 2026, 3:02:58 PM',
    thirdPartyId: '2343392',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '30000003621756',
    type: '新闻',
    uuid: '30000003621756',
    title: '光环新网：截至目前算力业务规模已超过4,000P',
    source: '财联社',
    stocks: '300383',
    content: '<p>光环新网在互动平台表示，公司在北京科信盛彩云计算中心和天津赞普云计算中心部署了高性能的算力硬件，为用户提供高性能智算算力服务、智算网络服务等，截至目前算力业务规模已超过4,000P，年合同额超过1亿元。</p>',
    subType: 0,
    category: 'stock',
    industry: '通信设备',
    recommend: 0,
    stockName: '光环新网',
    categoryId: '1',
    publishTime: 'Apr 14, 2026, 3:00:05 PM',
    thirdPartyId: '3621756',
    thirdPartyTable: 'xk_news_data',
    thirdPartySource: 'CLS',
  },
  {
    id: '30000003621762',
    type: '新闻',
    uuid: '30000003621762',
    title: '光环新网：数据中心采用模块式兼容架构实现风液兼容',
    source: '财联社',
    stocks: '300383',
    content: '<p>光环新网在互动平台表示，公司设计采用模块式兼容式设计架构，具有高扩展性和兼容性，可根据客户需求灵活规划部署，实现风液兼容。</p>',
    subType: 0,
    category: 'stock',
    industry: '通信设备',
    recommend: 0,
    stockName: '光环新网',
    categoryId: '1',
    publishTime: 'Apr 14, 2026, 3:00:05 PM',
    thirdPartyId: '3621762',
    thirdPartyTable: 'xk_news_data',
    thirdPartySource: 'CLS',
  },
  {
    id: '30000003621755',
    type: '新闻',
    uuid: '30000003621755',
    title: '闽发铝业：液冷服务器铝型材开始小批量供货 储能类已稳定供货',
    source: '财联社',
    stocks: '002578',
    content: '<p>闽发铝业在互动平台表示，液冷服务器铝型材开始小批量供货；储能类铝型材是公司工业型材主要产品，已实现稳定供货。</p>',
    subType: 0,
    category: 'stock',
    industry: '工业金属',
    recommend: 0,
    stockName: '闽发铝业',
    categoryId: '1',
    publishTime: 'Apr 14, 2026, 3:00:05 PM',
    thirdPartyId: '3621755',
    thirdPartyTable: 'xk_news_data',
    thirdPartySource: 'CLS',
  },
  {
    id: '30000003621753',
    type: '新闻',
    uuid: '30000003621753',
    title: '千红制药：QHRD106项目处于科学有序临床推进中',
    source: '财联社',
    stocks: '002550',
    content: '<p>千红制药在互动平台表示，公司原创一类新药QHRD106项目处于科学、有序地推进临床试验进程中。</p>',
    subType: 0,
    category: 'stock',
    industry: '化学制药',
    recommend: 0,
    stockName: '千红制药',
    categoryId: '1',
    publishTime: 'Apr 14, 2026, 3:00:05 PM',
    thirdPartyId: '3621753',
    thirdPartyTable: 'xk_news_data',
    thirdPartySource: 'CLS',
  },
  {
    id: '30000003621772',
    type: '新闻',
    uuid: '30000003621772',
    title: '常山药业：艾本那肽目前处于上市审评中',
    source: '财联社',
    stocks: '300255',
    content: '<p>常山药业在互动平台表示，艾本那肽目前处于上市审评中，具体审评进展请参阅药审中心网站公示信息。</p>',
    subType: 0,
    category: 'stock',
    industry: '生物制品',
    recommend: 0,
    stockName: '常山药业',
    categoryId: '1',
    publishTime: 'Apr 14, 2026, 3:00:05 PM',
    thirdPartyId: '3621772',
    thirdPartyTable: 'xk_news_data',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343413',
    type: '文章',
    uuid: '10000002343413',
    brief: '闽发铝业表示液冷服务器铝型材开始小批量供货。',
    title: '闽发铝业：液冷服务器铝型材开始小批量供货',
    source: '财联社',
    stocks: '002578',
    content: '【闽发铝业：液冷服务器铝型材开始小批量供货】财联社4月14日电，闽发铝业在互动平台表示，目前公司暂未有航空航天铝型材生产；液冷服务器铝型材开始小批量供货；储能类铝型材是公司工业型材主要产品，已实现稳定供货。',
    subType: -1,
    category: 'stock',
    industry: '工业金属',
    recommend: 0,
    stockName: '闽发铝业',
    categoryId: '1',
    publishTime: 'Apr 14, 2026, 3:10:55 PM',
    thirdPartyId: '2343413',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343421',
    type: '文章',
    uuid: '10000002343421',
    brief: 'SK海力士计划将HBM4出货量减少约20%至30%。',
    title: 'SK海力士计划将HBM4出货量减少约20%至30%',
    source: '财联社',
    stocks: '',
    content: '【SK海力士计划将HBM4出货量减少约20%至30%】《科创板日报》14日讯，SK海力士计划降低今年向英伟达供应的第六代高带宽内存（HBM4）的出货量，预计比原计划减少约20%至30%。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 3:14:55 PM',
    thirdPartyId: '2343421',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343422',
    type: '文章',
    uuid: '10000002343422',
    brief: '苹果新款平价电脑MacBook Neo首批产品已售罄，正向供应商紧急追加大量订单。',
    title: '苹果新款平价电脑MacBook Neo首批产品已售罄 正向供应商紧急追加大量订单',
    source: '财联社',
    stocks: '',
    content: '【苹果新款平价电脑MacBook Neo首批产品已售罄 正向供应商紧急追加大量订单】财联社4月14日电，苹果推出的新款平价电脑MacBook Neo首批产品据称已经售罄，导致苹果正在向供应商鸿海和广达紧急追加大量订单。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 3:14:44 PM',
    thirdPartyId: '2343422',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
  {
    id: '10000002343361',
    type: '文章',
    uuid: '10000002343361',
    brief: '火山引擎宣布正式上线Seedance 2.0系列API服务，支持多模态输入。',
    title: 'Seedance 2.0全面开放API服务',
    source: '财联社',
    stocks: '',
    content: '【Seedance 2.0全面开放API服务】财联社4月14日电，火山引擎宣布正式上线Seedance 2.0系列API服务，企业和个人用户现在可以调用其视频生成能力，支持文字、图片、音频、视频四种模态输入。',
    subType: -1,
    recommend: 0,
    publishTime: 'Apr 14, 2026, 2:29:37 PM',
    thirdPartyId: '2343361',
    thirdPartyTable: 'lian_v1_article',
    thirdPartySource: 'CLS',
  },
]

const CONCEPT_RULES = [
  { id: 'semiconductor', keywords: ['半导体', '芯片', '存储', 'hbm', 'pcb', 'oled', 'asml'] },
  { id: 'ai', keywords: ['ai', '算力', 'aigc', 'agent', '大模型', '智算', 'seedance'] },
  { id: 'cloud-computing', keywords: ['云计算', '数据中心', '云服务', 'aidc', '机柜'] },
  { id: 'new-energy', keywords: ['锂电', '电池', '储能', '电解液', '光伏', '镍矿', '新能源'] },
  { id: 'clean-energy', keywords: ['储能', '光伏', '风电', '液冷超充', '清洁能源'] },
  { id: 'healthcare', keywords: ['医药', '制药', '临床', '上市审评', '创新药'] },
  { id: 'automobile', keywords: ['自动驾驶', '汽车', '充电桩'] },
  { id: '5g', keywords: ['5g', '通信设备', '卫星'] },
]

const HEADLINE_KEYWORDS = [
  '收评', '指数', '期货', '财政部', '证监会', '外交部', '国债', '黄金', '白银',
  '股指', '开盘', '收盘', '库存系数', '试运营', '路线'
]

function parseStocks(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

function parsePublishTimestamp(value) {
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

function inferConceptIds(item) {
  const haystack = [
    item.title,
    item.brief,
    stripHtml(item.content),
    item.stockName,
    item.industry,
  ].join(' ').toLowerCase()

  return CONCEPT_RULES
    .filter(rule => rule.keywords.some(keyword => haystack.includes(String(keyword).toLowerCase())))
    .map(rule => rule.id)
}

function normalizeNewsItem(raw) {
  const stocks = parseStocks(raw.stocks)
  const contentText = stripHtml(raw.content)
  const brief = String(raw.brief || '').trim() || contentText.slice(0, 88)
  const conceptIds = inferConceptIds(raw)
  const publishTs = parsePublishTimestamp(raw.publishTime)

  return {
    ...raw,
    id: String(raw.id || raw.uuid || raw.thirdPartyId),
    category: raw.category || raw.type || '新闻',
    displayCategory: raw.type || raw.category || '新闻',
    source: raw.source || raw.thirdPartySource || '未知来源',
    sourceDetail: raw.thirdPartySource || raw.source || '',
    brief,
    time: raw.publishTime || '',
    publishTs,
    conceptIds,
    relatedStocks: stocks,
    stockCodes: stocks,
    contentHtml: sanitizeHtml(raw.content || ''),
    contentText,
    content: contentText
      .split(/(?<=[。！？])/)
      .map(item => item.trim())
      .filter(Boolean),
    keyPoints: [],
    whatToWatch: [],
  }
}

function compareNewsDesc(a, b) {
  if ((b.publishTs || 0) !== (a.publishTs || 0)) return (b.publishTs || 0) - (a.publishTs || 0)
  return String(b.id || '').localeCompare(String(a.id || ''))
}

function dedupeNews(items) {
  const byTitle = new Map()
  for (const item of items) {
    const key = `${item.title || ''}::${item.time || ''}`
    const current = byTitle.get(key)
    if (!current) {
      byTitle.set(key, item)
      continue
    }
    const currentScore = (current.relatedStocks?.length || 0) + (current.contentText?.length || 0)
    const nextScore = (item.relatedStocks?.length || 0) + (item.contentText?.length || 0)
    if (nextScore > currentScore) byTitle.set(key, item)
  }
  return Array.from(byTitle.values()).sort(compareNewsDesc)
}

function isHeadlineLike(item) {
  const text = `${item.title} ${item.brief}`.toLowerCase()
  return HEADLINE_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase())) || item.recommend === 1
}

function buildHeadlineNews(items) {
  const preferred = items.filter(isHeadlineLike)
  return (preferred.length ? preferred : items).slice(0, 12)
}

function pickDynamicForConcept(conceptId, items, limit = 10) {
  const matched = (items || []).filter(item => (item.conceptIds || []).includes(conceptId))
  const fallback = matched.length ? matched : (items || []).filter(item => (item.relatedStocks || []).length > 0)
  return fallback.slice(0, limit)
}

function buildNormalizedFeed() {
  return dedupeNews(RAW_NEWS_ITEMS.map(normalizeNewsItem))
}

export const useNewsStore = defineStore('news', {
  state: () => {
    const allNews = buildNormalizedFeed()
    return {
      leftLabel: '要闻',
      context: { type: 'concept', conceptId: 'ai' },
      allNews,
      policyNews: buildHeadlineNews(allNews),
      dynamicNews: pickDynamicForConcept('ai', allNews, 10),
    }
  },

  getters: {
    currentConceptId(state) {
      return state.context?.conceptId || 'ai'
    },
    dynamicTitle() {
      return '概念新闻'
    },
  },

  actions: {
    refreshDynamicNews() {
      this.dynamicNews = pickDynamicForConcept(this.context?.conceptId, this.allNews, 10)
    },

    setConceptId(conceptId) {
      this.context = { type: 'concept', conceptId: String(conceptId || 'ai') }
      this.refreshDynamicNews()
    },

    setConceptByName(conceptName, conceptList) {
      const hit = (conceptList || []).find(item => item.name === conceptName)
      if (!hit?.id) return
      this.setConceptId(hit.id)
    },
  },
})
