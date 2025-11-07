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

export type LocationSuggestion = {
  id: string;
  primary: string;     // main label
  secondary: string;   // sublabel
  center: { lat: number; lon: number };
};

export async function getSuggestions(q: string): Promise<LocationSuggestion[]> {
  if (!q.trim()) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    q
  )}&addressdetails=1&limit=5`;

  const res = await fetch(url, {
    headers: { "User-Agent": "BrakePoint (contact@example.com)" },
    cache: "no-store",
  });

  const json = (await res.json()) as any[];

  return json.map((it) => ({
    id: String(it.place_id),
    primary: String(it.display_name).split(",")[0] ?? "",
    secondary: String(it.display_name).split(",").slice(1).join(",").trim(),
    center: { lat: parseFloat(it.lat), lon: parseFloat(it.lon) },
  }));
}