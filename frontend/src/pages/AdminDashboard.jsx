import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Users, Activity, LogOut, FileText, Loader2 } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [adminMessage, setAdminMessage] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    api.get('/auth/admin')
      .then((res) => setAdminMessage(res.data.message))
      .catch(() => setAdminMessage('Failed to load admin data'))
      .finally(() => setLoading(false))

    api.get('/auth/users')
      .then((res) => setUsers(res.data))
      .catch(() => {})
  }, [])

  async function toggleRole(u) {
    if (u.id === user.id) return
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    setActionLoading(`role-${u.id}`)
    try {
      await api.put(`/auth/users/${u.id}/role`, { role: newRole })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function toggleActive(u) {
    if (u.id === user.id) return
    const newActive = !u.is_active
    setActionLoading(`active-${u.id}`)
    try {
      await api.put(`/auth/users/${u.id}/deactivate`, { is_active: newActive })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: newActive } : x))
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  if (loading) return <LoadingSpinner text="Loading admin panel..." />

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Admin Dashboard</h1>
        <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">Manage your platform, users, and documents.</p>
      </motion.div>

      {adminMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700 font-medium"
        >
          <ShieldCheck className="w-4 h-4" />
          {adminMessage}
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Total Users" value={users.length.toString()} icon={Users} color="blue" index={0} />
        <StatCard label="Admins" value={users.filter(u => u.role === 'admin').length.toString()} icon={ShieldCheck} color="violet" index={1} />
        <StatCard label="Active Users" value={users.filter(u => u.is_active).length.toString()} icon={Activity} color="emerald" index={2} />
      </div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-3"
      >
        <Link to="/admin/documents" className="btn-primary">
          <FileText className="w-4 h-4" />
          Manage Documents
        </Link>
      </motion.div>

      {/* User list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card overflow-hidden"
      >
        <div className="p-5 pb-0">
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100">Registered Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-700/50">
                <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4">Name</th>
                <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4">Email</th>
                <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4">Role</th>
                <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4">Status</th>
                <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden md:table-cell">Joined</th>
                <th className="text-right px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
              {users.map((u, i) => {
                const isSelf = u.id === user.id
                const roleLoading = actionLoading === `role-${u.id}`
                const activeLoading = actionLoading === `active-${u.id}`
                return (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-surface-900 dark:text-surface-100">
                      {u.full_name}
                      {isSelf && <span className="text-xs text-surface-400 ml-2">(you)</span>}
                    </td>
                    <td className="px-5 py-3.5 text-surface-500 dark:text-surface-400">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`badge capitalize ${u.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-error'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-surface-400 dark:text-surface-500 text-xs hidden md:table-cell">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {!isSelf && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleRole(u)}
                            disabled={roleLoading}
                            className="btn-ghost text-xs px-2 py-1"
                            title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          >
                            {roleLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : u.role === 'admin' ? (
                              'Demote'
                            ) : (
                              'Promote'
                            )}
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={activeLoading}
                            className={`btn-ghost text-xs px-2 py-1 ${u.is_active ? 'text-red-500' : 'text-emerald-500'}`}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {activeLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : u.is_active ? (
                              'Deactivate'
                            ) : (
                              'Activate'
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-3"
      >
        <button onClick={logout} className="btn-secondary text-red-500 border-red-200 hover:bg-red-50">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
        <Link to="/dashboard" className="btn-secondary">
          User Dashboard
        </Link>
      </motion.div>
    </div>
  )
}
