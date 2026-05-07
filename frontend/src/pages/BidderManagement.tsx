import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Upload, Loader2, User, FileText, X, BarChart3 } from 'lucide-react'
import { listBidders, addBidder, evaluateBidder, getTender } from '../api'

interface Bidder {
  id: string
  name: string
  overall_verdict: string | null
  documents_count: number
}

const verdictBadge: Record<string, string> = {
  eligible: 'bg-green-50 text-green-700 border-green-200',
  not_eligible: 'bg-red-50 text-red-700 border-red-200',
  needs_review: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending: 'bg-gray-50 text-gray-500 border-gray-200',
}

export default function BidderManagement() {
  const { tenderId } = useParams()
  const [bidders, setBidders] = useState<Bidder[]>([])
  const [tenderTitle, setTenderTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [evaluating, setEvaluating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    if (!tenderId) return
    Promise.all([
      listBidders(tenderId).then(setBidders),
      getTender(tenderId).then(t => setTenderTitle(t.title)),
    ]).finally(() => setLoading(false))
  }
  useEffect(load, [tenderId])

  const handleAdd = async () => {
    if (!tenderId || !name.trim() || files.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      await addBidder(tenderId, name.trim(), files)
      setShowForm(false)
      setName('')
      setFiles([])
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEvaluate = async (bidderId: string) => {
    if (!tenderId) return
    setEvaluating(bidderId)
    try {
      await evaluateBidder(tenderId, bidderId)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEvaluating(null)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>

  return (
    <div>
      <Link to={tenderId ? `/tender/${tenderId}` : '/'} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mb-4">
        <ArrowLeft size={16} /> Back to {tenderTitle || 'Tender'}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bidder Management</h1>
          <p className="text-gray-500 mt-1">{tenderTitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Plus size={16} /> Add Bidder
          </button>
          {tenderId && bidders.length > 0 && (
            <button
              onClick={async () => {
                setEvaluating('all')
                try {
                  const { evaluateAllBidders } = await import('../api')
                  await evaluateAllBidders(tenderId)
                  load()
                } catch (e: any) {
                  setError(e?.message ?? 'Bulk evaluate failed')
                } finally {
                  setEvaluating(null)
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              disabled={evaluating === 'all'}
            >
              {evaluating === 'all' ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
              {evaluating === 'all' ? 'Evaluating all...' : 'Evaluate All'}
            </button>
          )}
          {tenderId && (
            <Link to={`/results/${tenderId}`} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
              <BarChart3 size={16} /> View Results
            </Link>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Add New Bidder</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bidder Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g., ABC Construction Pvt Ltd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Documents</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-400 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Click to upload documents (PDF, DOCX, images)</p>
                <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png,.tiff" onChange={e => setFiles(Array.from(e.target.files || []))} className="hidden" />
              </div>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText size={14} /> {f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleAdd} disabled={submitting || !name.trim() || files.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {submitting ? 'Adding...' : 'Add Bidder'}
            </button>
          </div>
        </div>
      )}

      {bidders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <User size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No bidders yet</h3>
          <p className="text-gray-500">Add bidders with their submitted documents to start evaluation</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bidders.map(b => {
            const vc = verdictBadge[b.overall_verdict || 'pending']
            return (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <User size={20} className="text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{b.name}</h3>
                      <p className="text-sm text-gray-500">{b.documents_count} document{b.documents_count !== 1 ? 's' : ''} uploaded</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${vc}`}>
                      {(b.overall_verdict || 'pending').replace('_', ' ')}
                    </span>
                    {(!b.overall_verdict || b.overall_verdict === 'pending') && (
                      <button
                        onClick={() => handleEvaluate(b.id)}
                        disabled={evaluating === b.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:bg-indigo-300"
                      >
                        {evaluating === b.id ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                        {evaluating === b.id ? 'Evaluating...' : 'Evaluate'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
