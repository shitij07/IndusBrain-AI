import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  },
)

export async function askQuestion(question) {
  const { data } = await api.post('/chat', { question })
  return data
}

export async function getChatHistory() {
  const { data } = await api.get('/chat/history')
  return data
}

export default api
