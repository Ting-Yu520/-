// utils/preloadManager.js
class PreloadManager {
  constructor() {
    this.cache = new Map()
    this.preloadQueue = []
    this.isPreloading = false
  }

  // 预加载任务数据
  async preloadTasks(date = null) {
    if (!date) {
      date = new Date().toISOString().split('T')[0]
    }

    const cacheKey = `tasks_${date}`
    
    // 如果已有缓存，直接返回
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('Task')
        .where({ 
          _openid: wx.getStorageSync('openid'),
          date: date
        })
        .orderBy('created_at', 'desc')
        .limit(5) // 预加载前5个任务
        .get()

      this.cache.set(cacheKey, data)
      return data
    } catch (error) {
      console.error('预加载任务失败:', error)
      return []
    }
  }

  // 预加载用户信息
  async preloadUserInfo() {
    const cacheKey = 'user_info'
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.cache.set(cacheKey, userInfo)
        return userInfo
      }
      return null
    } catch (error) {
      console.error('预加载用户信息失败:', error)
      return null
    }
  }

  // 预加载统计数据
  async preloadStats() {
    const cacheKey = 'today_stats'
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const db = wx.cloud.database()
      
      // 获取今日任务总数
      const totalResult = await db.collection('Task')
        .where({
          _openid: wx.getStorageSync('openid'),
          date: today
        })
        .count()

      // 获取今日已完成任务数
      const completedResult = await db.collection('Task')
        .where({
          _openid: wx.getStorageSync('openid'),
          date: today,
          status: 'done'
        })
        .count()

      const stats = {
        totalCount: totalResult.total,
        completedCount: completedResult.total
      }

      this.cache.set(cacheKey, stats)
      return stats
    } catch (error) {
      console.error('预加载统计数据失败:', error)
      return { totalCount: 0, completedCount: 0 }
    }
  }

  // 批量预加载
  async preloadAll() {
    if (this.isPreloading) return
    
    this.isPreloading = true
    console.log('开始预加载数据...')

    try {
      await Promise.all([
        this.preloadUserInfo(),
        this.preloadTasks(),
        this.preloadStats()
      ])
      console.log('预加载完成')
    } catch (error) {
      console.error('预加载失败:', error)
    } finally {
      this.isPreloading = false
    }
  }

  // 清除缓存
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  // 获取缓存数据
  getCache(key) {
    return this.cache.get(key)
  }
}

module.exports = PreloadManager