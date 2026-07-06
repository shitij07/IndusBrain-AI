import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="bg-white shadow rounded-lg px-8 py-6">
        <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
        <div className="space-y-2 text-gray-700">
          <p><span className="font-semibold">Name:</span> {user.full_name}</p>
          <p><span className="font-semibold">Email:</span> {user.email}</p>
          <p><span className="font-semibold">Role:</span> <span className="capitalize">{user.role}</span></p>
        </div>
        {user.role === 'admin' && (
          <p className="mt-4 text-sm text-indigo-600">You have admin privileges. Visit the <a href="/admin" className="underline">Admin Dashboard</a>.</p>
        )}
        <button onClick={logout} className="mt-6 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
          Logout
        </button>
      </div>
    </div>
  )
}
