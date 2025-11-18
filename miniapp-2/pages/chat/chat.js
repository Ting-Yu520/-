// pages/chat/chat.js
Page({
  data: {
    taskId: '',
    taskData: {},
    messages: [],
    inputMessage: '',
    isAIThinking: false,
    showQuickActions: true,
    scrollTop: 0,
    autoFocus: false,
    schedule: {},
    userInfo: {},
    hasNetworkError: false,
    // 计算顶部和底部区域高度
    topSectionHeight: 180, // 顶部区域预估高度(rpx)
    bottomSectionHeight: 280 // 底部区域预估高度(rpx)
  },

  onLoad(options) {
    console.log('页面参数:', options)
    this.setData({
      taskId: options.taskId
    })
    
    this.loadTaskData()
    this.initChat()
    
    // 计算实际高度
    this.calculateHeights()
  },

  // 计算各区域高度
  calculateHeights() {
    const systemInfo = wx.getSystemInfoSync()
    const windowHeight = systemInfo.windowHeight
    const pixelRatio = 750 / systemInfo.windowWidth
    
    // 可以根据实际情况调整这些值
    const topHeight = 180 // 顶部固定区域高度
    const bottomHeight = 280 // 底部固定区域高度
    
    console.log('窗口高度:', windowHeight, '像素比:', pixelRatio)
  },

  // 加载任务数据
  loadTaskData() {
    const db = wx.cloud.database()
    db.collection('Task').doc(this.data.taskId).get({
      success: (res) => {
        console.log('任务数据:', res.data)
        this.setData({
          taskData: res.data,
          hasNetworkError: false
        })
        this.generateInitialSchedule()
      },
      fail: (err) => {
        console.error('加载任务失败:', err)
        this.setData({
          hasNetworkError: true
        })
        this.useMockTaskData()
      }
    })
  },

  // 使用模拟任务数据
  useMockTaskData() {
    const mockTask = {
      title: '完成作业',
      duration: 60,
      priority: 4,
      date: '2025-10-22'
    }
    
    this.setData({
      taskData: mockTask
    })
    this.generateInitialSchedule()
  },

  // 初始化聊天
  initChat() {
    const app = getApp()
    const welcomeMessage = {
      id: Date.now(),
      role: 'ai',
      content: '您好！我是您的AI日程助理。我已经根据您任务的重要性和时长，为您生成了一个初步的日程安排。您可以通过聊天告诉我您的特殊需求，我会帮您调整到最合适的时间段。',
      time: this.getCurrentTime()
    }

    this.setData({
      userInfo: app.globalData.userInfo || { nickName: '用户' },
      messages: [welcomeMessage]
    })
    
    this.scrollToBottom()
  },

  // 生成初始AI日程
  generateInitialSchedule() {
    const { duration, priority } = this.data.taskData
    
    let startTime = '09:00'
    if (priority >= 4) {
      startTime = '14:00'
    } else if (priority <= 2) {
      startTime = '16:00'
    } else {
      startTime = '10:30'
    }

    const endTime = this.calculateEndTime(startTime, duration)

    this.setData({
      schedule: {
        scheduled_start: startTime,
        scheduled_end: endTime
      }
    })

    const scheduleMessage = {
      id: Date.now() + 1,
      role: 'ai',
      content: `我已经将"${this.data.taskData.title}"安排在 ${startTime} - ${endTime}。这个时间段比较适合${this.getTimeSuggestion(priority)}，您觉得怎么样？`,
      time: this.getCurrentTime()
    }

    this.setData({
      messages: [...this.data.messages, scheduleMessage]
    })
    
    this.scrollToBottom()
  },

  // 计算结束时间
  calculateEndTime(startTime, duration) {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + parseInt(duration)
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  },

  // 获取时间建议
  getTimeSuggestion(priority) {
    const suggestions = {
      1: '处理不太紧急的任务',
      2: '处理常规任务',
      3: '处理中等重要的任务', 
      4: '处理重要任务',
      5: '处理紧急重要的任务'
    }
    return suggestions[priority] || '处理这个任务'
  },

  // 输入处理
  onInput(e) {
    this.setData({
      inputMessage: e.detail.value
    })
  },

  // 发送消息
  sendMessage() {
    const message = this.data.inputMessage.trim()
    if (!message) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      time: this.getCurrentTime()
    }

    this.setData({
      messages: [...this.data.messages, userMessage],
      inputMessage: '',
      isAIThinking: true,
      showQuickActions: false,
      autoFocus: true
    })

    this.scrollToBottom()
    this.callAIResponse(message)
  },

  // 发送快捷消息
  sendQuickMessage(e) {
    const message = e.currentTarget.dataset.message
    this.setData({
      inputMessage: message
    })
    this.sendMessage()
  },

  // 调用AI回复
  async callAIResponse(userMessage) {
    try {
      await this.callRealAI(userMessage)
    } catch (error) {
      console.error('AI调用失败，使用备用回复:', error)
      this.useFallbackAIResponse(userMessage)
    }
  },

  // 调用真实AI
  async callRealAI(userMessage) {
    try {
      const conversationHistory = this.data.messages
        .filter(msg => msg.role === 'user' || msg.role === 'ai')
        .slice(-6)
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))

      const result = await wx.cloud.callFunction({
        name: 'callDeepSeek',
        data: {
          userMessage: userMessage,
          taskInfo: this.data.taskData,
          conversationHistory: conversationHistory
        }
      })

      if (result.result && result.result.success) {
        const aiResponse = result.result.response
        const scheduleUpdate = result.result.schedule
        
        const aiMessage = {
          id: Date.now(),
          role: 'ai',
          content: aiResponse,
          time: this.getCurrentTime()
        }

        if (scheduleUpdate) {
          this.setData({
            schedule: scheduleUpdate
          })
        }

        this.setData({
          messages: [...this.data.messages, aiMessage],
          isAIThinking: false,
          showQuickActions: true,
          hasNetworkError: false
        })

      } else {
        throw new Error('AI调用返回失败')
      }

    } catch (error) {
      console.error('调用AI失败:', error)
      throw error
    }
    
    this.scrollToBottom()
  },

  // 备用AI回复
  useFallbackAIResponse(userMessage) {
    const fallbackResponse = this.generateAIResponse(userMessage)
    
    const aiMessage = {
      id: Date.now(),
      role: 'ai', 
      content: fallbackResponse.content,
      time: this.getCurrentTime()
    }

    if (fallbackResponse.schedule) {
      this.setData({
        schedule: fallbackResponse.schedule
      })
    }

    this.setData({
      messages: [...this.data.messages, aiMessage],
      isAIThinking: false,
      showQuickActions: true,
      hasNetworkError: true
    })
    
    this.scrollToBottom()
  },

  // 生成AI回复
  generateAIResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase()
    let response = { content: '' }
    
    if (lowerMessage.includes('上午') || lowerMessage.includes('早上')) {
      const newSchedule = this.adjustSchedule('09:30')
      response.content = `✅ 已调整到上午 ${newSchedule.scheduled_start} 开始`
      response.schedule = newSchedule
    }
    else if (lowerMessage.includes('下午') || lowerMessage.includes('午后')) {
      const newSchedule = this.adjustSchedule('14:00')
      response.content = `✅ 已安排到下午 ${newSchedule.scheduled_start} 开始`
      response.schedule = newSchedule
    }
    else if (lowerMessage.includes('晚上') || lowerMessage.includes('傍晚')) {
      const newSchedule = this.adjustSchedule('19:00')
      response.content = `✅ 已安排到晚上 ${newSchedule.scheduled_start} 开始`
      response.schedule = newSchedule
    }
    else if (lowerMessage.includes('缩短') || lowerMessage.includes('减少')) {
      const newDuration = Math.max(15, this.data.taskData.duration - 30)
      const newSchedule = this.adjustDuration(newDuration)
      response.content = `⏱️ 时长调整为 ${newDuration} 分钟`
      response.schedule = newSchedule
    }
    else if (lowerMessage.includes('延长') || lowerMessage.includes('增加')) {
      const newDuration = this.data.taskData.duration + 30
      const newSchedule = this.adjustDuration(newDuration)
      response.content = `⏱️ 时长调整为 ${newDuration} 分钟`
      response.schedule = newSchedule
    }
    else {
      response.content = `🤖 请选择时间段或告诉我具体时间`
    }

    return response
  },

  // 调整日程时间
  adjustSchedule(newStartTime) {
    const endTime = this.calculateEndTime(newStartTime, this.data.taskData.duration)
    return {
      scheduled_start: newStartTime,
      scheduled_end: endTime
    }
  },

  // 调整时长
  adjustDuration(newDuration) {
    return this.adjustSchedule(this.data.schedule.scheduled_start)
  },

  // 显示调整选项
  showAdjustOptions() {
    const message = {
      id: Date.now(),
      role: 'system',
      content: '请选择调整方向'
    }
    this.setData({
      messages: [...this.data.messages, message],
      showQuickActions: true
    })
    this.scrollToBottom()
  },

  // 接受日程安排
  acceptSchedule() {
    this.updateTaskSchedule()
    
    const message = {
      id: Date.now(),
      role: 'system',
      content: '✅ 日程已确认'
    }

    this.setData({
      messages: [...this.data.messages, message]
    })

    wx.showToast({
      title: '日程确认成功',
      icon: 'success',
      duration: 1500
    })

    setTimeout(() => {
      wx.navigateBack({
        delta: 1
      })
    }, 1500)
  },

  // 更新任务日程
  updateTaskSchedule() {
    const db = wx.cloud.database()
    db.collection('Task').doc(this.data.taskId).update({
      data: {
        scheduled_start: this.data.schedule.scheduled_start,
        scheduled_end: this.data.schedule.scheduled_end,
        status: 'in_progress',
        updated_at: new Date()
      },
      success: () => {
        console.log('任务日程更新成功')
        if (getApp().globalData.taskUpdateCallback) {
          getApp().globalData.taskUpdateCallback()
        }
      },
      fail: (err) => {
        console.error('任务日程更新失败:', err)
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        })
      }
    })
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      this.setData({
        scrollTop: 999999
      })
    }, 100)
  },

  // 重试加载数据
  retryLoadData() {
    this.setData({
      hasNetworkError: false
    })
    this.loadTaskData()
  },

  onUnload() {
    this.setData({
      messages: [],
      inputMessage: '',
      isAIThinking: false
    })
  },

  onPullDownRefresh() {
    this.loadTaskData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  onReady() {
    // 在页面渲染完成后计算合适的消息宽度
    this.calculateOptimalLayout()
  },
  
  calculateOptimalLayout() {
    const systemInfo = wx.getSystemInfoSync()
    const screenWidth = systemInfo.screenWidth
    const pixelRatio = 750 / screenWidth
    
    // 计算最大消息宽度（屏幕宽度 - 头像宽度 - 边距）
    const maxMessageWidth = screenWidth - 80 - 30 // 屏幕宽度 - 头像宽度 - 边距
    
    console.log('屏幕宽度:', screenWidth, '建议消息最大宽度:', maxMessageWidth)
  },

  onShareAppMessage() {
    return {
      title: 'AI日程助手',
      path: `/pages/chat/chat?taskId=${this.data.taskId}`
    }
  }
})