import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileText, Clock, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { listTenders, uploadTender, getDashboardOverview } from '../api'
import type { DashboardOverview } from '../api'

interface Tender {
  id: string
  title: string
  status: string
  criteria_count: number
  created_at: string
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  uploaded: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Uploaded' },
  parsing: { icon: Loader2, color: 'text-blue-600 bg-blue-50', label: 'Parsing...' },
  parsed: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Parsed' },
  error: { icon: AlertCircle, color: 'text-red-600 bg-red-50', label: 'Error' },
}

export default function Dashboard() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    listTenders().then(setTenders).catch(e => setError(e.message)).finally(() => setLoading(false))
    getDashboardOverview().then(setOverview).catch(() => setOverview(null))
  }
  useEffect(load, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await uploadTender(file)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tender Dashboard</h1>
          <p className="text-gray-500 mt-1">Upload tender documents and manage evaluations</p>
        </div>
        <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium cursor-pointer transition-colors ${uploading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {uploading ? 'Uploading...' : 'Upload Tender'}
          <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* AI Morning Briefing */}
      {overview ? (
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-white border-l-4 border-indigo-500 border-y border-r border-indigo-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-700">AI Procurement Briefing</span>
            <span className="text-[10px] uppercase tracking-wider rounded-full bg-indigo-600 text-white px-2 py-0.5 font-bold">Azure GPT-4.1</span>
            <span className="ml-auto text-xs text-gray-500">
              {overview.bidder_count} bidders · {overview.needs_review} need review · avg confidence {overview.avg_confidence_pct}%
            </span>
          </div>
          <p className="text-sm leading-relaxed text-gray-700">{overview.briefing}</p>
        </div>
      ) : null}

      {/* KPI strip */}
      {overview ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Tenders" value={overview.tender_count} color="indigo" />
          <KpiCard label="Bidders" value={overview.bidder_count} color="blue" />
          <KpiCard label="Eligible" value={overview.eligible} color="emerald" />
          <KpiCard label="Not Eligible" value={overview.not_eligible} color="red" />
          <KpiCard label="Needs Review" value={overview.needs_review} color="amber" />
        </div>
      ) : null}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
      ) : tenders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tenders yet</h3>
          <p className="text-gray-500">Upload a tender document (PDF or DOCX) to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tenders.map(t => {
            const sc = statusConfig[t.status] || statusConfig.uploaded
            const Icon = sc.icon
            return (
              <Link key={t.id} to={`/tender/${t.id}`} className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{t.title}</h3>
                      <p className="text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('en-IN')} &middot; {t.criteria_count} criteria extracted</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                    <Icon size={14} className={t.status === 'parsing' ? 'animate-spin' : ''} />
                    {sc.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: number; color: 'indigo' | 'blue' | 'emerald' | 'red' | 'amber' }) {
  const colorClasses: Record<string, string> = {
    indigo: 'border-indigo-200 bg-indigo-50/40',
    blue: 'border-blue-200 bg-blue-50/40',
    emerald: 'border-emerald-200 bg-emerald-50/40',
    red: 'border-red-200 bg-red-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
  }
  const textClasses: Record<string, string> = {
    indigo: 'text-indigo-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
  }
  return (
    <div className={`rounded-xl border ${colorClasses[color]} p-4`}>
      <p className={`text-[10px] uppercase tracking-wider font-semibold ${textClasses[color]}`}>{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}
