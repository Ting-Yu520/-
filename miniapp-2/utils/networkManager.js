// utils/networkManager.js
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
          await this.delay(1000 * retryCount) // 指数退避
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

module.exports = NetworkManager