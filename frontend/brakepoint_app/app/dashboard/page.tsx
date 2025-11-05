'use client'
import { useEffect, useState } from 'react'
import { Container, Typography, TextField, Button, List, ListItem, ListItemButton, ListItemText } from '@mui/material'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSavedLocations } from '@/lib/api/api'

type Loc = { id:number; name:string; lat:number; lng:number; zoom?:number; bearing?:number; pitch?:number }

export default function DashboardPage() {
  const [locations, setLocations] = useState<Loc[]>([])
  const [q, setQ] = useState('')
  const router = useRouter()

  useEffect(() => {
    getSavedLocations().then(data => setLocations(data.locations || []))
      .catch(() => setLocations([]))
    
    // Prefetch the map page to speed up navigation
    router.prefetch('/map')
  }, [])

  const filtered = locations.filter(l => l.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Dashboard</Typography>
      <div style={{ display:'flex', gap: 12, marginBottom: 16 }}>
        <TextField
          placeholder="Search locations..."
          value={q}
          onChange={e => setQ(e.target.value)}
          fullWidth
        />
        <Button component={Link} href="/map" variant="contained">New</Button>
      </div>

      {filtered.length === 0 ? (
        <Typography color="text.secondary">No saved locations.</Typography>
      ) : (
        <List>
          {filtered.map(loc => (
            <ListItem key={loc.id} disablePadding>
              <ListItemButton component={Link} href={`/map?focus=${encodeURIComponent(JSON.stringify(loc))}`}>
                <ListItemText primary={loc.name} secondary={`${loc.lat}, ${loc.lng}`} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Container>
  )
}