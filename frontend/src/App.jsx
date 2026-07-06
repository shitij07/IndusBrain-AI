import { Routes, Route, Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  const { user, loading, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-700 text-white py-4 px-6 shadow">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">IndusBrain AI</Link>
          <nav className="flex items-center gap-4 text-sm">
            {loading ? null : user ? (
              <>
                <span>{user.full_name}</span>
                <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                {user.role === 'admin' && <Link to="/admin" className="hover:underline">Admin</Link>}
                <button onClick={logout} className="bg-white text-indigo-700 px-3 py-1 rounded hover:bg-gray-100 transition">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:underline">Sign In</Link>
                <Link to="/register" className="bg-white text-indigo-700 px-3 py-1 rounded hover:bg-gray-100 transition">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
          } />
        </Routes>
      </main>

      <footer className="bg-gray-200 text-center py-4 text-sm text-gray-600">
        &copy; {new Date().getFullYear()} IndusBrain AI. All rights reserved.
      </footer>
    </div>
  )
}
