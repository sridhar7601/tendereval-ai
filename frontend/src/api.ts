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
