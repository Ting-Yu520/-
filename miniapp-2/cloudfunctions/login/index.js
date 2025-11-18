// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  try {
    // 检查用户是否存在
    const userRes = await db.collection('User').where({
      _openid: wxContext.OPENID
    }).get()
    
    let userInfo = event.userInfo || {}
    
    if (userRes.data.length === 0) {
      // 新用户，创建记录
      await db.collection('User').add({
        data: {
          _openid: wxContext.OPENID,
          nickname: userInfo.nickName || '微信用户',
          avatarUrl: userInfo.avatarUrl || '',
          preferences: {
            workStartTime: "09:00",
            workEndTime: "18:00", 
            breakTime: 30
          },
          created_at: db.serverDate()
        }
      })
      console.log('新用户注册成功')
    } else {
      console.log('老用户登录')
      // 更新用户信息（如果有的话）
      if (userInfo.nickName) {
        await db.collection('User').doc(userRes.data[0]._id).update({
          data: {
            nickname: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl || userRes.data[0].avatarUrl
          }
        })
      }
    }
    
    return {
      openid: wxContext.OPENID,
      userInfo: userInfo
    }
    
  } catch (err) {
    console.error('登录失败:', err)
    return {
      error: err
    }
  }
}