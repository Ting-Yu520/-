// pages/index/index.js
const Pagination = require('../../utils/pagination');

// 内联 PreloadManager 类
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
        .limit(5)
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

// 内联 NetworkManager 类
class NetworkManager {
  constructor() {
    this.isOnline = true
    this.listeners = []
    this.init()
  }

  init() {
    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      const wasOnline = this.isOnline
      this.isOnline = res.isConnected
      
      console.log('网络状态变化:', {
        wasOnline,
        isOnline: this.isOnline,
        networkType: res.networkType
      })

      // 通知所有监听器
      this.listeners.forEach(listener => {
        listener(this.isOnline, wasOnline)
      })
    })

    // 获取初始网络状态
    wx.getNetworkType({
      success: (res) => {
        this.isOnline = res.networkType !== 'none'
        console.log('初始网络状态:', this.isOnline)
      }
    })
  }

  // 添加网络状态监听器
  addListener(listener) {
    this.listeners.push(listener)
  }

  // 移除监听器
  removeListener(listener) {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  // 检查网络状态
  checkNetwork() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          this.isOnline = res.networkType !== 'none'
          resolve(this.isOnline)
        },
        fail: () => {
          this.isOnline = false
          resolve(false)
        }
      })
    })
  }

  // 带重试的网络请求
  async requestWithRetry(requestFn, maxRetries = 3) {
    let lastError
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        // 检查网络状态
        const isOnline = await this.checkNetwork()
        if (!isOnline) {
          throw new Error('网络不可用')
        }

        const result = await requestFn()
        return result
      } catch (error) {
        lastError = error
        retryCount++
        
        if (retryCount < maxRetries) {
          console.log(`请求失败，第${retryCount}次重试...`)
          await this.delay(1000 * retryCount)
        }
      }
    }

    throw lastError
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 显示网络状态提示
  showNetworkToast() {
    if (!this.isOnline) {
      wx.showToast({
        title: '网络不可用，请检查网络连接',
        icon: 'none',
        duration: 3000
      })
    }
  }
}

// 初始化管理器
const preloadManager = new PreloadManager()
const networkManager = new NetworkManager()

Page({
  data: {
    userInfo: {},
    todayTasks: [],
    completedCount: 0,
    totalCount: 0,
    isLoggedIn: false,
    // 分页相关
    hasMoreTasks: true,
    isLoadingTasks: false,
    taskPagination: null,
    // 新增状态
    isRefreshing: false,
    isLoadingMore: false,
    // 网络状态
    isOnline: true,
    // 缓存状态
    isUsingCachedData: false,
    // 错误状态
    hasError: false,
    errorMessage: '',
    // 今日日期
    todayDate: ''
  },

  onLoad() {
    console.log('页面加载 - 初始化')
    this.setTodayDate()
    this.initManagers()
    this.initPagination()
    this.checkLoginStatus()
  },

  onShow() {
    console.log('页面显示 - 检查状态')
    this.checkLoginStatus()
    
    // 页面显示时预加载数据
    if (this.data.isLoggedIn) {
      this.preloadData()
    }
  },

  onHide() {
    // 页面隐藏时清理资源
    this.cleanup()
  },

  onReachBottom() {
    console.log('滚动到底部 - 加载更多')
    this.loadMoreTasks()
  },

  onPullDownRefresh() {
    console.log('下拉刷新')
    this.refreshTasks().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 设置今日日期
  setTodayDate() {
    const now = new Date()
    const month = now.getMonth() + 1
    const date = now.getDate()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const weekDay = weekDays[now.getDay()]
    
    this.setData({
      todayDate: `${month}月${date}日 周${weekDay}`
    })
  },

  // 初始化管理器
  initManagers() {
    // 监听网络状态变化
    networkManager.addListener((isOnline, wasOnline) => {
      console.log('网络状态变化监听:', { isOnline, wasOnline })
      this.setData({ isOnline })
      
      if (wasOnline && !isOnline) {
        // 网络断开，显示提示
        wx.showToast({
          title: '网络已断开',
          icon: 'none',
          duration: 2000
        })
      } else if (!wasOnline && isOnline) {
        // 网络恢复，自动刷新
        wx.showToast({
          title: '网络已恢复',
          icon: 'success',
          duration: 1500
        })
        this.refreshTasks()
      }
    })
  },

  // 预加载数据
  async preloadData() {
    try {
      console.log('开始预加载数据...')
      
      // 并行预加载用户信息、任务数据和统计信息
      const [userInfo, tasks, stats] = await Promise.all([
        preloadManager.preloadUserInfo(),
        preloadManager.preloadTasks(),
        preloadManager.preloadStats()
      ])

      // 使用预加载的数据更新界面（如果当前没有数据）
      if (this.data.todayTasks.length === 0 && tasks && tasks.length > 0) {
        console.log('使用预加载的任务数据')
        this.setData({
          todayTasks: tasks,
          totalCount: stats.totalCount,
          completedCount: stats.completedCount,
          isUsingCachedData: true
        })
      }

      if (userInfo && !this.data.userInfo.nickName) {
        console.log('使用预加载的用户信息')
        this.setData({ userInfo })
      }

      console.log('预加载完成')
    } catch (error) {
      console.error('预加载失败:', error)
    }
  },

  // 初始化分页
  initPagination() {
    try {
      const today = new Date().toISOString().split('T')[0]
      console.log('初始化分页，日期:', today)
      
      this.taskPagination = new Pagination('Task', {
        pageSize: 10,
        whereCondition: {
          date: today
        },
        orderBy: {
          field: 'created_at',
          sort: 'desc'
        }
      })
      
      console.log('分页初始化成功', this.taskPagination)
    } catch (error) {
      console.error('分页初始化失败:', error)
      this.taskPagination = {
        reset: () => {},
        loadNextPage: () => Promise.resolve([]),
        hasMore: false,
        isLoading: false
      }
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const app = getApp()
    const localUserInfo = wx.getStorageSync('userInfo')
    const localOpenid = wx.getStorageSync('openid')

    console.log('检查登录状态:', { localUserInfo, localOpenid })

    if (localUserInfo && localOpenid) {
      this.setData({
        userInfo: localUserInfo,
        isLoggedIn: true
      })
      // 确保用户信息正确显示
      if (localUserInfo.nickName) {
        this.refreshTasks()
      }
    } else if (app.globalData.userInfo && app.globalData.openid) {
      wx.setStorageSync('userInfo', app.globalData.userInfo)
      wx.setStorageSync('openid', app.globalData.openid)
      this.setData({
        userInfo: app.globalData.userInfo,
        isLoggedIn: true
      })
      this.refreshTasks()
    } else {
      this.setData({ 
        isLoggedIn: false,
        userInfo: {}
      })
      console.log('用户未登录')
    }
  },

  // 刷新任务列表
  async refreshTasks() {
    if (!this.data.isLoggedIn) {
      console.log('未登录，跳过刷新任务')
      return
    }

    // 安全检查
    if (!this.taskPagination) {
      console.log('分页实例不存在，重新初始化')
      this.initPagination()
    }

    if (!this.taskPagination || typeof this.taskPagination.reset !== 'function') {
      console.error('分页实例无效，无法刷新任务')
      this.setData({ 
        isLoadingTasks: false, 
        isRefreshing: false,
        hasError: true,
        errorMessage: '系统错误，请重试'
      })
      return
    }

    this.setData({ 
      isLoadingTasks: true,
      isRefreshing: true,
      hasError: false,
      isUsingCachedData: false
    })

    try {
      // 检查网络状态
      const isOnline = await networkManager.checkNetwork()
      if (!isOnline) {
        throw new Error('网络不可用，请检查网络连接')
      }

      const today = new Date().toISOString().split('T')[0]
      console.log('刷新任务，日期:', today)
      
      // 使用带重试的请求
      const tasks = await networkManager.requestWithRetry(async () => {
        this.taskPagination.reset({ date: today })
        return await this.taskPagination.loadNextPage()
      })

      const completedCount = tasks.filter(task => task.status === 'done').length
      
      console.log('刷新任务成功，数量:', tasks.length)
      
      this.setData({
        todayTasks: tasks,
        totalCount: tasks.length,
        completedCount: completedCount,
        hasMoreTasks: this.taskPagination.hasMore,
        isLoadingTasks: false,
        isRefreshing: false
      })

      // 更新预加载缓存
      preloadManager.cache.set(`tasks_${today}`, tasks)
      preloadManager.cache.set('today_stats', {
        totalCount: tasks.length,
        completedCount: completedCount
      })
      
    } catch (error) {
      console.error('刷新任务失败:', error)
      
      let errorMessage = '加载失败，请重试'
      if (error.errMsg && error.errMsg.includes('network')) {
        errorMessage = '网络错误，请检查网络连接'
      }

      this.setData({ 
        isLoadingTasks: false,
        isRefreshing: false,
        hasError: true,
        errorMessage
      })

      // 显示错误提示
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 加载更多任务
  async loadMoreTasks() {
    if (!this.data.hasMoreTasks || this.data.isLoadingMore) {
      console.log('没有更多任务或正在加载，跳过')
      return
    }

    // 安全检查
    if (!this.taskPagination) {
      console.log('分页实例不存在，重新初始化')
      this.initPagination()
    }

    if (!this.taskPagination || typeof this.taskPagination.loadNextPage !== 'function') {
      console.error('分页实例无效，无法加载更多')
      this.setData({ isLoadingMore: false })
      return
    }

    this.setData({ isLoadingMore: true })

    try {
      // 检查网络状态
      const isOnline = await networkManager.checkNetwork()
      if (!isOnline) {
        throw new Error('网络不可用')
      }

      const moreTasks = await networkManager.requestWithRetry(() => 
        this.taskPagination.loadNextPage()
      )

      console.log('加载更多任务成功，数量:', moreTasks.length)
      
      if (moreTasks.length > 0) {
        const allTasks = [...this.data.todayTasks, ...moreTasks]
        const completedCount = allTasks.filter(task => task.status === 'done').length
        
        this.setData({
          todayTasks: allTasks,
          totalCount: allTasks.length,
          completedCount: completedCount,
          hasMoreTasks: this.taskPagination.hasMore,
          isLoadingMore: false
        })
        
      } else {
        this.setData({
          hasMoreTasks: false,
          isLoadingMore: false
        })
      }
    } catch (error) {
      console.error('加载更多任务失败:', error)
      this.setData({ isLoadingMore: false })
      
      networkManager.showNetworkToast()
    }
  },

  // 重试加载
  retryLoad() {
    console.log('用户点击重试')
    this.setData({ hasError: false })
    this.refreshTasks()
  },

  // 使用缓存数据
  useCachedData() {
    const cachedTasks = preloadManager.getCache('tasks_' + new Date().toISOString().split('T')[0])
    const cachedStats = preloadManager.getCache('today_stats')
    
    if (cachedTasks) {
      this.setData({
        todayTasks: cachedTasks,
        totalCount: (cachedStats && cachedStats.totalCount) || 0,
        completedCount: (cachedStats && cachedStats.completedCount) || 0,
        isUsingCachedData: true,
        hasError: false
      })
    }
  },

  // 清理资源
  cleanup() {
    // 移除网络监听器
    networkManager.removeListener(this.networkListener)
  },

  // 任务点击事件
  onTaskTap(e) {
    const task = e.currentTarget.dataset.task
    console.log('点击任务:', task)
  },

  // 标记任务完成
  markTaskDone(e) {
    const task = e.currentTarget.dataset.task
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    
    // 阻止事件冒泡
    e.stopPropagation()
    
    const tasks = this.data.todayTasks.map(t => 
      t._id === task._id ? { ...t, status: newStatus } : t
    )
    
    const completedCount = tasks.filter(t => t.status === 'done').length
    
    this.setData({ 
      todayTasks: tasks,
      completedCount: completedCount
    })
    
    this.updateTaskStatus(task._id, newStatus)
  },

  // 更新任务状态
  async updateTaskStatus(taskId, status) {
    try {
      await networkManager.requestWithRetry(async () => {
        await wx.cloud.database().collection('Task')
          .doc(taskId)
          .update({
            data: { 
              status,
              completed_at: status === 'done' ? new Date() : null
            }
          })
      })
      
      wx.showToast({
        title: status === 'done' ? '任务完成!' : '任务已恢复',
        icon: 'success'
      })
      
      // 更新缓存
      preloadManager.clearCache('today_stats')
      
    } catch (err) {
      console.error('更新任务失败:', err)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
      this.refreshTasks()
    }
  },

  // 编辑任务
  onEditTask(e) {
    const task = e.currentTarget.dataset.task
    // 阻止事件冒泡
    e.stopPropagation()
    
    wx.navigateTo({
      url: `/pages/addTask/addTask?id=${task._id}`
    })
  },

  // 删除任务
  onDeleteTask(e) {
    const task = e.currentTarget.dataset.task
    // 阻止事件冒泡
    e.stopPropagation()
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除任务"${task.title}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deleteTask(task._id)
        }
      }
    })
  },

  // 删除任务
  async deleteTask(taskId) {
    try {
      await networkManager.requestWithRetry(async () => {
        await wx.cloud.database().collection('Task')
          .doc(taskId)
          .remove()
      })
      
      const tasks = this.data.todayTasks.filter(t => t._id !== taskId)
      const completedCount = tasks.filter(task => task.status === 'done').length
      
      this.setData({ 
        todayTasks: tasks,
        totalCount: tasks.length,
        completedCount: completedCount
      })
      
      // 更新缓存
      preloadManager.clearCache('today_stats')
      
      wx.showToast({ 
        title: '删除成功', 
        icon: 'success',
        duration: 1500
      })
    } catch (error) {
      console.error('删除任务失败:', error)
      wx.showToast({ 
        title: '删除失败', 
        icon: 'none'
      })
    }
  },

  // 跳转到任务详情页
  goToTaskDetail(e) {
    const task = e.currentTarget.dataset.task
    console.log('跳转到任务详情:', task)
    
    if (task && task._id) {
      wx.navigateTo({
        url: `/pages/taskDetail/taskDetail?taskId=${task._id}`
      })
    } else {
      wx.showToast({
        title: '任务信息错误',
        icon: 'none'
      })
    }
  },

  // 格式化任务时间显示
  formatTaskTime(scheduled_start, scheduled_end) {
    if (!scheduled_start || !scheduled_end) {
      return ''
    }
    return `${scheduled_start} - ${scheduled_end}`
  },

  // 跳转到任务协调
  goToChat(e) {
    const taskId = e.currentTarget.dataset.taskid
    console.log('跳转到任务协调:', taskId)
    
    if (taskId) {
      wx.navigateTo({
        url: `/pages/chat/chat?taskId=${taskId}`
      })
    } else {
      wx.showToast({
        title: '任务信息错误',
        icon: 'none'
      })
    }
  },

  // 手动登录
  handleLogin() {
    const that = this
    wx.showLoading({
      title: '登录中...',
    })
    
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        wx.hideLoading()
        console.log('手动登录成功', res)
        
        const app = getApp()
        app.globalData.openid = res.result.openid
        app.globalData.userInfo = res.result.userInfo
        
        // 确保存储用户信息
        wx.setStorageSync('openid', res.result.openid)
        wx.setStorageSync('userInfo', res.result.userInfo)
        
        // 立即更新数据，确保界面刷新
        that.setData({
          userInfo: res.result.userInfo,
          isLoggedIn: true
        })
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
        
        // 重新初始化分页和刷新任务
        that.initPagination()
        that.refreshTasks()
        
        // 强制刷新界面
        setTimeout(() => {
          that.setData({})
        }, 100)
      },
      fail: err => {
        wx.hideLoading()
        console.error('手动登录失败', err)
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
      }
    })
  },

  // 跳转到添加任务页面
  goToAddTask() {
    wx.navigateTo({
      url: '/pages/addTask/addTask'
    })
  },

  // 跳转到统计页面
  goToStats() {
    wx.navigateTo({
      url: '/pages/stats/stats'
    })
  },

  // 跳转到个人中心
  goToProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    })
  }
})