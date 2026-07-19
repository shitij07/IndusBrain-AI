import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ size = 20, text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-6 h-6 text-amber-500" />
      </motion.div>
      <p className="text-sm text-surface-400 dark:text-surface-500 font-mono text-[11px] uppercase tracking-wider">{text}</p>
    </div>
  )
}

export function LoadingSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          className="h-4 bg-surface-200 dark:bg-surface-700/50 rounded-lg"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
          style={{ width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 bg-surface-200 dark:bg-surface-700/50 rounded-lg w-56" />
      <div className="h-4 bg-surface-200 dark:bg-surface-700/50 rounded-lg w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface-200 dark:bg-surface-700/50 rounded-lg" />
        ))}
      </div>
      <div className="h-48 bg-surface-200 dark:bg-surface-700/50 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-64 bg-surface-200 dark:bg-surface-700/50 rounded-lg" />
        <div className="h-64 bg-surface-200 dark:bg-surface-700/50 rounded-lg" />
      </div>
    </div>
  )
}
