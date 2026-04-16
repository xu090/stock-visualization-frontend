import { defineStore } from 'pinia'
import { apiGet } from '@/utils/api'

function normalizeNewsItem(item = {}) {
  const conceptIds = Array.isArray(item.conceptIds) ? item.conceptIds.map(String) : []
  const relatedStocks = Array.isArray(item.relatedStocks) ? item.relatedStocks : []
  const content = Array.isArray(item.content)
    ? item.content
    : String(item.content || item.brief || '').split(/\n+/).filter(Boolean)
  return {
    ...item,
    id: String(item.id || item.uuid || ''),
    category: item.category || item.type || '新闻',
    displayCategory: item.displayCategory || item.category || item.type || '新闻',
    source: item.source || '',
    brief: item.brief || '',
    time: item.time || '',
    publishTs: item.publishTime || Date.parse(item.time || '') || 0,
    conceptIds,
    relatedStocks,
    stockCodes: item.stockCodes || relatedStocks,
    content,
    keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
    whatToWatch: Array.isArray(item.whatToWatch) ? item.whatToWatch : [],
    contentText: content.join(' '),
    contentHtml: item.contentHtml || ''
  }
}

function mergeNews(...groups) {
  const map = new Map()
  groups.flat().forEach(item => {
    if (!item?.id) return
    map.set(item.id, item)
  })
  return Array.from(map.values()).sort((a, b) => Number(b.publishTs || 0) - Number(a.publishTs || 0))
}

export const useNewsStore = defineStore('news', {
  state: () => ({
    leftLabel: '要闻',
    context: { type: 'concept', conceptId: 'semiconductor' },
    allNews: [],
    policyNews: [],
    dynamicNews: [],
    loading: false,
    loaded: false,
    error: ''
  }),

  getters: {
    currentConceptId(state) {
      return state.context?.conceptId || 'semiconductor'
    },
    dynamicTitle() {
      return '概念新闻'
    }
  },

  actions: {
    async fetchFeed(conceptId = this.currentConceptId) {
      this.loading = true
      this.error = ''
      try {
        const data = await apiGet(`/api/news/feed?concept_id=${encodeURIComponent(conceptId)}&limit=10&policy_limit=8`)
        this.context = data.context || { type: 'concept', conceptId }
        this.policyNews = (data.policyNews || []).map(normalizeNewsItem)
        this.dynamicNews = (data.dynamicNews || []).map(normalizeNewsItem)
        this.allNews = mergeNews(this.allNews, this.policyNews, this.dynamicNews)
        this.loaded = true
      } catch (err) {
        this.error = err?.message || String(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    async refreshDynamicNews() {
      await this.fetchFeed(this.context?.conceptId || 'semiconductor')
    },

    async setConceptId(conceptId) {
      const id = String(conceptId || 'semiconductor')
      this.context = { type: 'concept', conceptId: id }
      await this.fetchFeed(id)
    },

    async setConceptByName(conceptName, conceptList) {
      const hit = (conceptList || []).find(item => item.name === conceptName)
      if (!hit?.id) return
      await this.setConceptId(hit.id)
    }
  }
})
