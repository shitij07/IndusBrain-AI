import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  HardDrive,
  ShieldCheck,
  MessageSquareText,
  Upload,
  Sparkles,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import StatCard from '../components/StatCard'
import { PageSkeleton } from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) return 'Today'
    return `${hours}h ago`
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getMimeLabel(mime) {
  if (!mime) return 'UNKNOWN'
  const map = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
  }
  if (mime.startsWith('image/')) return 'IMAGE'
  return map[mime] || mime.split('/').pop().toUpperCase()
}

const mimeBadge = {
  PDF: 'badge-error',
  DOCX: 'badge-info',
  DOC: 'badge-info',
  XLSX: 'badge-success',
  XLS: 'badge-success',
  IMAGE: 'badge-warning',
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/documents')
      .then(({ data }) => setDocs(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalSize = docs.reduce((sum, d) => sum + d.file_size, 0)
  const totalMB = (totalSize / (1024 * 1024)).toFixed(1)
  const storageLimitMB = 50
  const storagePct = Math.min((totalSize / (storageLimitMB * 1024 * 1024)) * 100, 100)

  const stats = [
    { label: 'Total Documents', value: docs.length.toString(), icon: FileText, color: 'blue' },
    { label: 'Storage Used', value: totalMB, icon: HardDrive, color: 'emerald', suffix: 'MB' },
    { label: 'Compliance Score', value: '94%', icon: ShieldCheck, color: 'violet' },
    { label: 'AI Queries', value: '18,492', icon: MessageSquareText, color: 'amber' },
  ]

  const recentDocs = docs.slice(0, 5)

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Operations Dashboard
          </h1>
          <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">
            Plant overview for <span className="font-medium text-surface-700 dark:text-surface-300">{user.full_name}</span>
          </p>
        </div>
        {isAdmin && (
          <Link to="/upload" className="btn-primary hidden sm:flex">
            <Upload className="w-4 h-4" />
            Upload Asset File
          </Link>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} {...stat} index={i} />
        ))}
      </div>

      {/* Storage bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
            <HardDrive className="w-4 h-4 text-surface-400 dark:text-surface-500" />
            <span className="font-medium">Storage Usage</span>
          </div>
          <span className="text-xs font-mono text-surface-500 dark:text-surface-400">{totalMB} MB / {storageLimitMB} MB</span>
        </div>
        <div className="w-full h-2 bg-surface-100 dark:bg-surface-700/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${storagePct}%` }}
            transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full transition-colors duration-500 ${
              storagePct > 90 ? 'bg-red-500' : storagePct > 70 ? 'bg-amber-500' : 'bg-amber-500'
            }`}
          />
        </div>
      </motion.div>

      {/* Recent uploads + Quick overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent uploads */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-surface-400 dark:text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Recent Asset Documents</h2>
            </div>
            {docs.length > 0 && (
              <span className="text-[11px] font-mono text-surface-400 dark:text-surface-500">{docs.length} total</span>
            )}
          </div>

          {docs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No asset documents indexed"
              description={isAdmin ? "Upload P&amp;IDs, inspection reports, or maintenance records to begin AI-powered analysis." : "No documents available. Ask questions in Copilot or explore the Asset Graph."}
              action={isAdmin ? (
                <Link to="/upload" className="btn-primary text-sm">
                  <Upload className="w-4 h-4" />
                  Upload Asset File
                </Link>
              ) : undefined}
            />
          ) : (
            <div className="space-y-1">
              {recentDocs.map((doc, i) => {
                const label = getMimeLabel(doc.mime_type)
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 p-2.5 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-700/50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20 transition-colors">
                      <FileText className="w-4 h-4 text-surface-400 dark:text-surface-500 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{doc.original_filename}</p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">{formatSize(doc.file_size)} &middot; {formatDate(doc.uploaded_at)}</p>
                    </div>
                    <span className={`${mimeBadge[label] || 'badge-info'} flex-shrink-0`}>{label}</span>
                    <Link
                      to={`/view/${doc.id}`}
                      className="btn-ghost text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Quick overview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Site Overview</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-surface-400 dark:text-surface-500 font-mono text-[11px] uppercase tracking-wide">Storage</span>
                <span className="font-medium text-surface-700 dark:text-surface-200 font-mono text-xs">{totalMB} / {storageLimitMB} MB</span>
              </div>
              <div className="w-full h-1.5 bg-surface-100 dark:bg-surface-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    storagePct > 90 ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>

            <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
              {[
                { label: 'Asset Files', value: docs.length },
                { label: 'Team Members', value: '12' },
                { label: 'Storage Capacity', value: `${storageLimitMB} MB` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-surface-400 dark:text-surface-500">{item.label}</span>
                  <span className="font-medium text-surface-700 dark:text-surface-200 font-mono">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-surface-100 dark:border-surface-700/50">
              <p className="data-label mb-1">Account</p>
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100 capitalize">{user.role}</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 truncate font-mono">{user.email}</p>
            </div>

            <Link
              to="/chat"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-amber-500 text-surface-950 text-sm font-medium hover:bg-amber-600 transition-all duration-200 shadow-lg shadow-amber-500/20"
            >
              <MessageSquareText className="w-4 h-4" />
              Open Copilot
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
