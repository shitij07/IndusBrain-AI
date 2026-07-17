import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search as SearchIcon,
  FileText,
  Wrench,
  FileBarChart,
  AlertTriangle,
  FileCheck,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  Clock,
} from 'lucide-react'
import api from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

const categoryConfig = {
  documents: { icon: FileText, label: 'Documents', color: 'blue' },
  equipment: { icon: Wrench, label: 'Equipment', color: 'amber' },
  reports: { icon: FileBarChart, label: 'Reports', color: 'violet' },
  failures: { icon: AlertTriangle, label: 'Failures', color: 'rose' },
  sops: { icon: FileCheck, label: 'SOPs', color: 'emerald' },
}

const colorMap = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200/50 dark:border-blue-800/40', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200/50 dark:border-amber-800/40', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200/50 dark:border-violet-800/40', badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200/50 dark:border-rose-800/40', badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200/50 dark:border-emerald-800/40', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ResultCard({ item, category }) {
  const config = categoryConfig[category]
  const c = colorMap[config.color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-start gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors border border-transparent hover:border-surface-200 dark:hover:border-surface-700"
    >
      <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <config.icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
            {item.title || item.name || item.filename || item.type}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.badge}`}>
            {config.label}
          </span>
        </div>
        {item.snippet && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 line-clamp-2">{item.snippet}</p>
        )}
        {item.asset_id && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Asset ID: {item.asset_id}</p>
        )}
        {item.sop_number && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">SOP #: {item.sop_number}</p>
        )}
        {item.document_filename && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">From: {item.document_filename}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {(item.document_id || item.id) && (
            <Link
              to={`/view/${item.document_id || item.id}`}
              className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View Document
            </Link>
          )}
          {item.uploaded_at && (
            <span className="text-[10px] text-surface-400 dark:text-surface-500 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatDate(item.uploaded_at)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function CategorySection({ category, items, expanded, onToggle }) {
  const config = categoryConfig[category]
  const c = colorMap[config.color]

  if (!items || items.length === 0) return null

  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
            <config.icon className={`w-4 h-4 ${c.text}`} />
          </div>
          <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">{config.label}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${c.badge}`}>{items.length}</span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1">
              {items.map((item, i) => (
                <ResultCard key={item.id || i} item={item} category={category} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const searchSuggestions = [
  'pump failure',
  'maintenance schedule',
  'safety valve inspection',
  'compressor vibration analysis',
  'hydraulic system pressure',
]

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState({
    documents: true,
    equipment: true,
    reports: true,
    failures: true,
    sops: true,
  })
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function toggleCategory(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults(null)
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const { data } = await api.get('/search', { params: { q: q.trim() } })
      setResults(data)
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInputChange(e) {
    const val = e.target.value
    setQuery(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(val)
    }, 400)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    doSearch(query)
  }

  function handleSuggestion(s) {
    setQuery(s)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    doSearch(s)
  }

  const hasResults = results && results.total_count > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Global Search</h1>
        <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">
          Search across documents, equipment, reports, failures, and SOPs
        </p>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 dark:text-surface-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search across all data..."
            className="input-field pl-12 pr-12 h-14 text-base"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults(null); setSearched(false) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Loading */}
      {loading && <LoadingSpinner text="Searching across all data..." />}

      {/* AI Summary */}
      {results?.ai_summary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 bg-gradient-to-r from-brand-500/5 to-violet-500/5 dark:from-brand-500/10 dark:to-violet-500/10 border-brand-200/50 dark:border-brand-800/40"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-1">AI Summary</p>
              <p className="text-sm text-surface-700 dark:text-surface-200 leading-relaxed">{results.ai_summary}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Results count */}
      {results && !loading && (
        <p className="text-sm text-surface-400 dark:text-surface-500">
          Found <span className="font-medium text-surface-700 dark:text-surface-200">{results.total_count}</span> result{results.total_count !== 1 ? 's' : ''} for &ldquo;<span className="font-medium text-surface-700 dark:text-surface-200">{results.query}</span>&rdquo;
        </p>
      )}

      {/* Results */}
      {loading && <LoadingSpinner text="Searching..." />}

      {!loading && searched && !hasResults && (
        <EmptyState
          icon={SearchIcon}
          title="No results found"
          description={`No results found for "${query}". Try a different search term.`}
        />
      )}

      {!loading && hasResults && (
        <div className="space-y-3">
          {Object.entries(results.results).map(([category, items]) => (
            <CategorySection
              key={category}
              category={category}
              items={items}
              expanded={expanded[category]}
              onToggle={() => toggleCategory(category)}
            />
          ))}
        </div>
      )}

      {/* Initial state - suggestions */}
      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center mb-5 shadow-lg shadow-brand-500/20"
          >
            <SearchIcon className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-1"
          >
            Search everything
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-surface-400 dark:text-surface-500 mb-8"
          >
            Find documents, equipment, reports, failures, and SOPs in one place
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto"
          >
            {searchSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                {s}
              </button>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  )
}
