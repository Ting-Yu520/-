// pages/stats/stats.js 
Page({
  data: {
    chartData: {},
    isLoading: true,
    selectedRange: 'week',
    isLoggedIn: false,
    forceRefresh: false,
    hasData: false
  },

  onLoad: function() {
    this.checkLoginStatus();
  },

  onShow: function() {
    this.checkLoginStatus();
  },

  onReady: function() {
    setTimeout(() => {
      if (this.data.hasData && !this.data.isLoading) {
        this.renderCharts();
      }
    }, 500);
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');
    
    if (userInfo && openid) {
      this.setData({ isLoggedIn: true });
      this.loadStatisticsData();
    } else {
      this.setData({ isLoggedIn: false });
      this.showLoginPrompt();
    }
  },

  // 显示登录提示
  showLoginPrompt: function() {
    wx.showModal({
      title: '需要登录',
      content: '请先登录以查看统计数据',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  },

  // 加载统计数据
  loadStatisticsData: async function() {
    if (!this.data.isLoggedIn) return;

    const cacheKey = `stats_${this.data.selectedRange}_${new Date().toISOString().split('T')[0]}`;
    const cachedData = wx.getStorageSync(cacheKey);
    
    if (cachedData && !this.data.forceRefresh && cachedData.completion && cachedData.completion.total > 0) {
      this.setData({
        chartData: cachedData,
        isLoading: false,
        hasData: true
      });
      setTimeout(() => this.renderCharts(), 300);
      return;
    }

    this.setData({ isLoading: true });
    
    try {
      const tasks = await this.getRealTasksData();
      
      if (!tasks || tasks.length === 0) {
        const sampleData = this.getSampleChartData();
        this.setData({ 
          isLoading: false, 
          chartData: sampleData,
          hasData: true
        });
        setTimeout(() => this.renderCharts(), 300);
        return;
      }

      const chartData = {
        completion: this.calculateCompletionStats(tasks),
        timeUsage: this.calculateTimeUsageStats(tasks),
        categories: this.calculateCategoryStats(tasks)
      };

      this.setData({
        chartData: chartData,
        isLoading: false,
        forceRefresh: false,
        hasData: true
      });

      wx.setStorageSync(cacheKey, chartData);
      setTimeout(() => this.renderCharts(), 400);
      
    } catch (error) {
      console.error('加载统计数据失败:', error);
      const sampleData = this.getSampleChartData();
      this.setData({ 
        isLoading: false,
        chartData: sampleData,
        hasData: true
      });
      setTimeout(() => this.renderCharts(), 300);
    }
  },

  // 获取任务数据 
  getRealTasksData: function() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const startDate = this.getStartDate();
      const openid = wx.getStorageSync('openid');
      
      if (!openid) {
        resolve([]);
        return;
      }

      // 使用正确的Task集合
      db.collection('Task')
        .where({
          _openid: openid,
          date: db.command.gte(startDate)
        })
        .get()
        .then(res => {
          console.log('Task集合查询结果:', res.data);
          resolve(res.data || []);
        })
        .catch(err => {
          console.warn('Task集合查询失败:', err);
          // 使用示例数据
          resolve(this.getSampleTasks());
        });
    });
  },

  // 获取示例任务数据
  getSampleTasks: function() {
    const sampleTasks = [
      {
        _id: '1',
        title: '完成项目报告',
        duration: 120,
        priority: '1',
        date: new Date().toISOString().split('T')[0],
        status: 'done'
      },
      {
        _id: '2', 
        title: '团队会议',
        duration: 60,
        priority: '2',
        date: new Date().toISOString().split('T')[0],
        status: 'done'
      },
      {
        _id: '3',
        title: '学习新技术',
        duration: 90,
        priority: '3',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending'
      },
      {
        _id: '4',
        title: '健身运动',
        duration: 45,
        priority: '4',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'done'
      },
      {
        _id: '5',
        title: '阅读书籍',
        duration: 30,
        priority: '5',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'done'
      }
    ];
    return sampleTasks;
  },

  // 计算完成率统计
  calculateCompletionStats: function(tasks) {
    if (!tasks || tasks.length === 0) {
      return this.getSampleChartData().completion;
    }

    const completedTasks = tasks.filter(task => task.status === 'done');
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks * 100).toFixed(1) : 0;

    return {
      completionRate: parseFloat(completionRate),
      completed: completedTasks.length,
      total: totalTasks,
      dailyProgress: this.calculateDailyProgress(tasks)
    };
  },

  // 计算时间使用统计
  calculateTimeUsageStats: function(tasks) {
    if (!tasks || tasks.length === 0) {
      return this.getSampleChartData().timeUsage;
    }

    const completedTasks = tasks.filter(task => task.status === 'done');
    const totalDuration = completedTasks.reduce((sum, task) => {
      return sum + (parseInt(task.duration) || 0);
    }, 0);

    const timeByCategory = {};
    completedTasks.forEach(task => {
      const priority = task.priority || 'default';
      const duration = parseInt(task.duration) || 0;
      timeByCategory[priority] = (timeByCategory[priority] || 0) + duration;
    });

    return {
      totalDuration: totalDuration,
      averageDuration: completedTasks.length > 0 ? (totalDuration / completedTasks.length).toFixed(1) : 0,
      timeByCategory: timeByCategory
    };
  },

  // 计算分类统计
  calculateCategoryStats: function(tasks) {
    if (!tasks || tasks.length === 0) {
      return this.getSampleChartData().categories;
    }

    const categories = {};
    
    tasks.forEach(task => {
      const priority = task.priority || 'default';
      if (!categories[priority]) {
        categories[priority] = { total: 0, completed: 0 };
      }
      categories[priority].total++;
      if (task.status === 'done') {
        categories[priority].completed++;
      }
    });

    return Object.keys(categories).map(priority => ({
      name: this.getPriorityName(priority),
      value: categories[priority].completed,
      total: categories[priority].total,
      completed: categories[priority].completed,
      rate: categories[priority].total > 0 ? 
        (categories[priority].completed / categories[priority].total * 100).toFixed(1) : 0
    }));
  },

  // 获取优先级名称
  getPriorityName: function(priority) {
    const names = {
      '1': '紧急重要',
      '2': '重要不紧急', 
      '3': '紧急不重要',
      '4': '常规任务',
      '5': '低优先级',
      'default': '未分类'
    };
    return names[priority] || priority;
  },

  // 获取开始日期
  getStartDate: function() {
    const now = new Date();
    if (this.data.selectedRange === 'week') {
      now.setDate(now.getDate() - 7);
    } else if (this.data.selectedRange === 'month') {
      now.setMonth(now.getMonth() - 1);
    } else if (this.data.selectedRange === 'year') {
      now.setFullYear(now.getFullYear() - 1);
    }
    return now.toISOString().split('T')[0];
  },

  // 计算每日进度
  calculateDailyProgress: function(tasks) {
    if (!tasks || tasks.length === 0) {
      const sampleProgress = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        sampleProgress.push({
          date: `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
          completed: Math.floor(Math.random() * 2) + 1,
          total: Math.floor(Math.random() * 3) + 2,
          rate: Math.floor(Math.random() * 40) + 30,
          fullDate: date.toISOString().split('T')[0]
        });
      }
      return sampleProgress;
    }

    const now = new Date();
    
    if (this.data.selectedRange === 'year') {
      return this.calculateMonthlyProgress(tasks);
    }
    
    const progressData = [];
    
    if (this.data.selectedRange === 'week') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayTasks = tasks.filter(task => task.date === dateStr);
        const completed = dayTasks.filter(task => task.status === 'done').length;
        const total = dayTasks.length;
        const rate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
        
        progressData.push({
          date: `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
          completed: completed,
          total: total,
          rate: parseFloat(rate),
          fullDate: dateStr
        });
      }
    }
    
    return progressData;
  },

  // 获取示例图表数据
  getSampleChartData: function() {
    const sampleProgress = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      sampleProgress.push({
        date: `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
        completed: Math.floor(Math.random() * 2) + 1,
        total: Math.floor(Math.random() * 3) + 2,
        rate: Math.floor(Math.random() * 40) + 30,
        fullDate: date.toISOString().split('T')[0]
      });
    }

    return {
      completion: { 
        completionRate: 33.3, 
        completed: 2, 
        total: 6, 
        dailyProgress: sampleProgress 
      },
      timeUsage: { 
        totalDuration: 135, 
        averageDuration: 67.5, 
        timeByCategory: {
          '1': 90,
          '2': 45
        }
      },
      categories: [
        { name: '紧急重要', value: 1, total: 2, completed: 1, rate: 50 },
        { name: '重要不紧急', value: 1, total: 3, completed: 1, rate: 33.3 },
        { name: '紧急不重要', value: 0, total: 1, completed: 0, rate: 0 }
      ]
    };
  },

  // 图表渲染方法
  renderCharts: function() {
    setTimeout(() => {
      this.renderCompletionChart();
    }, 100);
    
    setTimeout(() => {
      this.renderCategoryChart();
    }, 200);
    
    setTimeout(() => {
      this.renderTimeChart();
    }, 300);
  },

  // 渲染完成率图表 
  renderCompletionChart: function() {
    const ctx = wx.createCanvasContext('completionChart', this);
    const data = this.data.chartData.completion;
    
    if (!data || !data.dailyProgress || data.dailyProgress.length === 0) {
      this.renderEmptyState(ctx, 'completionChart', '暂无数据');
      return;
    }

    const { width, height } = this.getCanvasSize('completionChart');
    ctx.clearRect(0, 0, width, height);

    
    const chartScale = 0.5; // 缩小50%
    const chartWidth = width * chartScale;
    const chartHeight = height * chartScale * 0.6; // 高度额外缩小
    
    // 计算居中位置（置顶显示）
    const startX = (width - chartWidth) / 2;
    const startY = 20; // 置顶显示，离顶部20px

    const padding = 15;
    const innerWidth = chartWidth - padding * 2;
    const innerHeight = chartHeight - padding * 2;

    // 绘制坐标轴
    ctx.setStrokeStyle('#e0e0e0');
    ctx.setLineWidth(1);
    ctx.moveTo(startX + padding, startY + padding);
    ctx.lineTo(startX + padding, startY + padding + innerHeight);
    ctx.moveTo(startX + padding, startY + padding + innerHeight);
    ctx.lineTo(startX + padding + innerWidth, startY + padding + innerHeight);
    ctx.stroke();

    // Y轴标签 
    ctx.setFillStyle('#666');
    ctx.setFontSize(8);
    ctx.setTextAlign('right');
    for (let i = 0; i <= 5; i++) {
      const y = startY + padding + innerHeight - (i / 5) * innerHeight;
      ctx.fillText(i * 20 + '%', startX + padding - 4, y + 2);
    }

    // 绘制折线
    ctx.beginPath();
    ctx.setStrokeStyle('#1890ff');
    ctx.setLineWidth(1.5);

    data.dailyProgress.forEach((item, index) => {
      const x = startX + padding + (index / (data.dailyProgress.length - 1 || 1)) * innerWidth;
      const y = startY + padding + innerHeight - (item.rate / 100) * innerHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // 绘制数据点和标签
    data.dailyProgress.forEach((item, index) => {
      const x = startX + padding + (index / (data.dailyProgress.length - 1 || 1)) * innerWidth;
      const y = startY + padding + innerHeight - (item.rate / 100) * innerHeight;
      
      // 数据点 - 更小
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.setFillStyle('#1890ff');
      ctx.fill();

      // X轴标签 
      ctx.setFillStyle('#666');
      ctx.setFontSize(7);
      ctx.setTextAlign('center');
      
      let labelText = item.date;
      ctx.fillText(labelText, x, startY + padding + innerHeight + 10);
    });

    ctx.draw(true);
  },

  // 渲染分类图表 
  renderCategoryChart: function() {
    const ctx = wx.createCanvasContext('categoryChart', this);
    const data = this.data.chartData.categories;
    
    if (!data || data.length === 0) {
      this.renderEmptyState(ctx, 'categoryChart', '暂无数据');
      return;
    }

    const { width, height } = this.getCanvasSize('categoryChart');
    ctx.clearRect(0, 0, width, height);
    
    const chartScale = 0.5; // 缩小50%
    const centerX = width / 2;
    const centerY = height * 0.3; // 置顶显示
    const radius = Math.min(width, height) * 0.15 * chartScale; // 缩小半径
    
    let startAngle = 0;
    const colors = ['#ff4d4f', '#ffa940', '#ffec3d', '#73d13d', '#4096ff', '#9254de'];

    // 计算总数
    const total = data.reduce((sum, item) => sum + item.completed, 0);
    if (total === 0) {
      this.renderEmptyState(ctx, 'categoryChart', '暂无数据');
      return;
    }
    
    // 绘制饼图
    data.forEach((item, index) => {
      const angle = (item.completed / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.setFillStyle(colors[index % colors.length]);
      ctx.fill();
      startAngle += angle;
    });

    // 绘制图例 - 更小且居中下方
    const legendStartX = width * 0.2;
    const legendStartY = height * 0.6; // 图例放在下方
    const lineHeight = 16;

    data.forEach((item, index) => {
      const legendY = legendStartY + index * lineHeight;
      
      ctx.setFillStyle(colors[index % colors.length]);
      ctx.fillRect(legendStartX, legendY, 8, 8);
      
      ctx.setFillStyle('#333');
      ctx.setFontSize(8);
      ctx.setTextAlign('left');
      
      const legendText = `${item.name}(${item.completed})`;
      let displayText = legendText;
      if (legendText.length > 6) {
        displayText = legendText.substring(0, 5) + '..';
      }
      
      ctx.fillText(displayText, legendStartX + 10, legendY + 6);
    });

    ctx.draw(true);
  },

  // 渲染时间图表 
  renderTimeChart: function() {
    const ctx = wx.createCanvasContext('timeChart', this);
    const data = this.data.chartData.timeUsage;
    
    if (!data || !data.timeByCategory || Object.keys(data.timeByCategory).length === 0) {
      this.renderEmptyState(ctx, 'timeChart', '暂无数据');
      return;
    }

    const { width, height } = this.getCanvasSize('timeChart');
    ctx.clearRect(0, 0, width, height);
    
    const chartScale = 0.5; // 缩小50%
    const chartHeight = height * chartScale * 0.6; // 高度额外缩小
    const barWidth = 20 * chartScale;
    const spacing = 8 * chartScale;

    const categories = Object.keys(data.timeByCategory);
    const maxTime = Math.max(...Object.values(data.timeByCategory));
    const totalWidth = categories.length * (barWidth + spacing);
    const startX = (width - totalWidth) / 2; // 居中
    const startY = 30; // 置顶显示

    categories.forEach((category, index) => {
      const time = data.timeByCategory[category];
      const barHeight = maxTime > 0 ? (time / maxTime) * chartHeight : 6;
      const x = startX + index * (barWidth + spacing);
      const y = startY + chartHeight - barHeight;

      // 柱状图
      ctx.setFillStyle(this.getCategoryColor(category));
      ctx.fillRect(x, y, barWidth, barHeight);

      // 数值标签 
      ctx.setFillStyle('#333');
      ctx.setFontSize(7);
      ctx.setTextAlign('center');
      ctx.fillText(`${time}分钟`, x + barWidth / 2, y - 4);

      // 分类标签 
      ctx.setFillStyle('#666');
      ctx.setFontSize(7);
      const categoryName = this.getPriorityName(category);
      if (categoryName.length > 3) {
        const firstLine = categoryName.substring(0, 2);
        const secondLine = categoryName.substring(2);
        ctx.fillText(firstLine, x + barWidth / 2, startY + chartHeight + 8);
        ctx.fillText(secondLine, x + barWidth / 2, startY + chartHeight + 16);
      } else {
        ctx.fillText(categoryName, x + barWidth / 2, startY + chartHeight + 10);
      }
    });

    ctx.draw(true);
  },

  // 获取画布尺寸 
  getCanvasSize: function(canvasId) {
    const systemInfo = wx.getSystemInfoSync();
    const screenWidth = systemInfo.screenWidth;
    
    const containerWidth = screenWidth - 40;
    
    if (canvasId === 'completionChart') {
      return { 
        width: containerWidth, 
        height: 450  // 增加50%高度
      };
    } else if (canvasId === 'categoryChart') {
      return { 
        width: containerWidth, 
        height: 480  // 增加50%高度
      };
    } else {
      return { 
        width: containerWidth, 
        height: 420  // 增加50%高度
      };
    }
  },

  // 渲染空状态
  renderEmptyState: function(ctx, canvasId, message) {
    const { width, height } = this.getCanvasSize(canvasId);
    ctx.clearRect(0, 0, width, height);
    
    ctx.setFillStyle('#999');
    ctx.setFontSize(12);
    ctx.setTextAlign('center');
    ctx.fillText(message, width / 2, height / 2);
    ctx.draw(true);
  },

  // 获取分类颜色
  getCategoryColor: function(category) {
    const colors = {
      '1': '#ff4d4f', '2': '#ffa940', '3': '#ffec3d',
      '4': '#73d13d', '5': '#4096ff', 'default': '#d9d9d9'
    };
    return colors[category] || colors['default'];
  },

  // 时间范围切换
  onRangeChange: function(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ 
      selectedRange: range,
      forceRefresh: true
    });
    this.loadStatisticsData();
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadStatisticsData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 手动刷新数据
  onRefresh: function() {
    this.setData({
      forceRefresh: true
    });
    this.loadStatisticsData();
  }
});