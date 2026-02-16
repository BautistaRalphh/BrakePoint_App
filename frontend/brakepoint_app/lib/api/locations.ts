export type Loc = {
  id: number;
  name: string;
  lat: number;
  lng: number;
};

const SEED: Loc[] = [
 { id: 1, name: "McKinley Hill (Venice Grand Canal)", lat: 14.5352, lng: 121.0529 },
  { id: 2, name: "McKinley Parkway (Upper McKinley)", lat: 14.5427, lng: 121.0548},
  { id: 3, name: "5th Ave & 26th St (BGC)", lat: 14.5497, lng: 121.0536 },
  { id: 4, name: "Bonifacio High Street (BGC)", lat: 14.5520, lng: 121.0526 },
  { id: 5, name: "Market! Market! (BGC)", lat: 14.5490, lng: 121.0566},
  { id: 6, name: "SM Aura Premier (BGC)", lat: 14.5466, lng: 121.0536},
  { id: 7, name: "St. Luke’s BGC", lat: 14.5548, lng: 121.0499},
  { id: 8, name: "Uptown Mall (BGC)", lat: 14.5557, lng: 121.0558},
];

const LS_KEY = "mock_saved_locations_v1";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function read(): Loc[] {
  if (typeof window === "undefined") return SEED;
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return SEED;
  try {
    const parsed = JSON.parse(raw) as Loc[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch {
    return SEED;
  }
}

function write(locations: Loc[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(locations));
}

export async function getSavedLocationsMock(): Promise<{ locations: Loc[] }> {
  await sleep(250);
  return { locations: read() };
}

export async function saveLocationsMock(locations: Loc[]): Promise<{ success: true }> {
  await sleep(150);
  write(locations);
  return { success: true };
}

export async function resetLocationsMock(): Promise<{ locations: Loc[] }> {
  await sleep(150);
  write(SEED);
  return { locations: SEED };
}