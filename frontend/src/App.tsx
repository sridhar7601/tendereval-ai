import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { FileText, Users, BarChart3, Home } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import TenderDetail from './pages/TenderDetail'
import BidderManagement from './pages/BidderManagement'
import EvaluationResults from './pages/EvaluationResults'
import { listTenders } from './api'

function NavLink({ to, icon: Icon, children }: { to: string; icon: React.ElementType; children: React.ReactNode }) {
  const location = useLocation()
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-500 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{children}</span>
    </Link>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  // Auto-resolve current tender so the Bidders / Results / Tenders links work
  // regardless of where the user is in the app.
  const [activeTenderId, setActiveTenderId] = useState<string | null>(null)
  useEffect(() => {
    listTenders()
      .then((tenders) => {
        if (tenders.length > 0) setActiveTenderId(tenders[0].id)
      })
      .catch(() => setActiveTenderId(null))
  }, [])

  const tenderHref = activeTenderId ? `/tender/${activeTenderId}` : '/'
  const biddersHref = activeTenderId ? `/bidders/${activeTenderId}` : '/'
  const resultsHref = activeTenderId ? `/results/${activeTenderId}` : '/'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-500/30">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900 leading-tight">TenderEval AI</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">CRPF Procurement Console</div>
              </div>
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/" icon={Home}>Dashboard</NavLink>
              <NavLink to={tenderHref} icon={FileText}>Tenders</NavLink>
              <NavLink to={biddersHref} icon={Users}>Bidders</NavLink>
              <NavLink to={resultsHref} icon={BarChart3}>Results</NavLink>
            </nav>
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-emerald-700">Live</span>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

// Smart redirect: /bidders (no id) → first tender's bidders page; same for /results, /tender
function FirstTenderRedirect({ kind }: { kind: 'tender' | 'bidders' | 'results' }) {
  const [target, setTarget] = useState<string | null>(null)
  useEffect(() => {
    listTenders()
      .then((tenders) => setTarget(tenders.length > 0 ? `/${kind}/${tenders[0].id}` : '/'))
      .catch(() => setTarget('/'))
  }, [kind])
  if (!target) return <div className="text-gray-500 text-sm">Loading…</div>
  return <Navigate to={target} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tender" element={<FirstTenderRedirect kind="tender" />} />
          <Route path="/tender/:tenderId" element={<TenderDetail />} />
          <Route path="/bidders" element={<FirstTenderRedirect kind="bidders" />} />
          <Route path="/bidders/:tenderId" element={<BidderManagement />} />
          <Route path="/results" element={<FirstTenderRedirect kind="results" />} />
          <Route path="/results/:tenderId" element={<EvaluationResults />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
