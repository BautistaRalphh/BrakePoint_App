const BASE = process.env.NEXT_PUBLIC_API_URL!

export async function apiLogin(payload: { username: string; password: string }) {
  const res = await fetch(`${BASE}/api/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // if you enable session auth and CSRF later:
    // credentials: 'include'
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function apiSignup(payload: { username: string; email: string; password: string }) {
  const res = await fetch(`${BASE}/api/signup/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function getSavedLocations() {
  const res = await fetch(`${BASE}/api/saved-locations/`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load locations')
  return res.json() as Promise<{ locations: Array<any> }>
}

export async function getVideoProgress(videoId: number) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${BASE}/brakepoint/api/videos/${videoId}/progress/`, { 
    cache: 'no-store',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    }
  })
  if (!res.ok) throw new Error('Failed to fetch video progress')
  return res.json() as Promise<{
    processing_status: string;
    processing_stage: string;
    yolo_progress: number;
    maskrcnn_progress: number;
  }>
}