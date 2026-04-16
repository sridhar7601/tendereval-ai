import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileText, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { listTenders, uploadTender } from '../api'

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
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    listTenders().then(setTenders).catch(e => setError(e.message)).finally(() => setLoading(false))
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
    <div>
      <div className="flex items-center justify-between mb-8">
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
