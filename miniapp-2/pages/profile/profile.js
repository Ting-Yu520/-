// pages/profile/profile.js
Page({
  data: {
    userInfo: {},
    openid: '',
    registerTime: '',
    totalTasks: 0,
    completedTasks: 0,
    completionRate: 0,
    totalDuration: 0,
    recentTasks: [],
    totalDays: 0 
  },

  onLoad() {
    this.loadUserData()
    this.loadUserStats()
    this.loadRecentTasks()
  },

  onShow() {
    // 页面显示时重新加载数据
    this.loadUserStats()
    this.loadRecentTasks()
  },

  // 加载用户数据
  loadUserData() {
    const app = getApp()
    this.setData({
      userInfo: app.globalData.userInfo || {},
      openid: app.globalData.openid || ''
    })
    
    // 如果没有注册时间，设置为当前时间
    if (!this.data.registerTime) {
      const registerTime = new Date().toISOString()
      this.setData({
        registerTime: registerTime,
        totalDays: this.calculateUsageDays(registerTime)
      })
    }
  },

  // 计算使用天数
  calculateUsageDays(registerTime) {
    const registerDate = new Date(registerTime)
    const today = new Date()
    const diffTime = Math.abs(today - registerDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  },

  // 加载用户统计信息
  loadUserStats() {
    const db = wx.cloud.database()
    const _ = db.command
    
    // 获取总任务数
    db.collection('Task').where({
      _openid: this.data.openid
    }).count().then(res => {
      this.setData({
        totalTasks: res.total
      })
    }).catch(err => {
      console.error('获取总任务数失败:', err)
    })
    
    // 获取已完成任务数
    db.collection('Task').where({
      _openid: this.data.openid,
      status: 'done'
    }).count().then(res => {
      const completedTasks = res.total
      const completionRate = this.data.totalTasks > 0 ? 
        Math.round((completedTasks / this.data.totalTasks) * 100) : 0
      
      this.setData({
        completedTasks: completedTasks,
        completionRate: completionRate
      })
    }).catch(err => {
      console.error('获取已完成任务数失败:', err)
    })
    
    // 获取总时长
    db.collection('Task').where({
      _openid: this.data.openid
    }).get().then(res => {
      const totalDuration = res.data.reduce((sum, task) => sum + (task.duration || 0), 0)
      this.setData({
        totalDuration: totalDuration
      })
    }).catch(err => {
      console.error('获取总时长失败:', err)
    })
  },

  // 加载最近任务
  loadRecentTasks() {
    const db = wx.cloud.database()
    
    db.collection('Task').where({
      _openid: this.data.openid
    })
    .orderBy('created_at', 'desc')
    .limit(5)
    .get()
    .then(res => {
      console.log('最近任务:', res.data)
      this.setData({
        recentTasks: res.data
      })
    })
    .catch(err => {
      console.error('加载最近任务失败:', err)
      // 使用示例数据确保显示
      this.setData({
        recentTasks: this.getSampleTasks()
      })
    })
  },

  // 获取示例任务数据
  getSampleTasks() {
    return [
      {
        _id: 'sample1',
        title: '示例任务：完成项目报告',
        duration: 60,
        priority: 3,
        status: 'pending',
        scheduled_start: '14:00',
        scheduled_end: '15:00',
        date: new Date().toISOString().split('T')[0]
      },
      {
        _id: 'sample2',
        title: '示例任务：学习新技术',
        duration: 45,
        priority: 2,
        status: 'done',
        scheduled_start: '10:00',
        scheduled_end: '10:45',
        date: new Date().toISOString().split('T')[0]
      }
    ]
  },

  // 格式化日期
  formatDate(dateString) {
    if (!dateString) return '未知'
    
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 格式化任务日期
  formatTaskDate(dateString) {
    if (!dateString) return ''
    
    const today = new Date().toISOString().split('T')[0]
    const taskDate = new Date(dateString)
    
    if (dateString === today) {
      return '今天'
    } else if (dateString === this.getYesterdayDate()) {
      return '昨天'
    } else {
      const month = (taskDate.getMonth() + 1).toString().padStart(2, '0')
      const day = taskDate.getDate().toString().padStart(2, '0')
      return `${month}-${day}`
    }
  },

  // 获取昨天日期
  getYesterdayDate() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待完成',
      'in_progress': '进行中',
      'done': '已完成'
    }
    return statusMap[status] || '未知'
  },

  // 新增：跳转到任务详情
  goToTaskDetail(e) {
    const taskId = e.currentTarget.dataset.taskid
    if (taskId) {
      wx.navigateTo({
        url: `/pages/taskDetail/taskDetail?taskId=${taskId}`
      })
    }
  },

  // 跳转到计划页面
  goToPlan() {
    wx.switchTab({
      url: '/pages/plan/plan'
    })
  },

  // 跳转到统计页面
  goToStats() {
    wx.navigateTo({
      url: '/pages/stats/stats'
    })
  },

  // 跳转到添加任务页面
  goToAddTask() {
    wx.navigateTo({
      url: '/pages/addTask/addTask'
    })
  },

  // 新增：处理登录
  handleLogin() {
    wx.showModal({
      title: '登录提示',
      content: '请在首页完成微信登录',
      showCancel: false,
      success: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  },

  // 新增：联系客服
  contactSupport() {
    wx.showModal({
      title: '联系客服',
      content: '客服功能正在开发中，敬请期待！',
      showCancel: false
    })
  },

  // 显示退出登录确认
  showLogoutConfirm() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.logout()
        }
      }
    })
  },

  // 退出登录
  logout() {
    // 清除用户数据
    const app = getApp()
    app.globalData.userInfo = null
    app.globalData.openid = null
    
    // 显示退出成功提示
    wx.showToast({
      title: '退出成功',
      icon: 'success',
      duration: 1500
    })
    
    // 返回首页
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      })
    }, 1500)
  }
})