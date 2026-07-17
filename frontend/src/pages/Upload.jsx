import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload as UploadIcon,
  FileText,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileSpreadsheet,
  FileImage,
  File,
} from 'lucide-react'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'

const ACCEPTED = '.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getFileIcon(mime) {
  if (mime === 'application/pdf') return FileText
  if (mime.startsWith('image/')) return FileImage
  if (mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet
  return File
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
  PDF: 'badge-error',
  DOCX: 'badge-info',
  DOC: 'badge-info',
  XLSX: 'badge-success',
  XLS: 'badge-success',
  IMAGE: 'badge-warning',
}

export default function Upload() {
  const { isAdmin } = useAuth()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileQueue, setFileQueue] = useState([])
  const [docs, setDocs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => { fetchDocs() }, [])

  async function fetchDocs() {
    try {
      const { data } = await api.get('/documents')
      setDocs(data)
    } catch { /* ignore */ }
  }

  function onDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  async function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    await uploadFiles(Array.from(e.dataTransfer.files))
  }

  async function onInputChange(e) {
    await uploadFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  async function uploadFiles(fileList) {
    setError('')
    const allowed = fileList.filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase()
      return ACCEPTED.includes(ext)
    })
    if (!allowed.length) {
      setError('Only PDF, DOCX, Excel, and image files are allowed.')
      return
    }

    setUploading(true)
    for (const file of allowed) {
      const id = Date.now() + Math.random()
      setFileQueue(prev => [...prev, { id, name: file.name, status: 'uploading', progress: 0 }])

      const form = new FormData()
      form.append('file', file)
      try {
        await api.post('/documents/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setFileQueue(prev => prev.map(f => f.id === id ? { ...f, progress: pct } : f))
            }
          },
        })
        setFileQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'done', progress: 100 } : f))
      } catch {
        setFileQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'error' } : f))
      }
    }
    setUploading(false)
    setTimeout(() => setFileQueue([]), 4000)
    fetchDocs()
  }

  async function downloadDoc(doc) {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.original_filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  async function deleteDoc(id) {
    try {
      await api.delete(`/documents/${id}`)
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Documents</h1>
        <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">Browse all uploaded documents.</p>
      </motion.div>

      {/* Drop zone — admin only */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${
              dragging
                ? 'border-brand-500 dark:border-brand-400 bg-brand-50/50 dark:bg-brand-900/20 scale-[1.01]'
                : 'border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-surface-50/50 dark:hover:bg-surface-700/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              onChange={onInputChange}
              className="hidden"
            />

            <AnimatePresence mode="wait">
              {dragging ? (
                <motion.div
                  key="dragging"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center mx-auto">
                    <UploadIcon className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                  </div>
                  <p className="text-lg font-semibold text-brand-600 dark:text-brand-400">Drop files here</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-700/50 flex items-center justify-center mx-auto group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 transition-colors">
                    <UploadIcon className="w-8 h-8 text-surface-400 dark:text-surface-500" strokeWidth={1.5} />
                  </div>
                  <p className="text-base font-medium text-surface-700 dark:text-surface-200">
                    Drag & drop files here, or <span className="text-brand-600 dark:text-brand-400">browse</span>
                  </p>
                  <p className="text-sm text-surface-400 dark:text-surface-500">
                    PDF &middot; DOCX &middot; Excel &middot; Images
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {isAdmin && error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800/30 text-sm text-red-600 dark:text-red-400 font-medium"
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}

      {/* Upload queue — admin only */}
      {isAdmin && <AnimatePresence>
        {fileQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card p-5"
          >
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">Upload Queue</h3>
            <div className="space-y-3">
              {fileQueue.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    f.status === 'done' ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                    f.status === 'error' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-brand-100 dark:bg-brand-900/40'
                  }`}>
                    {f.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : f.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    ) : uploading ? (
                      <Loader2 className="w-4 h-4 text-brand-600 dark:text-brand-400 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 text-surface-400 dark:text-surface-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-200 truncate">{f.name}</p>
                    <div className="w-full h-1.5 bg-surface-100 dark:bg-surface-700/50 rounded-full mt-1 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${f.progress || (f.status === 'done' ? 100 : f.status === 'error' ? 100 : 0)}%` }}
                        className={`h-full rounded-full ${
                          f.status === 'done' ? 'bg-emerald-500' :
                          f.status === 'error' ? 'bg-red-500' : 'bg-brand-500'
                        }`}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-medium flex-shrink-0 ${
                    f.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' :
                    f.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'
                  }`}>
                    {f.status === 'done' ? 'Done' : f.status === 'error' ? 'Failed' : `${f.progress}%`}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>}

      {/* Document list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card overflow-hidden"
      >
        <div className="p-5 pb-0">
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100">Your Documents</h2>
        </div>

        {docs.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={FileText}
              title="No documents uploaded"
              description="Upload a PDF, DOCX, Excel, or image file to get started."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-700/50">
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4">Name</th>
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden sm:table-cell">Size</th>
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden md:table-cell">Type</th>
                  <th className="text-left text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider px-5 py-4 hidden lg:table-cell">Uploaded</th>
                  <th className="text-right px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
                {docs.map((doc, i) => {
                  const Icon = getFileIcon(doc.mime_type)
                  const label = getMimeLabel(doc.mime_type)
                  return (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-700/50 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 transition-colors">
                            <Icon className="w-4 h-4 text-surface-400 dark:text-surface-500 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-surface-900 dark:text-surface-100 truncate max-w-[180px] lg:max-w-xs">
                              {doc.original_filename}
                            </p>
                            <span className="sm:hidden text-xs text-surface-400 dark:text-surface-500">{formatSize(doc.file_size)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-surface-500 dark:text-surface-400 hidden sm:table-cell">{formatSize(doc.file_size)}</td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className={`${badgeColor[label] || 'badge-info'}`}>{label}</span>
                      </td>
                      <td className="px-5 py-4 text-surface-500 dark:text-surface-400 text-xs hidden lg:table-cell">{formatDate(doc.uploaded_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/view/${doc.id}`}
                            className="btn-ghost p-2"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => downloadDoc(doc)}
                            className="btn-ghost p-2"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => deleteDoc(doc.id)}
                              className="btn-ghost p-2 text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
