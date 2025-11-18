// pages/addTask/addTask.js
Page({
  data: {
    taskData: {
      title: '',
      duration: '',
      priority: 3, // 默认中等优先级
      date: ''
    },
    isFormValid: false,
    isLoading: false
  },

  onLoad() {
    // 设置默认日期为今天
    const today = this.getTodayDate()
    this.setData({
      'taskData.date': today
    })
    this.checkFormValidity()
  },

  // 获取今天日期字符串
  getTodayDate() {
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 任务名称输入
  onTitleInput(e) {
    this.setData({
      'taskData.title': e.detail.value
    })
    this.checkFormValidity()
  },

  // 时长输入
  onDurationInput(e) {
    this.setData({
      'taskData.duration': e.detail.value
    })
    this.checkFormValidity()
  },

  // 选择优先级
  selectPriority(e) {
    const priority = parseInt(e.currentTarget.dataset.value)
    this.setData({
      'taskData.priority': priority
    })
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'taskData.date': e.detail.value
    })
  },

  // 检查表单是否有效
  checkFormValidity() {
    const { title, duration } = this.data.taskData
    const isValid = title.trim().length > 0 && duration > 0
    this.setData({
      isFormValid: isValid
    })
  },

  // 使用快捷模板
  useTemplate(e) {
    const { title, duration } = e.currentTarget.dataset
    this.setData({
      'taskData.title': title,
      'taskData.duration': duration
    })
    this.checkFormValidity()
  },

  // 提交任务
  async submitTask(e) {
    if (!this.data.isFormValid || this.data.isLoading) {
      return
    }

    this.setData({ isLoading: true })

    try {
      // 保存任务到数据库
      const taskId = await this.saveTaskToDB()
      
      if (taskId) {
        wx.showToast({
          title: '任务添加成功',
          icon: 'success',
          duration: 1500
        })

        // 跳转到AI协调页面
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/chat/chat?taskId=${taskId}`
          })
        }, 1500)
      }
    } catch (error) {
      console.error('提交任务失败:', error)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 保存任务到数据库
  saveTaskToDB() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database()
      const { title, duration, priority, date } = this.data.taskData

      db.collection('Task').add({
        data: {
          title: title.trim(),
          duration: parseInt(duration),
          priority: priority,
          date: date,
          status: 'pending',
          created_at: db.serverDate()
        },
        success: (res) => {
          console.log('任务保存成功:', res)
          resolve(res._id)
        },
        fail: (err) => {
          console.error('任务保存失败:', err)
          reject(err)
        }
      })
    })
  },

  // 返回首页
  onBack() {
    wx.navigateBack()
  }
})