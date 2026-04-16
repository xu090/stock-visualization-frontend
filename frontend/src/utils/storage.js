/**
 * 本地存储工具 - 用于缓存股票和概念等相对稳定的数据
 */

const CACHE_KEYS = {
  STOCK_BASE_LIST: 'stock_base_list',
  CONCEPT_LIST: 'concept_list',
  STOCK_BASE_TIMESTAMP: 'stock_base_timestamp',
  CONCEPT_TIMESTAMP: 'concept_timestamp'
}

const CACHE_EXPIRY_DAYS = 7 // 缓存过期时间：7天

/**
 * 检查缓存是否过期
 */
function isCacheExpired(timestamp, expiryDays = CACHE_EXPIRY_DAYS) {
  if (!timestamp) return true
  const now = Date.now()
  const expiryTime = timestamp + (expiryDays * 24 * 60 * 60 * 1000)
  return now > expiryTime
}

/**
 * 设置缓存
 */
function setCache(key, data, timestampKey) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    localStorage.setItem(timestampKey, String(Date.now()))
    return true
  } catch (error) {
    console.warn(`Failed to set cache for ${key}:`, error)
    return false
  }
}

/**
 * 获取缓存
 */
function getCache(key, timestampKey, expiryDays = CACHE_EXPIRY_DAYS) {
  try {
    const cached = localStorage.getItem(key)
    const timestamp = localStorage.getItem(timestampKey)

    if (!cached) return null
    if (isCacheExpired(Number(timestamp), expiryDays)) {
      removeCache(key, timestampKey)
      return null
    }

    return JSON.parse(cached)
  } catch (error) {
    console.warn(`Failed to get cache for ${key}:`, error)
    return null
  }
}

/**
 * 删除缓存
 */
function removeCache(key, timestampKey) {
  try {
    localStorage.removeItem(key)
    localStorage.removeItem(timestampKey)
  } catch (error) {
    console.warn(`Failed to remove cache for ${key}:`, error)
  }
}

/**
 * 股票基础数据缓存
 */
export const stockCache = {
  /**
   * 设置股票基础数据缓存
   */
  setStocks(stockList) {
    return setCache(CACHE_KEYS.STOCK_BASE_LIST, stockList, CACHE_KEYS.STOCK_BASE_TIMESTAMP)
  },

  /**
   * 获取股票基础数据缓存
   */
  getStocks() {
    return getCache(CACHE_KEYS.STOCK_BASE_LIST, CACHE_KEYS.STOCK_BASE_TIMESTAMP)
  },

  /**
   * 清除股票基础数据缓存
   */
  clearStocks() {
    removeCache(CACHE_KEYS.STOCK_BASE_LIST, CACHE_KEYS.STOCK_BASE_TIMESTAMP)
  },

  /**
   * 检查是否需要刷新股票数据
   */
  needsRefresh() {
    const timestamp = localStorage.getItem(CACHE_KEYS.STOCK_BASE_TIMESTAMP)
    return isCacheExpired(Number(timestamp))
  }
}

/**
 * 概念数据缓存
 */
export const conceptCache = {
  /**
   * 设置概念数据缓存
   */
  setConcepts(conceptList) {
    return setCache(CACHE_KEYS.CONCEPT_LIST, conceptList, CACHE_KEYS.CONCEPT_TIMESTAMP)
  },

  /**
   * 获取概念数据缓存
   */
  getConcepts() {
    return getCache(CACHE_KEYS.CONCEPT_LIST, CACHE_KEYS.CONCEPT_TIMESTAMP)
  },

  /**
   * 清除概念数据缓存
   */
  clearConcepts() {
    removeCache(CACHE_KEYS.CONCEPT_LIST, CACHE_KEYS.CONCEPT_TIMESTAMP)
  },

  /**
   * 检查是否需要刷新概念数据
   */
  needsRefresh() {
    const timestamp = localStorage.getItem(CACHE_KEYS.CONCEPT_TIMESTAMP)
    return isCacheExpired(Number(timestamp))
  }
}

/**
 * 通用缓存管理
 */
export const cacheManager = {
  /**
   * 清除所有缓存
   */
  clearAll() {
    stockCache.clearStocks()
    conceptCache.clearConcepts()
  },

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const stockTimestamp = localStorage.getItem(CACHE_KEYS.STOCK_BASE_TIMESTAMP)
    const conceptTimestamp = localStorage.getItem(CACHE_KEYS.CONCEPT_TIMESTAMP)

    return {
      stock: {
        exists: !!localStorage.getItem(CACHE_KEYS.STOCK_BASE_LIST),
        expired: stockCache.needsRefresh(),
        cachedAt: stockTimestamp ? new Date(Number(stockTimestamp)).toISOString() : null
      },
      concept: {
        exists: !!localStorage.getItem(CACHE_KEYS.CONCEPT_LIST),
        expired: conceptCache.needsRefresh(),
        cachedAt: conceptTimestamp ? new Date(Number(conceptTimestamp)).toISOString() : null
      }
    }
  }
}

export default {
  stockCache,
  conceptCache,
  cacheManager
}