import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      q
    )}&addressdetails=1&limit=5`;

    const res = await fetch(url, {
      headers: { 
        "User-Agent": "BrakePoint/1.0 (contact@brakepoint.app)"
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!res.ok) {
      console.error(`Nominatim API error: ${res.status} ${res.statusText}`);
      return NextResponse.json([]);
    }

    const json = await res.json();

    const mapped = (json as any[]).map((it) => ({
      id: String(it.place_id),
      primary: String(it.display_name).split(",")[0] ?? "",
      secondary: String(it.display_name).split(",").slice(1).join(",").trim(),
      center: { lat: parseFloat(it.lat), lon: parseFloat(it.lon) },
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching location suggestions:", error);
    return NextResponse.json([]);
  }
}