import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain,
  Sparkles,
  Shield,
  Zap,
  ChevronRight,
  FileSearch,
  MessageSquareText,
  Activity,
  Gauge,
  Wrench,
  Factory,
} from 'lucide-react'
import api from '../api/client'

const features = [
  {
    icon: FileSearch,
    title: 'Smart Document Search',
    description: 'AI-powered semantic search across P&amp;IDs, inspection reports, and maintenance records. Find critical information instantly.',
    color: 'from-amber-500 to-amber-600',
  },
  {
    icon: MessageSquareText,
    title: 'Copilot Q&A',
    description: 'Ask questions about your asset documents and get precise answers with source citations from relevant engineering records.',
    color: 'from-amber-500 to-amber-600',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Role-based access control keeps sensitive operational data safe. Encrypted storage and audit logging included.',
    color: 'from-amber-500 to-amber-600',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Powered by vector search and Gemini AI for blazing fast responses across your entire document corpus.',
    color: 'from-amber-500 to-amber-600',
  },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

export default function Home() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    api.get('/health')
      .then(res => setStatus(res.data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <div className="-mx-4 -mt-4 lg:-mx-8 lg:-mt-8">
      {/* Hero */}
      <section className="relative overflow-hidden bg-surface-950">
        {/* Blueprint grid background */}
        <div className="absolute inset-0 blueprint-grid-dark opacity-30" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 mb-8 font-mono text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Industrial Knowledge Intelligence Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
              Unified Operational
              <br />
              <span className="text-amber-400">
                Intelligence
              </span>
            </h1>

            <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
              Every document, system, and shift — connected. IndusBrain ingests P&amp;IDs, maintenance records,
              inspection reports, and calibration certificates, then makes them queryable through a knowledge graph
              and AI-powered copilot.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 text-surface-950 font-semibold text-sm hover:bg-amber-400 transition-all duration-200 shadow-xl shadow-amber-500/20"
              >
                Get Started
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 text-white/70 font-medium text-sm hover:bg-white/5 hover:text-white transition-all duration-200"
              >
                Sign In
              </Link>
            </div>

            {/* Status indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/5"
            >
              <div className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs text-white/40 font-mono">
                API Status: {status === 'ok' ? 'Operational' : status || 'Checking...'}
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="relative h-16 bg-surface-50 dark:bg-surface-950" style={{ clipPath: 'ellipse(150% 100% at 50% 100%)' }} />
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-4">
            From fragmented files to operational intelligence
          </h2>
          <p className="text-surface-400 dark:text-surface-500 max-w-2xl mx-auto">
            Industrial facilities lose knowledge when documents are siloed. IndusBrain connects your P&amp;IDs,
            inspection reports, safety procedures, and calibration certificates into one searchable whole.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="group relative p-5 rounded-lg bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 hover:shadow-lg hover:border-amber-400/30 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
                <feature.icon className="w-5 h-5 text-surface-950" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-2">{feature.title}</h3>
              <p className="text-sm text-surface-400 dark:text-surface-500 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problem statement */}
      <section className="bg-surface-100 dark:bg-surface-900/50 border-y border-surface-200 dark:border-surface-800">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Wrench className="w-10 h-10 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-4">
              The problem we solve
            </h2>
            <p className="text-surface-400 dark:text-surface-500 max-w-2xl mx-auto leading-relaxed mb-8">
              Engineering knowledge is scattered across P&amp;IDs, maintenance logs, inspection reports, safety procedures,
              and calibration certificates. When a pump fails or a valve needs replacement, critical information is buried
              in siloed documents. IndusBrain connects these data sources into a unified knowledge graph — so engineers
              and field technicians can find answers in seconds, not hours.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { value: '10x', label: 'faster info retrieval' },
                { value: '85%', label: 'reduced search time' },
                { value: '1', label: 'unified knowledge base' },
                { value: '24/7', label: 'AI copilot access' },
              ].map((stat) => (
                <div key={stat.label} className="p-4">
                  <p className="text-2xl font-bold text-amber-500 font-mono">{stat.value}</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 font-mono uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface-950">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Factory className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Ready to connect your operations?</h2>
            <p className="text-white/50 mb-8 max-w-xl mx-auto">
              Upload your first asset document and start querying your industrial knowledge base in minutes.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 text-surface-950 font-semibold text-sm hover:bg-amber-400 transition-all duration-200 shadow-xl shadow-amber-500/20"
            >
              Create Free Account
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
