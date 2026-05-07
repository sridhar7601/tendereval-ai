import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, BarChart3, Loader2, Hash, FileText, DollarSign, Shield } from 'lucide-react'
import { getTender } from '../api'

interface Criterion {
  id: string
  category: string
  name: string
  description: string
  threshold: string
  data_type: string
  page_reference: string
}

interface TenderData {
  id: string
  title: string
  organization: string
  status: string
  criteria: Criterion[]
}

const categoryConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  eligibility: { icon: Shield, color: 'bg-red-50 text-red-700 border-red-200', label: 'Eligibility' },
  technical: { icon: FileText, color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Technical' },
  financial: { icon: DollarSign, color: 'bg-green-50 text-green-700 border-green-200', label: 'Financial' },
}

export default function TenderDetail() {
  const { tenderId } = useParams()
  const [tender, setTender] = useState<TenderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    if (tenderId) {
      getTender(tenderId).then(setTender).finally(() => setLoading(false))
    }
  }, [tenderId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
  if (!tender) return <div className="text-center py-12 text-gray-500">Tender not found</div>

  const filtered = activeTab === 'all' ? tender.criteria : tender.criteria.filter(c => c.category === activeTab)
  const tabs = ['all', 'eligibility', 'technical', 'financial']

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tender.title}</h1>
            {tender.organization && <p className="text-gray-500 mt-1">{tender.organization}</p>}
          </div>
          <div className="flex gap-3">
            <Link to={`/bidders/${tender.id}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
              <Users size={16} /> Manage Bidders
            </Link>
            <Link to={`/results/${tender.id}`} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <BarChart3 size={16} /> View Results
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200 px-4">
          <div className="flex gap-1 py-2">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab === 'all' ? `All (${tender.criteria.length})` : `${tab} (${tender.criteria.filter(c => c.category === tab).length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No criteria in this category</div>
          ) : (
            filtered.map((c, i) => {
              const cc = categoryConfig[c.category] || categoryConfig.eligibility
              const CatIcon = cc.icon
              return (
                <div key={c.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-gray-400 text-sm font-mono w-6 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cc.color}`}>
                          <CatIcon size={12} /> {cc.label}
                        </span>
                        {c.data_type && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{c.data_type}</span>
                        )}
                        {c.page_reference && (
                          <span className="text-xs text-gray-400">p.{c.page_reference}</span>
                        )}
                      </div>
                      <h4 className="font-medium text-gray-900">{c.name}</h4>
                      {c.description && <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>}
                      {c.threshold && (
                        <div className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          <Hash size={12} /> {c.threshold}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
