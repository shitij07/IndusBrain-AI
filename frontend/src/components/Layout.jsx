import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Upload,
  MessageSquareText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Brain,
  ChevronRight,
  User,
  Share2,
  Sun,
  Moon,
  ClipboardCheck,
  Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/documents', label: 'Documents', icon: Upload },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/chat', label: 'AI Chat', icon: MessageSquareText },
  { to: '/knowledge-graph', label: 'Knowledge Graph', icon: Share2 },
  { to: '/compliance-checker', label: 'Compliance Checker', icon: ClipboardCheck },
]

const adminItems = [
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
  { to: '/admin/documents', label: 'All Documents', icon: ClipboardCheck },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const allItems = user?.role === 'admin' ? [...navItems, ...adminItems] : navItems

  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-950">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
          >
            <SidebarContent
              user={user}
              allItems={allItems}
              logout={logout}
              onClose={() => setSidebarOpen(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30">
        <SidebarContent user={user} allItems={allItems} logout={logout} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Top bar */}
        <header
          className={`sticky top-0 z-20 transition-all duration-300 ${
            scrolled
              ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-200/50 dark:bg-surface-900/80 dark:border-surface-700/50'
              : 'bg-transparent'
          }`}
        >
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden -ml-2 p-2 rounded-xl text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden lg:flex items-center gap-2 text-sm text-surface-400 dark:text-surface-500">
              <Brain className="w-4 h-4 text-brand-500" />
              <span className="font-medium text-surface-900 dark:text-surface-100">IndusBrain AI</span>
              <ChevronRight className="w-3 h-3" />
              <span className="capitalize dark:text-surface-400">{location.pathname.replace('/', '') || 'Home'}</span>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-surface-700 font-medium dark:text-surface-200">{user?.full_name}</span>
              </div>
              <button
                onClick={logout}
                className="btn-ghost text-surface-400 hover:text-red-500 dark:hover:text-red-400"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>

        <footer className="py-4 px-4 lg:px-8 text-center text-xs text-surface-400 border-t border-surface-200/50 dark:text-surface-500 dark:border-surface-800/50">
          &copy; {new Date().getFullYear()} IndusBrain AI. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

function SidebarContent({ user, allItems, logout, onClose }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex flex-col h-full bg-white border-r border-surface-200 dark:bg-surface-900 dark:border-surface-700">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-surface-900 dark:text-surface-100">IndusBrain</p>
            <p className="text-[10px] text-surface-400 font-medium tracking-wider uppercase dark:text-surface-500">AI Platform</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors dark:text-surface-500 dark:hover:text-surface-300 dark:hover:bg-surface-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {allItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-900/30 dark:text-brand-300'
                  : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
              }`
            }
          >
            <item.icon className="w-4 h-4" strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle + User footer */}
      <div className="px-3 py-4 border-t border-surface-100 dark:border-surface-700">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-all duration-200 mb-2 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-surface-900 truncate dark:text-surface-100">{user?.full_name}</p>
            <p className="text-xs text-surface-400 truncate dark:text-surface-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all duration-200 mt-1 dark:hover:bg-red-900/20"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
