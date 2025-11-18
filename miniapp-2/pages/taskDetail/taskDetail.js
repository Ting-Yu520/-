// pages/taskDetail/taskDetail.js
Page({
  data: {
    task: {
      title: '',
      duration: 0,
      priority: 1,
      date: '',
      status: 'pending',
      description: '',
      scheduled_start: '',
      scheduled_end: '',
      created_at: null,
      updated_at: null,
      completed_at: null
    },
    formattedTime: {
      created_at: '',
      updated_at: '',
      completed_at: ''
    },
    taskId: '',
    isLoading: true,
    hasError: false,
    errorMessage: ''
  },

  onLoad(options) {
    console.log('任务详情页面参数:', options)
    
    const taskId = options.id || options.taskId || options._id
    console.log('提取的任务ID:', taskId)
    
    if (taskId && taskId !== 'undefined' && taskId.length > 10) {
      this.setData({ 
        taskId: taskId,
        isLoading: true,
        hasError: false,
        errorMessage: ''
      })
      this.loadTaskDetail(taskId)
    } else {
      console.error('任务ID参数无效:', taskId)
      this.setData({
        hasError: true,
        isLoading: false,
        errorMessage: '任务ID无效或缺失'
      })
      wx.showToast({
        title: '任务ID错误',
        icon: 'none',
        duration: 2000
      })
    }
  },

  async loadTaskDetail(taskId) {
    try {
      console.log('开始加载任务详情，ID:', taskId)
      
      const db = wx.cloud.database()
      const result = await db.collection('Task').doc(taskId).get()
      
      console.log('🔍 原始任务数据:', result.data)
      
      // 处理任务数据并格式化时间
      const { taskData, formattedTime } = this.processTaskData(result.data)
      console.log('✅ 处理后的任务数据:', taskData)
      console.log('✅ 格式化后的时间:', formattedTime)
      
      this.setData({
        task: taskData,
        formattedTime: formattedTime,
        isLoading: false,
        hasError: false
      })
      
      // 设置页面标题
      wx.setNavigationBarTitle({
        title: taskData.title || '任务详情'
      })
      
    } catch (error) {
      console.error('❌ 加载任务详情失败:', error)
      this.setData({
        isLoading: false,
        hasError: true,
        errorMessage: '加载失败: ' + error.message
      })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      
      // 使用模拟数据作为降级方案
      this.useMockTaskData()
    }
  },

  // 处理任务数据并格式化时间
  processTaskData(rawData) {
    const taskData = { ...rawData }
    const formattedTime = {
      created_at: '',
      updated_at: '',
      completed_at: ''
    }
    
    // 确保所有必需字段都有默认值
    const defaultTask = {
      title: '未知任务',
      duration: 0,
      priority: 1,
      date: '',
      status: 'pending',
      description: '',
      scheduled_start: '',
      scheduled_end: '',
      created_at: null,
      updated_at: null,
      completed_at: null
    }
    
    // 合并数据，确保没有缺失字段
    Object.keys(defaultTask).forEach(key => {
      if (taskData[key] === undefined || taskData[key] === null) {
        taskData[key] = defaultTask[key]
      }
    })
    
    // 处理时间字段并格式化
    const timestampFields = ['created_at', 'updated_at', 'completed_at']
    
    timestampFields.forEach(field => {
      const value = taskData[field]
      console.log(`🕒 处理时间字段 ${field}:`, value)
      
      if (value && value instanceof Date) {
        // 已经是Date对象，直接格式化
        formattedTime[field] = this.formatTimeDirect(value)
        console.log(`✅ ${field} 格式化成功:`, formattedTime[field])
      } else if (value) {
        // 尝试转换为Date对象
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            taskData[field] = date
            formattedTime[field] = this.formatTimeDirect(date)
            console.log(`✅ ${field} 转换并格式化成功:`, formattedTime[field])
          } else {
            formattedTime[field] = '--'
            console.log(`❌ ${field} 转换为Date对象失败`)
          }
        } catch (error) {
          console.error(`❌ 处理时间字段 ${field} 时出错:`, error)
          formattedTime[field] = '--'
        }
      } else {
        formattedTime[field] = '--'
        console.log(`❌ ${field} 为空`)
      }
    })
    
    return { taskData, formattedTime }
  },

  // 直接格式化时间（不在WXML中调用）
  formatTimeDirect(timestamp) {
    if (!timestamp) {
      return '--'
    }
    
    try {
      let date = timestamp
      
      // 确保是Date对象
      if (!(date instanceof Date)) {
        date = new Date(date)
      }
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return '--'
      }
      
      // 直接格式化为 YYYY-MM-DD HH:MM
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day} ${hours}:${minutes}`
      
    } catch (error) {
      console.error('❌ 格式化时间出错:', error, '时间戳:', timestamp)
      return '--'
    }
  },

  // 使用模拟数据（降级方案）
  useMockTaskData() {
    console.log('使用模拟数据作为降级方案')
    const mockTask = {
      title: '完成作业',
      duration: 60,
      priority: 4,
      date: '2025-10-22',
      status: 'done',
      description: '完成数学和语文作业',
      scheduled_start: '09:30',
      scheduled_end: '10:30',
      created_at: new Date('2025-10-22T22:04:02+08:00'),
      updated_at: new Date('2025-10-22T23:49:45+08:00'),
      completed_at: new Date('2025-10-22T23:49:45+08:00')
    }
    
    const formattedTime = {
      created_at: this.formatTimeDirect(mockTask.created_at),
      updated_at: this.formatTimeDirect(mockTask.updated_at),
      completed_at: this.formatTimeDirect(mockTask.completed_at)
    }
    
    this.setData({
      task: mockTask,
      formattedTime: formattedTime,
      isLoading: false,
      hasError: false,
      errorMessage: ''
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 切换任务状态
  toggleTaskStatus() {
    const { task, hasError, taskId } = this.data
    if (hasError || !taskId) {
      wx.showToast({
        title: '无法操作，数据加载失败',
        icon: 'none'
      })
      return
    }
    
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    
    wx.showLoading({ title: '更新中...' })
    
    const updateData = {
      status: newStatus,
      updated_at: new Date()
    }
    
    if (newStatus === 'done') {
      updateData.completed_at = new Date()
    } else {
      updateData.completed_at = null
    }
    
    wx.cloud.database().collection('Task')
      .doc(taskId)
      .update({
        data: updateData
      })
      .then(() => {
        wx.hideLoading()
        
        // 更新本地数据和格式化时间
        const updatedTask = {
          ...task,
          status: newStatus,
          completed_at: updateData.completed_at,
          updated_at: new Date()
        }
        
        const updatedFormattedTime = {
          ...this.data.formattedTime,
          completed_at: this.formatTimeDirect(updateData.completed_at),
          updated_at: this.formatTimeDirect(new Date())
        }
        
        this.setData({
          task: updatedTask,
          formattedTime: updatedFormattedTime
        })
        
        wx.showToast({
          title: newStatus === 'done' ? '任务已完成!' : '任务已恢复',
          icon: 'success'
        })
        
        this.notifyPagesUpdate()
      })
      .catch(err => {
        wx.hideLoading()
        console.error('更新任务状态失败:', err)
        wx.showToast({
          title: '操作失败: ' + err.message,
          icon: 'none'
        })
      })
  },

  // 跳转到AI协调页面
  goToChat() {
    const { taskId, hasError } = this.data
    if (hasError || !taskId) {
      wx.showToast({
        title: '无法协调，数据加载失败',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: `/pages/chat/chat?taskId=${taskId}`
    })
  },

  // 编辑任务
  editTask() {
    const { taskId, hasError } = this.data
    if (hasError || !taskId) {
      wx.showToast({
        title: '无法编辑，数据加载失败',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: `/pages/addTask/addTask?id=${taskId}&edit=true`
    })
  },

  // 通知其他页面更新
  notifyPagesUpdate() {
    const pages = getCurrentPages()
    
    // 通知首页更新
    const indexPage = pages[0]
    if (indexPage && typeof indexPage.refreshTasks === 'function') {
      indexPage.refreshTasks()
    }
    
    // 通知计划页面更新
    const planPage = pages.find(page => page.route && page.route.includes('pages/plan/plan'))
    if (planPage && typeof planPage.loadTasks === 'function') {
      planPage.loadTasks()
    }
    
    // 触发全局更新回调
    if (getApp().globalData.taskUpdateCallback) {
      getApp().globalData.taskUpdateCallback()
    }
  },

  // 重试加载
  retryLoad() {
    if (this.data.taskId) {
      this.setData({
        isLoading: true,
        hasError: false,
        errorMessage: ''
      })
      this.loadTaskDetail(this.data.taskId)
    } else {
      wx.showToast({
        title: '无任务ID可重试',
        icon: 'none'
      })
    }
  },

  // 分享功能
  onShareAppMessage() {
    const { task, hasError } = this.data
    if (hasError) {
      return {
        title: '任务详情',
        path: '/pages/index/index'
      }
    }
    
    return {
      title: `任务详情: ${task.title}`,
      path: `/pages/taskDetail/taskDetail?id=${this.data.taskId}`
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { task, hasError } = this.data
    if (hasError) {
      return {
        title: '任务详情'
      }
    }
    
    return {
      title: `任务详情: ${task.title}`
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    if (this.data.taskId) {
      this.loadTaskDetail(this.data.taskId).finally(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  // 监听页面显示
  onShow() {
    // 页面显示时重新加载数据，确保数据最新
    if (this.data.taskId && !this.data.isLoading) {
      this.loadTaskDetail(this.data.taskId)
    }
  }
})