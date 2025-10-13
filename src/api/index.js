import axios from 'axios'

// 服务器配置
const SERVERS = {
  cloud: {
    baseURL: 'http://47.99.240.72:8085/api',
    name: '云服务器',
    type: 'cloud'
  },
  local: {
    baseURL: 'http://47.99.240.72:5000/api',
    name: '本地服务器',
    type: 'local'
  }
}

// 创建云服务器 axios 实例
const cloudApi = axios.create({
  baseURL: SERVERS.cloud.baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 创建本地服务器 axios 实例
const localApi = axios.create({
  baseURL: SERVERS.local.baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 服务器状态
let serverStatus = {
  cloud: { online: true, lastCheck: 0 },
  local: { online: true, lastCheck: 0 }
}

// 请求拦截器 - 云服务器
cloudApi.interceptors.request.use(
  config => {
    console.log('发送请求到云服务器:', config.method?.toUpperCase(), config.url)
    return config
  },
  error => {
    console.error('云服务器请求错误:', error)
    return Promise.reject(error)
  }
)

// 请求拦截器 - 本地服务器
localApi.interceptors.request.use(
  config => {
    console.log('发送请求到本地服务器:', config.method?.toUpperCase(), config.url)
    return config
  },
  error => {
    console.error('本地服务器请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器 - 云服务器
cloudApi.interceptors.response.use(
  response => {
    console.log('收到云服务器响应:', response.status, response.config.url)
    serverStatus.cloud.online = true
    serverStatus.cloud.lastCheck = Date.now()
    return response
  },
  error => {
    console.error('云服务器响应错误:', error.response?.status, error.response?.data?.message || error.message)
    serverStatus.cloud.online = false
    serverStatus.cloud.lastCheck = Date.now()
    return Promise.reject(error)
  }
)

// 响应拦截器 - 本地服务器
localApi.interceptors.response.use(
  response => {
    console.log('收到本地服务器响应:', response.status, response.config.url)
    serverStatus.local.online = true
    serverStatus.local.lastCheck = Date.now()
    return response
  },
  error => {
    console.error('本地服务器响应错误:', error.response?.status, error.response?.data?.message || error.message)
    serverStatus.local.online = false
    serverStatus.local.lastCheck = Date.now()
    return Promise.reject(error)
  }
)

// 检查服务器状态
export const checkServerStatus = async () => {
  const status = { cloud: false, local: false }

  try {
    const cloudResponse = await cloudApi.get('/server-status')
    status.cloud = cloudResponse.data.success
  } catch (error) {
    console.warn('云服务器不可用:', error.message)
    status.cloud = false
  }

  try {
    const localResponse = await localApi.get('/server-info')
    status.local = localResponse.data.success
  } catch (error) {
    console.warn('本地服务器不可用:', error.message)
    status.local = false
  }

  serverStatus.cloud.online = status.cloud
  serverStatus.local.online = status.local
  serverStatus.cloud.lastCheck = Date.now()
  serverStatus.local.lastCheck = Date.now()

  return status
}

// 智能提交任务 - 优先使用云服务器进行队列管理
export const submitTask = async (taskData) => {
  try {
    // 首先尝试云服务器（推荐方式）
    if (serverStatus.cloud.online) {
      console.log('使用云服务器提交任务')
      const response = await cloudApi.post('/submit-task', taskData)
      return {
        ...response.data,
        serverType: 'cloud',
        usePolling: true // 云服务器需要轮询状态
      }
    }

    // 云服务器不可用时，直接使用本地服务器
    if (serverStatus.local.online) {
      console.log('云服务器不可用，直接使用本地服务器')
      const response = await localApi.post('/submit-task', taskData)
      return {
        ...response.data,
        serverType: 'local',
        usePolling: false // 本地服务器直接返回结果
      }
    }

    throw new Error('所有服务器都不可用')
  } catch (error) {
    // 如果云服务器失败，尝试本地服务器
    if (error.message.includes('云服务器') || error.code === 'ECONNREFUSED') {
      try {
        console.log('云服务器失败，尝试本地服务器')
        const response = await localApi.post('/submit-task', taskData)
        return {
          ...response.data,
          serverType: 'local',
          usePolling: false
        }
      } catch (localError) {
        throw new Error('所有服务器都不可用')
      }
    }
    throw error
  }
}

// 获取任务状态（仅用于云服务器）
export const getTaskStatus = async (taskId) => {
  try {
    const response = await cloudApi.get(`/task-status/${taskId}`)
    return response.data
  } catch (error) {
    throw error
  }
}

// 取消任务（仅用于云服务器）
export const cancelTask = async (taskId) => {
  try {
    const response = await cloudApi.post(`/cancel-task/${taskId}`)
    return response.data
  } catch (error) {
    throw error
  }
}

// 获取服务器状态信息
export const getServerStatus = () => {
  return { ...serverStatus }
}

// 导出API实例以备直接使用
export { cloudApi, localApi }
export default cloudApi 