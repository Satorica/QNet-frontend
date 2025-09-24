import axios from 'axios'

// 创建 axios 实例
const api = axios.create({
  baseURL: 'http://127.0.0.1:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    console.log('发送请求:', config.method?.toUpperCase(), config.url)
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    console.log('收到响应:', response.status, response.config.url)
    return response
  },
  error => {
    console.error('响应错误:', error.response?.status, error.response?.data?.message || error.message)
    return Promise.reject(error)
  }
)

// API 方法
export const submitTask = async (taskData) => {
  try {
    const response = await api.post('/submit-task', taskData)
    return response.data
  } catch (error) {
    throw error
  }
}

export const getTaskStatus = async (taskId) => {
  try {
    const response = await api.get(`/task-status/${taskId}`)
    return response.data
  } catch (error) {
    throw error
  }
}

export const cancelTask = async (taskId) => {
  try {
    const response = await api.post(`/cancel-task/${taskId}`)
    return response.data
  } catch (error) {
    throw error
  }
}

export default api 