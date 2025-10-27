'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function MapView({ center = [120.9842, 14.5995], zoom = 10 }: { center?: [number, number]; zoom?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const map = new maplibregl.Map({
      container: ref.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center,
      zoom
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    return () => map.remove()
  }, [center, zoom])

  return <div ref={ref} style={{ width: '100%', height: '100vh' }} />
}