import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  History,
  ChevronDown,
  ChevronRight,
  Search,
  MessageSquareText,
  Trash2,
  FileText,
  Gauge,
  Wrench,
} from 'lucide-react'
import { askQuestion, getChatHistory } from '../api/client'
import api from '../api/client'

const chatSuggestions = [
  'Summarize my documents',
  'What topics are covered in my files?',
  'List all the key findings',
]

const rcaSuggestions = [
  'Pump P-102 experienced seal leakage during normal operation at 18 bar pressure',
  'Abnormal vibration detected in Compressor C-201 with temperature rising above 120°C',
  'Valve V-301 failed to close during emergency shutdown procedure',
]

const sourceTypeIcons = {
  pdf: FileText,
  docx: FileText,
  doc: FileText,
  xlsx: Gauge,
  xls: Gauge,
  image: Wrench,
}

const sourceTypeColors = {
  pdf: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  docx: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  doc: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  xlsx: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  xls: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  image: 'border-sky-500/30 bg-sky-500/5 text-sky-400',
}

function StreamingText({ text, speed = 30 }) {
  const [words, setWords] = useState([])
  const [visibleCount, setVisibleCount] = useState(0)
  const splitWords = useMemo(() => text.split(/(\s+)/), [text])

  useEffect(() => {
    setWords(splitWords)
    setVisibleCount(0)
  }, [text, splitWords])

  useEffect(() => {
    if (visibleCount >= words.length) return
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), speed)
    return () => clearTimeout(timer)
  }, [visibleCount, words.length, speed])

  const displayText = words.slice(0, visibleCount).join('')

  return (
    <span>
      {displayText}
      {visibleCount < words.length && (
        <span className="inline-block w-0.5 h-4 bg-amber-500 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  )
}

function SourceChip({ source, onClick }) {
  const ext = source.source?.split('.').pop()?.toLowerCase() || 'pdf'
  const Icon = sourceTypeIcons[ext] || FileText
  const colors = sourceTypeColors[ext] || sourceTypeColors.pdf
  const label = source.source || 'Source'
  const pageInfo = source.pages ? `p. ${source.pages}` : ''

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${colors} hover:brightness-125 transition-all cursor-pointer group`}
    >
      <Icon className="w-3 h-3" />
      <span className="max-w-[120px] truncate">{label}</span>
      {pageInfo && (
        <span className="text-[10px] opacity-60 font-mono">{pageInfo}</span>
      )}
    </button>
  )
}

function ConfidenceBar({ score }) {
  if (score == null) return null
  const color =
    score >= 0.8 ? 'bg-amber-500' :
    score >= 0.5 ? 'bg-amber-400' :
    'bg-red-500'

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-700/30">
      <div className="flex items-center gap-1.5 text-[11px] text-surface-500 font-mono">
        <TrendingUp className="w-3 h-3" />
        <span>Confidence</span>
      </div>
      <div className="flex-1 h-1 bg-surface-700/50 rounded-full overflow-hidden max-w-[80px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(score * 100)}%` }} />
      </div>
      <span className="text-[11px] font-mono text-surface-400">{Math.round(score * 100)}%</span>
    </div>
  )
}

function RCAResultCard({ result }) {
  const [expanded, setExpanded] = useState({
    causes: true, similar: true, recommendations: true, preventive: true,
  })

  function toggle(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-3">
      <ConfidenceBar score={result.confidence_score} />

      <Section title="Possible Causes" icon={AlertTriangle} color="rose" expanded={expanded.causes} onToggle={() => toggle('causes')}>
        {result.possible_causes.map((c, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-950/20 border border-rose-800/30">
            <span className="w-5 h-5 rounded-full bg-rose-900/40 text-rose-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-xs text-surface-200 leading-relaxed">{c}</p>
          </div>
        ))}
      </Section>

      <Section title="Similar Historical Incidents" icon={History} color="blue" expanded={expanded.similar} onToggle={() => toggle('similar')}>
        {result.similar_historical_incidents.length === 0 ? (
          <p className="text-xs text-surface-500 italic px-1">No similar incidents found.</p>
        ) : (
          result.similar_historical_incidents.map((inc, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-800/30 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-surface-100">{inc.description}</p>
                {inc.source && <span className="text-[10px] bg-blue-900/40 text-blue-300 rounded-full px-2 py-0.5 flex-shrink-0">{inc.source}</span>}
              </div>
              {inc.relevance && <p className="text-[10px] text-surface-400"><span className="font-medium text-surface-300">Relevance:</span> {inc.relevance}</p>}
            </div>
          ))
        )}
      </Section>

      <Section title="Recommendations" icon={Lightbulb} color="amber" expanded={expanded.recommendations} onToggle={() => toggle('recommendations')}>
        {result.recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30">
            <span className="w-5 h-5 rounded-full bg-amber-900/40 text-amber-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-xs text-surface-200 leading-relaxed">{r}</p>
          </div>
        ))}
      </Section>

      <Section title="Preventive Actions" icon={ShieldCheck} color="emerald" expanded={expanded.preventive} onToggle={() => toggle('preventive')}>
        {result.preventive_actions.map((a, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
            <span className="w-5 h-5 rounded-full bg-emerald-900/40 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-xs text-surface-200 leading-relaxed">{a}</p>
          </div>
        ))}
      </Section>
    </div>
  )
}

function Section({ title, icon: Icon, color, expanded, onToggle, children }) {
  const colorMap = {
    rose: { bg: 'bg-rose-900/20', text: 'text-rose-400', border: 'border-rose-800/30' },
    blue: { bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-800/30' },
    amber: { bg: 'bg-amber-900/20', text: 'text-amber-400', border: 'border-amber-800/30' },
    emerald: { bg: 'bg-emerald-900/20', text: 'text-emerald-400', border: 'border-emerald-800/30' },
  }
  const c = colorMap[color]

  return (
    <div className={`border ${c.border} rounded-lg overflow-hidden`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-2.5 hover:bg-surface-800/50 transition-colors">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${c.text}`} />
          </div>
          <span className="text-xs font-semibold text-surface-100">{title}</span>
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-surface-500" /> : <ChevronRight className="w-3.5 h-3.5 text-surface-500" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-2.5 pb-2.5 space-y-1.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5">
      <span className="w-1.5 h-1.5 bg-amber-500/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-amber-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-amber-500/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

function LoadingSkeleton({ rcaMode }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${rcaMode ? 'from-rose-600 to-rose-700' : 'from-amber-500 to-amber-600'} flex items-center justify-center flex-shrink-0 shadow-sm`}>
        {rcaMode ? <Search className="w-4 h-4 text-surface-950" /> : <Bot className="w-4 h-4 text-surface-950" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-surface-800/80 border border-surface-700/50 rounded-lg px-4 py-3 shadow-sm">
          <p className="text-[11px] font-mono text-surface-500 mb-2">
            {rcaMode ? 'Analyzing incident...' : 'Generating response...'}
          </p>
          <div className="space-y-2">
            <div className="h-3 bg-surface-700/50 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-surface-700/50 rounded animate-pulse w-1/2" />
            <div className="h-3 bg-surface-700/50 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [rcaMode, setRcaMode] = useState(false)
  const bottomRef = useRef(null)
  const messagesEndRef = useRef(null)

  const suggestions = rcaMode ? rcaSuggestions : chatSuggestions
  const filteredMessages = messages.filter(m => rcaMode ? m.isRCA : !m.isRCA)

  useEffect(() => {
    getChatHistory().then((history) => {
      const msgs = history.map((m) =>
        m.role === 'assistant'
          ? { role: 'assistant', answer: m.content, sources: [] }
          : { role: 'user', content: m.content }
      )
      setMessages(msgs)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredMessages, loading])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', content: input.trim(), isRCA: rcaMode }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    if (rcaMode) {
      try {
        const { data } = await api.post('/rca', { incident_description: userMsg.content })
        setMessages((prev) => [...prev, { role: 'assistant', isRCA: true, result: data.result }])
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', isRCA: true, result: null, error: 'Analysis failed. Please try again.' },
        ])
      } finally {
        setLoading(false)
      }
    } else {
      try {
        const data = await askQuestion(userMsg.content)
        setMessages((prev) => [...prev, { role: 'assistant', ...data }])
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', answer: 'Sorry, something went wrong. Please try again.', sources: [] },
        ])
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleClearChat() {
    if (!confirm('Clear all chat messages? This cannot be undone.')) return
    try {
      await api.delete('/chat/history')
      setMessages([])
    } catch { /* ignore */ }
  }

  function handleSuggestion(s) {
    setInput(s)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 p-0.5 bg-surface-200/50 dark:bg-surface-800/50 border border-surface-200/50 dark:border-surface-700/30 rounded-lg">
          <button
            onClick={() => setRcaMode(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              !rcaMode
                ? 'bg-brand-500 text-surface-950 shadow-sm'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5 inline mr-1.5" />
            Chat
          </button>
          <button
            onClick={() => setRcaMode(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              rcaMode
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'
            }`}
          >
            <Search className="w-3.5 h-3.5 inline mr-1.5" />
            RCA
          </button>
        </div>
        <div className="flex items-center gap-2">
          {rcaMode && (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-400 bg-rose-950/30 border border-rose-800/30 px-2.5 py-1 rounded-md font-mono">
              <AlertTriangle className="w-3 h-3" />
              Root Cause Analysis
            </div>
          )}
          {filteredMessages.length > 0 && !rcaMode && (
            <button
              onClick={handleClearChat}
              className="btn-ghost p-2 text-surface-400 dark:text-surface-500 hover:text-red-500 dark:hover:text-red-400"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-surface-200/50 dark:border-surface-700/30 bg-surface-100/50 dark:bg-surface-900/50">
        <div className="absolute inset-0 blueprint-grid-dark dark:opacity-30 pointer-events-none" />

        <div className="relative h-full overflow-y-auto px-4 scroll-smooth">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-14 h-14 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/20"
              >
                <Bot className="w-7 h-7 text-surface-950" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-1"
              >
                {rcaMode ? 'Analyze an incident' : 'Ask anything about your documents'}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-surface-400 dark:text-surface-500 mb-8 max-w-sm"
              >
                {rcaMode
                  ? 'Describe an equipment failure or incident for AI-powered root cause analysis.'
                  : 'Search across all your uploaded documents using AI.'}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap justify-center gap-2 max-w-md"
              >
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:border-amber-400/30 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {s.length > 40 ? s.slice(0, 40) + '...' : s}
                  </button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {filteredMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {msg.role === 'user' ? (
                    <div className="flex items-start gap-3 justify-end">
                      <div className={`${msg.isRCA ? 'bg-rose-600' : 'bg-brand-500'} text-surface-950 rounded-lg rounded-br-sm px-4 py-2.5 max-w-[75%] shadow-sm`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                      </div>
                    </div>
                  ) : msg.isRCA ? (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <Search className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {msg.error ? (
                          <div className="bg-surface-800 border border-red-800/50 rounded-lg px-4 py-3 shadow-sm">
                            <p className="text-sm text-red-400">{msg.error}</p>
                          </div>
                        ) : msg.result ? (
                          <div className="bg-surface-800/80 border border-surface-700/50 rounded-lg rounded-tl-sm px-3 py-3 shadow-sm">
                            <RCAResultCard result={msg.result} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <Bot className="w-4 h-4 text-surface-950" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-white dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700/50 rounded-lg rounded-tl-sm px-4 py-3 shadow-sm">
                          <div className="prose prose-sm max-w-none text-surface-800 dark:text-surface-200 leading-relaxed prose-headings:text-surface-900 dark:prose-headings:text-surface-100 prose-strong:text-surface-900 dark:prose-strong:text-surface-100 prose-code:text-amber-600 dark:prose-code:text-amber-400 prose-code:bg-surface-100 dark:prose-code:bg-surface-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-a:text-amber-600 dark:prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0"><StreamingText text={typeof children === 'string' ? children : ''} speed={20} /></p>,
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                a: ({ href, children }) => (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 underline underline-offset-2 decoration-amber-400/30">{children}</a>
                                ),
                                code: ({ children }) => (
                                  <code className="bg-surface-100 dark:bg-surface-700/50 text-amber-600 dark:text-amber-400 text-xs px-1 py-0.5 rounded font-mono">{children}</code>
                                ),
                                ul: ({ children }) => <ul className="list-disc pl-5 space-y-0.5 my-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 space-y-0.5 my-1">{children}</ol>,
                                li: ({ children }) => <li className="text-surface-700 dark:text-surface-300">{children}</li>,
                              }}
                            >
                              {msg.answer}
                            </ReactMarkdown>
                          </div>
                        </div>
                        {msg.sources?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.sources.map((s, j) => (
                              <SourceChip
                                key={j}
                                source={s}
                                onClick={() => s.document_id && window.open(`/view/${s.document_id}`, '_blank')}
                              />
                            ))}
                          </div>
                        )}
                        <ConfidenceBar score={msg.confidence_score} />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <LoadingSkeleton rcaMode={rcaMode} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="pt-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={rcaMode ? 'Describe the incident for root cause analysis...' : 'Ask a question about your documents...'}
              disabled={loading}
              className="input-field pr-12 bg-white dark:bg-surface-800/80 border-surface-300 dark:border-surface-700/50"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <TypingIndicator />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`px-5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center ${
              rcaMode
                ? 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50'
                : 'btn-primary'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        <p className="text-[11px] text-surface-400 dark:text-surface-500 mt-2 text-center font-mono">
          {rcaMode
            ? 'RCA uses your uploaded documents as context for analysis.'
            : 'AI responses are generated based on your uploaded documents.'}
        </p>
      </div>
    </div>
  )
}