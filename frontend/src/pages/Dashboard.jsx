import { useAuth } from '../context/AuthContext'

const stats = [
  { label: 'Total Documents', value: '2,847', change: '+12%', color: 'bg-blue-500' },
  { label: 'Total Assets', value: '1,234', change: '+8%', color: 'bg-emerald-500' },
  { label: 'Compliance Score', value: '94%', change: '+3%', color: 'bg-violet-500' },
  { label: 'AI Queries', value: '18,492', change: '+24%', color: 'bg-amber-500' },
]

const recentUploads = [
  { name: 'Q3 Financial Report.pdf', date: '2026-07-06', size: '2.4 MB', status: 'Processed' },
  { name: 'Compliance Audit 2026.xlsx', date: '2026-07-05', size: '1.1 MB', status: 'Processed' },
  { name: 'Employee Onboarding Guide.docx', date: '2026-07-04', size: '856 KB', status: 'Processing' },
  { name: 'Security Policy v3.pdf', date: '2026-07-03', size: '3.2 MB', status: 'Processed' },
  { name: 'Infrastructure Diagram.png', date: '2026-07-02', size: '4.7 MB', status: 'Failed' },
]

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.full_name}</h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your platform today.</p>
        </div>
        <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm font-medium">
          Logout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-lg ${stat.color} flex items-center justify-center text-white text-lg font-bold`}>
                {stat.label[0]}
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
            <div className="mt-3 text-xs">
              <span className="text-emerald-600 font-medium">{stat.change}</span>
              <span className="text-gray-400 ml-1">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Uploads</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Size</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentUploads.map((file) => (
                  <tr key={file.name} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-gray-900 font-medium">{file.name}</td>
                    <td className="py-3 text-gray-500">{file.date}</td>
                    <td className="py-3 text-gray-500">{file.size}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        file.status === 'Processed' ? 'bg-emerald-50 text-emerald-700' :
                        file.status === 'Processing' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {file.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Storage Used</span>
              <span className="text-sm font-medium text-gray-900">6.2 / 50 GB</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '12.4%' }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Active Projects</span>
              <span className="text-sm font-medium text-gray-900">8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Team Members</span>
              <span className="text-sm font-medium text-gray-900">12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Pending Reviews</span>
              <span className="text-sm font-medium text-amber-600">3</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-500">Account</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{user.role}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
