'use client'
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import MapView from '@/components/MapView'

export default function MapPage() {
  const params = useSearchParams()
  const focus = params.get('focus')
  const parsed = useMemo(() => {
    if (!focus) return null
    try { return JSON.parse(focus) } catch { return null }
  }, [focus])

  const center: [number, number] | undefined = parsed ? [parsed.lng, parsed.lat] : undefined
  const zoom = parsed?.zoom ?? 10

  return <MapView center={center || [120.9842, 14.5995]} zoom={zoom} />
}