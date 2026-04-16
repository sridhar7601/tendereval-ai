import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { FileText, Users, BarChart3, Home } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import TenderDetail from './pages/TenderDetail'
import BidderManagement from './pages/BidderManagement'
import EvaluationResults from './pages/EvaluationResults'

function NavLink({ to, icon: Icon, children }: { to: string; icon: React.ElementType; children: React.ReactNode }) {
  const location = useLocation()
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={18} />
      {children}
    </Link>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <FileText size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">TenderEval AI</span>
            </Link>
            <nav className="flex gap-1">
              <NavLink to="/" icon={Home}>Dashboard</NavLink>
              <NavLink to="/tender" icon={FileText}>Tenders</NavLink>
              <NavLink to="/bidders" icon={Users}>Bidders</NavLink>
              <NavLink to="/results" icon={BarChart3}>Results</NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tender/:tenderId" element={<TenderDetail />} />
          <Route path="/bidders/:tenderId" element={<BidderManagement />} />
          <Route path="/results/:tenderId" element={<EvaluationResults />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
