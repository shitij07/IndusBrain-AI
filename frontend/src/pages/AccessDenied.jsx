import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldOff, Home } from 'lucide-react'

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-800/40">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">Access Denied</h1>
        <p className="text-surface-500 dark:text-surface-400 mb-8">
          You do not have permission to access this page. Please contact your administrator if you believe this is a mistake.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
        >
          <Home className="w-4 h-4" />
          Go to Dashboard
        </Link>
      </motion.div>
    </div>
  )
}
