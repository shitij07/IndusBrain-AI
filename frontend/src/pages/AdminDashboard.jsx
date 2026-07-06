import { useState, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [adminMessage, setAdminMessage] = useState('')

  useEffect(() => {
    api.get('/auth/admin')
      .then((res) => setAdminMessage(res.data.message))
      .catch(() => setAdminMessage('Failed to load admin data'))
  }, [])

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="bg-white shadow rounded-lg px-8 py-6">
        <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
        {adminMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {adminMessage}
          </div>
        )}
        <div className="space-y-2 text-gray-700">
          <p><span className="font-semibold">Name:</span> {user.full_name}</p>
          <p><span className="font-semibold">Email:</span> {user.email}</p>
          <p><span className="font-semibold">Role:</span> <span className="capitalize">{user.role}</span></p>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
            Logout
          </button>
          <a href="/dashboard" className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition inline-block">
            User Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
