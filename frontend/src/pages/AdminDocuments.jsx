import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Search,
  Trash2,
  RefreshCw,
  Upload,
  Eye,
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Filter,
} from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function getMimeLabel(mime) {
  const map = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
  }
  if (mime?.startsWith('image/')) return 'IMAGE'
  return map[mime] || 'FILE'
}

const badgeColor = {
  PDF: 'badge-error', DOCX: 'badge-info', DOC: 'badge-info',
  XLSX: 'badge-success', XLS: 'badge-success', IMAGE: 'badge-warning',
}

export default function AdminDocuments() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [message, setMessage] = useState(null)
  const [showReplace, setShowReplace] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const replaceInputRef = useRef(null)

  useEffect(() => { fetchDocs() }, [])

  async function fetchDocs() {
    setLoading(true)
    try {
      const { data } = await api.get('/documents/admin/all')
      setDocs(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const filtered = docs.filter(d =>
    !search || d.original_filename.toLowerCase().includes(search.toLowerCase()) ||
    (d.owner_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.owner_email || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.original_filename}"? This cannot be undone.`)) return
    setActionLoading(doc.id)
    try {
      await api.delete(`/documents/admin/${doc.id}`)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      setMessage({ type: 'success', text: `Deleted "${doc.original_filename}"` })
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete document' })
    }
    setActionLoading(null)
    setTimeout(() => setMessage(null), 3000)
  }

  async function handleReprocess(doc) {
    setActionLoading(`reprocess-${doc.id}`)
    try {
      await api.post(`/documents/reprocess/${doc.id}`)
      setMessage({ type: 'success', text: `Reprocessed "${doc.original_filename}"` })
    } catch {
      setMessage({ type: 'error', text: 'Failed to reprocess document' })
    }
    setActionLoading(null)
    setTimeout(() => setMessage(null), 3000)
  }

  async function handleReplace(doc) {
    const file = replaceInputRef.current?.files?.[0]
    if (!file) return
    setReplacing(true)
    setShowReplace(false)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post(`/documents/replace/${doc.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setMessage({ type: 'success', text: `Replaced "${doc.original_filename}"` })
      fetchDocs()
    } catch {
      setMessage({ type: 'error', text: 'Failed to replace document' })
    }
    setReplacing(false)
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Document Management</h1>
          <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">
            Manage all uploaded documents across users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDocs} className="btn-ghost p-2" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link to="/upload" className="btn-primary text-sm">
            <Upload className="w-4 h-4" />
            Upload
          </Link>
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-800/30 text-red-700 dark:text-red-300'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by filename or owner..."
          className="input-field pl-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Document table */}
      {loading ? (
        <LoadingSpinner text="Loading documents..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No matching documents' : 'No documents uploaded'}
          description={search ? 'Try a different search term' : 'Documents will appear here once users upload them.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-700/50">
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4">Filename</th>
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden md:table-cell">Owner</th>
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden sm:table-cell">Size</th>
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden lg:table-cell">Type</th>
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden lg:table-cell">Uploaded</th>
                  <th className="text-right px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
                {filtered.map((doc, i) => {
                  const label = getMimeLabel(doc.mime_type)
                  return (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-700/50 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-surface-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-surface-900 dark:text-surface-100 truncate max-w-[200px]">
                              {doc.original_filename}
                            </p>
                            <span className="md:hidden text-xs text-surface-400">{doc.owner_name || doc.owner_email || `User #${doc.user_id}`}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-surface-500 dark:text-surface-400 hidden md:table-cell">
                        <div>
                          <p className="truncate max-w-[150px]">{doc.owner_name || '-'}</p>
                          <p className="text-xs text-surface-400 truncate max-w-[150px]">{doc.owner_email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-surface-500 dark:text-surface-400 hidden sm:table-cell">{formatSize(doc.file_size)}</td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className={badgeColor[label] || 'badge-info'}>{label}</span>
                      </td>
                      <td className="px-5 py-4 text-surface-500 dark:text-surface-400 text-xs hidden lg:table-cell">{formatDate(doc.uploaded_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/view/${doc.id}`} className="btn-ghost p-2" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => { setSelectedDoc(doc); setShowReplace(true) }}
                            className="btn-ghost p-2"
                            title="Replace"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReprocess(doc)}
                            disabled={actionLoading === `reprocess-${doc.id}`}
                            className="btn-ghost p-2"
                            title="Reprocess"
                          >
                            {actionLoading === `reprocess-${doc.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={actionLoading === doc.id}
                            className="btn-ghost p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Delete"
                          >
                            {actionLoading === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-surface-100 dark:border-surface-700/50 text-xs text-surface-400">
            {filtered.length} of {docs.length} document{docs.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Replace modal */}
      <AnimatePresence>
        {showReplace && selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowReplace(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Replace Document</h3>
                <button onClick={() => setShowReplace(false)} className="btn-ghost p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                Replace <span className="font-medium text-surface-700 dark:text-surface-200">{selectedDoc.original_filename}</span>
              </p>
              <input
                ref={replaceInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff"
                className="input-field mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowReplace(false)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => handleReplace(selectedDoc)}
                  disabled={replacing}
                  className="btn-primary"
                >
                  {replacing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload & Replace'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
