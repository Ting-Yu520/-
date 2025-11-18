// pages/plan/plan.js
Page({
  data: {
    currentDate: '',
    formattedDate: '',
    weekday: '',
    isToday: false,
    isTomorrow: false,
    schedule: [],
    totalTasks: 0,
    completedTasks: 0,
    totalDuration: 0,
    completionRate: 0
  },

  onLoad() {
    // 设置默认日期为今天
    const today = this.getTodayDate()
    this.setDateData(today)
    this.loadSchedule(today)
  },

  onShow() {
    // 页面显示时重新加载数据
    this.loadSchedule(this.data.currentDate)
  },

  // 获取今天日期字符串
  getTodayDate() {
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 设置日期相关数据
  setDateData(dateString) {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // 格式化日期显示
    const month = date.getMonth() + 1
    const day = date.getDate()
    const formattedDate = `${month}月${day}日`
    
    // 获取星期几
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[date.getDay()]
    
    // 判断是否是今天或明天
    const isToday = dateString === this.getTodayDate()
    const isTomorrow = dateString === this.formatDate(tomorrow)
    
    this.setData({
      currentDate: dateString,
      formattedDate: formattedDate,
      weekday: weekday,
      isToday: isToday,
      isTomorrow: isTomorrow
    })
  },

  // 日期选择变化
  onDateChange(e) {
    const selectedDate = e.detail.value
    this.setDateData(selectedDate)
    this.loadSchedule(selectedDate)
  },

  // 前往上一天
  goToPreviousDay() {
    const currentDate = new Date(this.data.currentDate)
    currentDate.setDate(currentDate.getDate() - 1)
    const previousDate = this.formatDate(currentDate)
    
    this.setDateData(previousDate)
    this.loadSchedule(previousDate)
  },

  // 前往下一天
  goToNextDay() {
    const currentDate = new Date(this.data.currentDate)
    currentDate.setDate(currentDate.getDate() + 1)
    const nextDate = this.formatDate(currentDate)
    
    this.setDateData(nextDate)
    this.loadSchedule(nextDate)
  },

  // 前往今天
  goToToday() {
    const today = this.getTodayDate()
    this.setDateData(today)
    this.loadSchedule(today)
  },

  // 前往明天
  goToTomorrow() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = this.formatDate(tomorrow)
    
    this.setDateData(tomorrowStr)
    this.loadSchedule(tomorrowStr)
  },

  // 格式化日期对象为字符串
  formatDate(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 加载日程安排
  loadSchedule(date) {
    const db = wx.cloud.database()
    
    db.collection('Task').where({
      date: date
    })
    .orderBy('scheduled_start', 'asc')
    .get()
    .then(res => {
      console.log('任务数据:', res.data)
      this.processScheduleData(res.data)
      this.calculateStats(res.data)
    })
    .catch(err => {
      console.error('加载日程失败:', err)
      // 使用示例数据确保显示
      const sampleData = this.getSampleData()
      this.processScheduleData(sampleData)
      this.calculateStats(sampleData)
      wx.showToast({
        title: '使用示例数据',
        icon: 'none'
      })
    })
  },

  // 获取示例数据（用于调试）
  getSampleData() {
    return [
      {
        _id: 'sample1',
        title: '复习知识点',
        duration: 45,
        priority: 3,
        status: 'pending',
        scheduled_start: '09:00',
        scheduled_end: '09:45',
        date: this.data.currentDate
      }
    ]
  },

  // 处理日程数据，生成时间线
  processScheduleData(tasks) {
    if (tasks.length === 0) {
      this.setData({ schedule: [] })
      return
    }

    // 生成时间槽（每2小时一个槽）
    const timeSlots = this.generateTimeSlots()
    
    // 将任务分配到对应的时间槽
    const schedule = timeSlots.map(timeSlot => {
      const slotTasks = tasks.filter(task => {
        const taskStart = this.timeToMinutes(task.scheduled_start)
        const slotStart = this.timeToMinutes(timeSlot)
        return taskStart >= slotStart && taskStart < slotStart + 120 // 2小时区间
      })
      
      return {
        timeSlot: timeSlot,
        tasks: slotTasks
      }
    })

    this.setData({ schedule: schedule })
  },

  // 生成时间槽
  generateTimeSlots() {
    const slots = []
    for (let hour = 6; hour <= 22; hour += 2) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
    }
    return slots
  },

  // 时间转换为分钟数
  timeToMinutes(timeStr) {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  },

  // 计算统计信息
  calculateStats(tasks) {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(task => task.status === 'done').length
    const totalDuration = tasks.reduce((sum, task) => sum + (task.duration || 0), 0)
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    this.setData({
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      totalDuration: totalDuration,
      completionRate: completionRate
    })
  },

  // 切换任务状态
  toggleTaskStatus(e) {
    const taskId = e.currentTarget.dataset.taskid
    const currentStatus = e.currentTarget.dataset.status
    const newStatus = currentStatus === 'done' ? 'pending' : 'done'
    
    // 阻止事件冒泡，避免触发任务卡片点击
    e.stopPropagation()
    
    const db = wx.cloud.database()
    
    db.collection('Task').doc(taskId).update({
      data: {
        status: newStatus
      }
    })
    .then(() => {
      wx.showToast({
        title: newStatus === 'done' ? '任务完成!' : '任务重置',
        icon: 'success'
      })
      // 重新加载日程
      this.loadSchedule(this.data.currentDate)
    })
    .catch(err => {
      console.error('更新任务状态失败:', err)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    })
  },

  // 调整任务
  adjustTask(e) {
    const taskId = e.currentTarget.dataset.taskid
    // 阻止事件冒泡，避免触发任务卡片点击
    e.stopPropagation()
    wx.navigateTo({
      url: `/pages/chat/chat?taskId=${taskId}`
    })
  },

  // 新增：跳转到任务详情页面
  goToTaskDetail(e) {
    const taskId = e.currentTarget.dataset.taskid
    if (taskId) {
      wx.navigateTo({
        url: `/pages/taskDetail/taskDetail?taskId=${taskId}`
      })
    }
  },

  // 计算空闲时间
  calculateFreeTime(currentTime, currentIndex) {
    if (currentIndex <= 0) return 0
    
    const currentMinutes = this.timeToMinutes(currentTime)
    const previousTime = this.data.schedule[currentIndex - 1].timeSlot
    const previousMinutes = this.timeToMinutes(previousTime)
    
    return currentMinutes - previousMinutes
  },

  // 跳转到添加任务页面
  goToAddTask() {
    wx.navigateTo({
      url: '/pages/addTask/addTask'
    })
  },

  // AI优化日程
  generateAISchedule() {
    wx.showModal({
      title: 'AI优化日程',
      content: '该功能正在开发中，敬请期待！',
      showCancel: false
    })
  }
})