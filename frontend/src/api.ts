const BASE = '/api'

export async function fetchJSON(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

// Tenders
export const listTenders = () => fetchJSON('/tenders/')
export const getTender = (id: string) => fetchJSON(`/tenders/${id}`)
export const uploadTender = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetchJSON('/tenders/upload', { method: 'POST', body: fd })
}

// Bidders
export const listBidders = (tenderId: string) => fetchJSON(`/bidders/${tenderId}`)
export const addBidder = (tenderId: string, name: string, files: File[]) => {
  const fd = new FormData()
  fd.append('name', name)
  files.forEach(f => fd.append('files', f))
  return fetchJSON(`/bidders/${tenderId}/add`, { method: 'POST', body: fd })
}

// Evaluation
export const evaluateBidder = (tenderId: string, bidderId: string) =>
  fetchJSON(`/evaluation/${tenderId}/evaluate/${bidderId}`, { method: 'POST' })
export const getResults = (tenderId: string) => fetchJSON(`/evaluation/${tenderId}/results`)

// Bulk evaluate
export const evaluateAllBidders = (tenderId: string) =>
  fetchJSON(`/evaluation/${tenderId}/evaluate-all`, { method: 'POST' })

// Audit-ready report (markdown)
export const exportReportUrl = (tenderId: string) => `/api/evaluation/${tenderId}/export`

// Dashboard + AI briefing
export interface DashboardOverview {
  tender_count: number
  bidder_count: number
  criteria_count: number
  mandatory_count: number
  eligible: number
  not_eligible: number
  needs_review: number
  pending: number
  low_confidence_evaluations: number
  avg_confidence_pct: number
  briefing: string
}

export const getDashboardOverview = (): Promise<DashboardOverview> =>
  fetchJSON('/dashboard/overview')
