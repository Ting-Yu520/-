// cloudfunctions/callDeepSeek/index.js - 完全本地智能回复版本
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event) => {
  const { userMessage, taskInfo, conversationHistory } = event
  
  try {
    console.log('使用本地智能回复引擎...')
    console.log('用户消息:', userMessage)
    console.log('任务信息:', taskInfo)
    
    // 使用内置的智能回复逻辑
    const response = generateSmartResponse(userMessage, taskInfo, conversationHistory)
    
    console.log('生成的回复:', response)
    
    return {
      success: true,
      response: response.content,
      schedule: response.schedule
    }
    
  } catch (error) {
    console.error('本地回复失败:', error)
    
    const fallbackResponse = generateFallbackResponse(taskInfo, userMessage)
    
    return {
      success: false,
      error: error.message,
      response: fallbackResponse
    }
  }
}

// 生成智能回复
function generateSmartResponse(userMessage, taskInfo, conversationHistory) {
  const lowerMessage = userMessage.toLowerCase()
  const { title, duration, priority, date } = taskInfo
  
  console.log('分析用户消息:', lowerMessage)
  
  // 基于规则生成智能回复
  if (lowerMessage.includes('上午') || lowerMessage.includes('早上') || lowerMessage.includes('早晨')) {
    const schedule = calculateSchedule('09:30', duration)
    return {
      content: `好的，我已经将"${title}"调整到上午${schedule.scheduled_start}开始。上午时段头脑清醒，空气质量好，适合需要高度专注的任务。建议您可以先做一些简单的热身运动，然后开始这个${duration}分钟的任务。`,
      schedule: schedule
    }
  } else if (lowerMessage.includes('下午') || lowerMessage.includes('中午')) {
    const schedule = calculateSchedule('14:00', duration)
    return {
      content: `好的，我已经将"${title}"安排到下午${schedule.scheduled_start}开始。下午时段人体体温较高，新陈代谢旺盛，是处理重要任务的黄金时间。这个${duration}分钟的任务在这个时间段完成效率会很高。`,
      schedule: schedule
    }
  } else if (lowerMessage.includes('晚上') || lowerMessage.includes('傍晚') || lowerMessage.includes('夜间')) {
    const schedule = calculateSchedule('19:00', duration)
    return {
      content: `好的，我已经将"${title}"安排到晚上${schedule.scheduled_start}开始。晚上环境相对安静，干扰较少，适合需要深度思考的任务。请注意合理安排休息时间，避免影响睡眠质量。`,
      schedule: schedule
    }
  } else if (lowerMessage.includes('缩短') || lowerMessage.includes('减少') || lowerMessage.includes('快点')) {
    const newDuration = Math.max(15, duration - 30)
    const schedule = calculateSchedule('09:00', newDuration)
    return {
      content: `好的，我已经将"${title}"的时长从${duration}分钟调整为${newDuration}分钟。调整后的时间是${schedule.scheduled_start}-${schedule.scheduled_end}。建议您可以提高专注度，或者将任务分解为更小的步骤来提高效率。`,
      schedule: schedule
    }
  } else if (lowerMessage.includes('延长') || lowerMessage.includes('增加') || lowerMessage.includes('多点时间')) {
    const newDuration = duration + 30
    const schedule = calculateSchedule('09:00', newDuration)
    return {
      content: `好的，我已经将"${title}"的时长从${duration}分钟调整为${newDuration}分钟。调整后的时间是${schedule.scheduled_start}-${schedule.scheduled_end}。这样您就有更充足的时间来深入处理这个任务，可以安排适当的休息间隔。`,
      schedule: schedule
    }
  } else if (lowerMessage.includes('谢谢') || lowerMessage.includes('感谢') || lowerMessage.includes('好的')) {
    return {
      content: `不客气！很高兴能帮您安排"${title}"这个任务。如果您后续还需要调整日程，随时告诉我。祝您任务顺利完成！`,
      schedule: null
    }
  } else if (lowerMessage.includes('你好') || lowerMessage.includes('您好') || lowerMessage.includes('在吗')) {
    return {
      content: `您好！我是您的AI日程助理，很高兴为您服务。关于"${title}"这个${duration}分钟的任务，您希望如何调整呢？`,
      schedule: null
    }
  } else if (lowerMessage.includes('建议') || lowerMessage.includes('推荐') || lowerMessage.includes('什么时间')) {
    // 根据任务类型和优先级给出智能建议
    const suggestion = getTimeSuggestion(taskInfo)
    return {
      content: suggestion.content,
      schedule: suggestion.schedule
    }
  } else {
    // 默认回复，提供多个选择
    const morningSchedule = calculateSchedule('09:00', duration)
    const afternoonSchedule = calculateSchedule('14:00', duration)
    const eveningSchedule = calculateSchedule('19:00', duration)
    
    return {
      content: `我理解您想要调整"${title}"的日程安排。基于这个${duration}分钟的任务，我有几个建议：

🕘 上午 ${morningSchedule.scheduled_start}-${morningSchedule.scheduled_end} - 头脑清醒，适合专注任务
🕑 下午 ${afternoonSchedule.scheduled_start}-${afternoonSchedule.scheduled_end} - 精力充沛，效率高峰  
🕖 晚上 ${eveningSchedule.scheduled_start}-${eveningSchedule.scheduled_end} - 环境安静，干扰较少

您希望选择哪个时间段？或者告诉我您具体想要的时间。`,
      schedule: null
    }
  }
}

// 根据任务信息给出智能时间建议
function getTimeSuggestion(taskInfo) {
  const { title, duration, priority } = taskInfo
  
  let suggestedTime = '09:00'
  let reason = ''
  
  // 基于任务类型和优先级智能推荐时间
  if (priority >= 4) {
    suggestedTime = '14:00' // 高优先级安排在下午精力高峰
    reason = '这个时间段是精力和注意力的高峰期，适合处理重要任务'
  } else if (title.includes('学习') || title.includes('阅读') || title.includes('写作')) {
    suggestedTime = '09:30' // 学习类任务安排在上午
    reason = '上午头脑清醒，记忆力和理解力较好，适合学习任务'
  } else if (title.includes('运动') || title.includes('锻炼') || title.includes('健身')) {
    suggestedTime = '18:00' // 运动安排在傍晚
    reason = '傍晚体温较高，肌肉柔韧性好，运动效果更佳'
  } else if (title.includes('会议') || title.includes('讨论') || title.includes('沟通')) {
    suggestedTime = '10:00' // 会议安排在上午中段
    reason = '这个时间段大家注意力都比较集中，适合沟通讨论'
  } else if (title.includes('创意') || title.includes('设计') || title.includes('思考')) {
    suggestedTime = '15:00' // 创意工作安排在下午
    reason = '下午思维较为发散，适合需要创意和灵感的工作'
  }
  
  const schedule = calculateSchedule(suggestedTime, duration)
  
  return {
    content: `基于"${title}"这个任务的特点，我建议安排在${suggestedTime}开始。${reason}。您觉得${schedule.scheduled_start}-${schedule.scheduled_end}这个时间段怎么样？`,
    schedule: schedule
  }
}

// 计算日程时间
function calculateSchedule(startTime, duration) {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + parseInt(duration)
  const endHours = Math.floor(totalMinutes / 60)
  const endMinutes = totalMinutes % 60
  const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  
  return {
    scheduled_start: startTime,
    scheduled_end: endTime
  }
}

// 生成备用回复
function generateFallbackResponse(taskInfo, userMessage) {
  return `我理解您想要调整"${taskInfo.title}"的日程安排。基于这个${taskInfo.duration}分钟的任务，我建议您可以考虑在上午09:00-10:30或下午14:00-15:30时间段进行。您希望安排在哪个时间段呢？`
}