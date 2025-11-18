// app.js
App({
  onLaunch: function () {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-2gxdt9mxad791de0',
      traceUser: true
    })
    
    // 检查登录状态
    this.checkLogin()
  },

  globalData: {
    userInfo: null,
    openid: null
  },

  // 检查登录状态
  checkLogin: function() {
    const that = this
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        console.log('登录成功', res)
        that.globalData.openid = res.result.openid
        that.globalData.userInfo = res.result.userInfo
        
        // 关键修复：将登录状态同步到本地存储
        wx.setStorageSync('openid', res.result.openid)
        wx.setStorageSync('userInfo', res.result.userInfo)
        console.log('登录状态已保存到本地存储')
      },
      fail: err => {
        console.error('登录失败', err)
        // 即使登录失败，也尝试从本地存储恢复
        const cachedOpenid = wx.getStorageSync('openid')
        const cachedUserInfo = wx.getStorageSync('userInfo')
        if (cachedOpenid) {
          that.globalData.openid = cachedOpenid
          that.globalData.userInfo = cachedUserInfo
          console.log('从本地存储恢复登录状态')
        }
      }
    })
  }
})