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
  Gauge,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/documents', label: 'Asset Files', icon: Upload },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/chat', label: 'Copilot', icon: MessageSquareText },
  { to: '/knowledge-graph', label: 'Asset Graph', icon: Share2 },
  { to: '/compliance-checker', label: 'Audit', icon: ClipboardCheck },
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
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
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
      <div className="relative flex-1 flex flex-col lg:pl-64">
        {/* Blueprint background */}
        <div className="absolute inset-0 blueprint-grid-dark dark:opacity-50 pointer-events-none" />

        {/* Top bar */}
        <header
          className={`relative z-20 transition-all duration-300 ${
            scrolled
              ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-surface-200/50 dark:bg-surface-900/80 dark:border-surface-700/50'
              : 'bg-transparent'
          }`}
        >
          <div className="flex items-center justify-between h-14 px-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden -ml-2 p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Tagline */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded bg-brand-500/10 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-brand-500" />
              </div>
              <span className="font-medium text-surface-300/70 dark:text-surface-500 text-[11px] font-mono uppercase tracking-widest hidden xl:block">
                unified operational intelligence across every document, system, and shift
              </span>
              <div className="w-px h-4 bg-surface-300/40 dark:bg-surface-700/40 mx-1 hidden xl:block" />
              <span className="text-sm font-medium text-surface-900 dark:text-surface-100 capitalize">
                {location.pathname === '/' ? 'Home' : location.pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Home'}
              </span>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-amber-600 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-surface-950">
                    {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <span className="text-surface-700 font-medium dark:text-surface-200">{user?.full_name}</span>
              </div>
              <button
                onClick={logout}
                className="btn-ghost text-surface-400 hover:text-red-500 dark:hover:text-red-400"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="relative flex-1 p-4 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>

        <footer className="relative py-3 px-4 lg:px-8 text-center text-[10px] text-surface-400 border-t border-surface-200/50 dark:text-surface-600 dark:border-surface-800/50 font-mono">
          &copy; {new Date().getFullYear()} IndusBrain AI &middot; Industrial Knowledge Intelligence
        </footer>
      </div>
    </div>
  )
}

function SidebarContent({ user, allItems, logout, onClose }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative flex flex-col h-full bg-surface-900 border-r border-surface-700/50 dark:bg-surface-950 dark:border-surface-800/50">
      {/* Blueprint dot overlay */}
      <div className="absolute inset-0 blueprint-dot pointer-events-none opacity-40" />

      {/* Logo */}
      <div className="relative flex items-center justify-between h-16 px-6 border-b border-surface-700/50 dark:border-surface-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-amber-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Brain className="w-5 h-5 text-surface-950" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">IndusBrain</p>
            <p className="text-[9px] text-brand-400 font-mono tracking-wider uppercase">Industrial AI</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="relative flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {allItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                isActive
                  ? 'text-amber-400 bg-brand-500/10'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle + User footer */}
      <div className="relative px-3 py-4 border-t border-surface-700/50 dark:border-surface-800/50">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 transition-all duration-200 mb-2"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-amber-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-surface-950">
              {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
            <p className="text-xs text-surface-500 truncate font-mono">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/30 transition-all duration-200 mt-1"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
