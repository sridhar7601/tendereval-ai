import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle, XCircle, AlertTriangle, ChevronUp } from 'lucide-react'
import { getResults } from '../api'

interface CriterionResult {
  criterion: string
  verdict: string
  extracted_value: string
  reasoning: string
  confidence: number
}

interface BidderResult {
  id: string
  name: string
  overall_verdict: string
  results: CriterionResult[]
}

interface ResultsData {
  tender_id: string
  tender_title: string
  bidders: BidderResult[]
}

const verdictIcon: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  eligible: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  not_eligible: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  needs_review: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  pending: { icon: AlertTriangle, color: 'text-gray-400', bg: 'bg-gray-50' },
}

function VerdictCell({ verdict, onClick }: { verdict: string; onClick: () => void }) {
  const vc = verdictIcon[verdict] || verdictIcon.pending
  const Icon = vc.icon
  return (
    <button onClick={onClick} className={`w-full h-full flex items-center justify-center p-2 ${vc.bg} hover:opacity-80 transition-opacity`}>
      <Icon size={20} className={vc.color} />
    </button>
  )
}

function ComplianceScore({ results }: { results: CriterionResult[] }) {
  if (results.length === 0) return null
  const eligible = results.filter(r => r.verdict === 'eligible').length
  const pct = Math.round((eligible / results.length) * 100)
  const color = pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`text-2xl font-bold ${color}`}>{pct}%</span>
}

export default function EvaluationResults() {
  const { tenderId } = useParams()
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (tenderId) {
      getResults(tenderId).then(setData).finally(() => setLoading(false))
    }
  }, [tenderId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
  if (!data || data.bidders.length === 0) {
    return (
      <div>
        <Link to={tenderId ? `/bidders/${tenderId}` : '/'} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-1">No evaluation results yet</h3>
          <p className="text-gray-500">Evaluate bidders first to see results here</p>
        </div>
      </div>
    )
  }

  // Collect all criteria names (union across bidders)
  const allCriteria = [...new Set(data.bidders.flatMap(b => b.results.map(r => r.criterion)))]

  return (
    <div>
      <Link to={tenderId ? `/tender/${tenderId}` : '/'} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft size={16} /> Back to Tender
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Evaluation Results</h1>
        <p className="text-gray-500 mt-1">{data.tender_title}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {data.bidders.map(b => {
          const vc = verdictIcon[b.overall_verdict] || verdictIcon.pending
          const Icon = vc.icon
          return (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <h3 className="font-medium text-gray-900 text-sm truncate mb-2">{b.name}</h3>
              <ComplianceScore results={b.results} />
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${vc.bg} ${vc.color}`}>
                  <Icon size={12} /> {(b.overall_verdict || 'pending').replace('_', ' ')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Evaluation Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Evaluation Matrix</h2>
          <p className="text-sm text-gray-500 mt-0.5">Click any cell to see the detailed reasoning</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 border-b border-r border-gray-200 min-w-[200px]">Criterion</th>
                {data.bidders.map(b => (
                  <th key={b.id} className="text-center px-4 py-3 text-sm font-medium text-gray-700 border-b border-r border-gray-200 min-w-[120px]">
                    {b.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allCriteria.map((criterion, idx) => (
                <>
                  <tr key={criterion} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200 font-medium">{criterion}</td>
                    {data.bidders.map(b => {
                      const result = b.results.find(r => r.criterion === criterion)
                      const cellKey = `${b.id}-${criterion}`
                      return (
                        <td key={b.id} className="border-r border-gray-200 p-0">
                          {result ? (
                            <VerdictCell
                              verdict={result.verdict}
                              onClick={() => setExpanded(expanded === cellKey ? null : cellKey)}
                            />
                          ) : (
                            <div className="flex items-center justify-center p-2 text-gray-300">--</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  {/* Expanded reasoning row */}
                  {data.bidders.map(b => {
                    const cellKey = `${b.id}-${criterion}`
                    const result = b.results.find(r => r.criterion === criterion)
                    if (expanded !== cellKey || !result) return null
                    return (
                      <tr key={`${cellKey}-detail`} className="bg-indigo-50/50">
                        <td colSpan={data.bidders.length + 1} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <button onClick={() => setExpanded(null)} className="mt-0.5 text-gray-400 hover:text-gray-600">
                              <ChevronUp size={16} />
                            </button>
                            <div className="flex-1 text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{b.name}</span>
                                <span className="text-gray-400">&middot;</span>
                                <span className="text-gray-500">{criterion}</span>
                                {result.confidence > 0 && (
                                  <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
                                    {(result.confidence * 100).toFixed(0)}% confidence
                                  </span>
                                )}
                              </div>
                              {result.extracted_value && (
                                <p className="text-gray-700 mb-1"><strong>Found:</strong> {result.extracted_value}</p>
                              )}
                              <p className="text-gray-600"><strong>Reasoning:</strong> {result.reasoning}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
        <span className="flex items-center gap-1"><CheckCircle size={16} className="text-green-600" /> Eligible</span>
        <span className="flex items-center gap-1"><XCircle size={16} className="text-red-600" /> Not Eligible</span>
        <span className="flex items-center gap-1"><AlertTriangle size={16} className="text-yellow-600" /> Needs Review</span>
      </div>
    </div>
  )
}
