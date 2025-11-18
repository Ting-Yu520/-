// utils/animation.js
class TaskAnimation {
  static createFadeInAnimation() {
    return wx.createAnimation({
      duration: 400,
      timingFunction: 'ease-out',
      delay: 0
    })
  }

  static createStaggerAnimation() {
    return wx.createAnimation({
      duration: 300,
      timingFunction: 'ease-out',
      delay: 0
    })
  }

  // 渐入动画
  static fadeIn(element, delay = 0) {
    const animation = this.createFadeInAnimation()
    animation.opacity(0).step()
    animation.opacity(1).step({ delay })
    return animation
  }

  // 滑动进入动画
  static slideInFromRight(element, delay = 0) {
    const animation = this.createFadeInAnimation()
    animation.translateX(50).opacity(0).step()
    animation.translateX(0).opacity(1).step({ delay })
    return animation
  }
}

module.exports = TaskAnimation