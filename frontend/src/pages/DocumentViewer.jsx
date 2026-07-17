import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Calendar,
  HardDrive,
  Tag,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import api from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function isImage(mime) { return mime && mime.startsWith('image/') }
function isPdf(mime) { return mime === 'application/pdf' }
function isDocx(mime) { return mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
function isXlsx(mime) { return mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
function isXls(mime) { return mime === 'application/vnd.ms-excel' }
function isDoc(mime) { return mime === 'application/msword' }

export default function DocumentViewer() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [objectUrl, setObjectUrl] = useState('')
  const docxContainerRef = useRef(null)
  const [xlsxHeaders, setXlsxHeaders] = useState([])
  const [xlsxRows, setXlsxRows] = useState([])

  useEffect(() => {
    api.get(`/documents/${id}`)
      .then(({ data }) => setDoc(data))
      .catch((err) => {
        const status = err.response?.status
        if (status === 401 || status === 403) {
          setError('Session expired. Please log in again.')
        } else if (status === 404) {
          setError('Document not found')
        } else {
          setError('Failed to load document.')
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!doc) return
    const mime = doc.mime_type
    if (isPdf(mime) || isImage(mime)) {
      fetchAndCreateObjectUrl()
    }
    renderPreview()
  }, [doc])

  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [objectUrl])

  async function fetchAndCreateObjectUrl() {
    try {
      const res = await api.get(`/documents/${id}/view`, { responseType: 'blob' })
      setObjectUrl(URL.createObjectURL(res.data))
    } catch {
      setPreviewError('Failed to load file preview.')
    }
  }

  async function handleDownload() {
    try {
      const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' })
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

  async function renderPreview() {
    const mime = doc.mime_type

    if (isDocx(mime)) {
      setPreviewLoading(true)
      try {
        const { renderAsync } = await import('docx-preview')
        const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' })
        await renderAsync(res.data, docxContainerRef.current, null, {
          className: 'docx-viewer',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        })
      } catch {
        setPreviewError('Failed to render DOCX preview.')
      }
      setPreviewLoading(false)
    }

    if (isXlsx(mime) || isXls(mime)) {
      setPreviewLoading(true)
      try {
        const XLSX = await import('xlsx')
        const res = await api.get(`/documents/${id}/download`, { responseType: 'arraybuffer' })
        const wb = XLSX.read(res.data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (rows.length > 0) {
          setXlsxHeaders(rows[0])
          setXlsxRows(rows.slice(1))
        }
      } catch {
        setPreviewError('Failed to render spreadsheet preview.')
      }
      setPreviewLoading(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading document..." />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">Something went wrong</p>
        <p className="text-sm text-surface-400 dark:text-surface-500 mb-6">{error}</p>
        <Link to="/documents" className="btn-primary">
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </Link>
      </div>
    )
  }

  const mime = doc.mime_type
  const showInline = isPdf(mime) || isImage(mime)

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <Link
            to="/documents"
            className="inline-flex items-center gap-1.5 text-sm text-surface-400 dark:text-surface-500 hover:text-surface-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </Link>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">{doc.original_filename}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-surface-400 dark:text-surface-500">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              {formatSize(doc.file_size)}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              {doc.mime_type}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(doc.uploaded_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <button onClick={handleDownload} className="btn-primary flex-shrink-0">
          <Download className="w-4 h-4" />
          Download
        </button>
      </motion.div>

      {/* Preview */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card overflow-hidden"
      >
        {showInline && objectUrl && (
          isPdf(mime) ? (
            <iframe
              src={objectUrl}
              className="w-full"
              style={{ height: '80vh' }}
              title={doc.original_filename}
            />
          ) : (
            <div className="flex items-center justify-center p-4 bg-surface-50 dark:bg-surface-800/50">
              <img
                src={objectUrl}
                alt={doc.original_filename}
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>
          )
        )}

        {showInline && !objectUrl && !previewError && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        )}

        {isDocx(mime) && (
          <div className="p-6">
            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-surface-400 dark:text-surface-500 mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering document...
              </div>
            )}
            {previewError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{previewError}</p>
                  <button onClick={handleDownload} className="text-sm text-brand-600 font-medium hover:underline mt-1">
                    Download the file instead
                  </button>
                </div>
              </div>
            )}
            <div ref={docxContainerRef} />
          </div>
        )}

        {(isXlsx(mime) || isXls(mime)) && (
          <div className="p-6">
            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-surface-400 dark:text-surface-500 mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering spreadsheet...
              </div>
            )}
            {previewError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{previewError}</p>
                  <button onClick={handleDownload} className="text-sm text-brand-600 font-medium hover:underline mt-1">
                    Download the file instead
                  </button>
                </div>
              </div>
            )}
            {xlsxHeaders.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-800/50">
                      {xlsxHeaders.map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-200 border-b border-surface-200 dark:border-surface-700 whitespace-nowrap text-xs uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {xlsxRows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white dark:bg-surface-800' : 'bg-surface-50/50'}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-4 py-2.5 border-b border-surface-100 dark:border-surface-700/50 text-surface-600 dark:text-surface-300 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {isDoc(mime) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-12 h-12 text-surface-300 mb-4" />
            <p className="text-surface-500 dark:text-surface-400 font-medium mb-1">Legacy .doc format</p>
            <p className="text-sm text-surface-400 dark:text-surface-500 mb-4">Preview not available for legacy Word documents.</p>
            <button onClick={handleDownload} className="btn-primary">
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
