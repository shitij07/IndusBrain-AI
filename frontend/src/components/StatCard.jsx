import { motion } from 'framer-motion'

const gradientMap = {
  blue: 'from-amber-500 to-amber-600',
  emerald: 'from-amber-400 to-amber-600',
  violet: 'from-amber-500 to-amber-700',
  amber: 'from-amber-400 to-amber-500',
  rose: 'from-amber-500 to-amber-600',
  cyan: 'from-amber-400 to-amber-500',
}

export default function StatCard({ label, value, icon: Icon, color = 'amber', index = 0, suffix = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-lg bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 p-5 hover:shadow-lg hover:border-amber-400/20 dark:hover:border-amber-500/20 transition-all duration-300"
    >
      <div className="absolute inset-0 blueprint-dot opacity-[0.03] dark:opacity-[0.06] pointer-events-none" />
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${gradientMap[color]} rounded-l`} />

      <div className="flex items-center justify-between relative">
        <div className="space-y-1">
          <p className="text-xs font-medium text-surface-400 dark:text-surface-500 font-mono tracking-wide uppercase">{label}</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-100 tracking-tight">
            {value}
            {suffix && <span className="text-sm font-medium text-surface-400 dark:text-surface-500 ml-1">{suffix}</span>}
          </p>
        </div>
        <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${gradientMap[color]} flex items-center justify-center shadow-lg shadow-amber-500/10`}>
          {Icon && <Icon className="w-5 h-5 text-surface-950" strokeWidth={1.5} />}
        </div>
      </div>
    </motion.div>
  )
}
