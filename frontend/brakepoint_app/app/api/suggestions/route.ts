import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    q
  )}&addressdetails=1&limit=5`;

  const res = await fetch(url, {
    headers: { "User-Agent": "BrakePoint (contact@example.com)" },
  });
  const json = await res.json();

  const mapped = (json as any[]).map((it) => ({
    id: String(it.place_id),
    primary: String(it.display_name).split(",")[0] ?? "",
    secondary: String(it.display_name).split(",").slice(1).join(",").trim(),
    center: { lat: parseFloat(it.lat), lon: parseFloat(it.lon) },
  }));

  return NextResponse.json(mapped);
}