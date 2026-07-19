import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="w-14 h-14 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-surface-400 dark:text-surface-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-1">{title}</h3>
      <p className="text-sm text-surface-400 dark:text-surface-500 max-w-sm mb-5 leading-relaxed">{description}</p>
      {action}
    </motion.div>
  )
}
