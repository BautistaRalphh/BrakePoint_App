'use client'
import { useEffect, useState } from 'react'
import { Box, Card, CardContent, CardActions, Container, Typography, TextField, Button, IconButton, Menu, MenuItem, List, ListItemButton, ListItemText } from '@mui/material'
import Link from 'next/link'
import DeleteIcon from '@mui/icons-material/Delete';
import MapIcon from '@mui/icons-material/Map';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { getSavedLocations } from '@/lib/api/api'

type Loc = { id: number; name: string; lat: number; lng: number; zoom?: number; bearing?: number; pitch?: number }

export default function DashboardPage() {
  const [locations, setLocations] = useState<Loc[]>([])
  const [q, setQ] = useState('')

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedLoc, setSelectedLoc] = useState<Loc | null>(null)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, loc: Loc) => {
    setAnchorEl(event.currentTarget)
    setSelectedLoc(loc)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedLoc(null)
  }

  const handleEdit = () => {
    if (selectedLoc) {
      const newName = prompt('Enter new name:', selectedLoc.name)
      if (newName && newName.trim() !== '') {
        setLocations(prev =>
          prev.map(l =>
            l.id === selectedLoc.id ? { ...l, name: newName } : l
          )
        )
      }
    }
    handleMenuClose()
  }

  const handleDelete = () => {
    if (selectedLoc && confirm(`Delete location "${selectedLoc.name}"?`)) {
      setLocations(prev => prev.filter(l => l.id !== selectedLoc.id))
    }
    handleMenuClose()
  }

  // useEffect(() => {
  //   getSavedLocations().then(data => setLocations(data.locations || []))
  //     .catch(() => setLocations([]))
  // }, [])

  // Sample Data
  useEffect(() => {
    setLocations([
      { id: 1, name: "Intramuros, Manila", lat: 14.5896, lng: 120.9747, zoom: 14, bearing: 0, pitch: 30 },
      { id: 2, name: "Tagaytay Ridge", lat: 14.1171, lng: 120.9617, zoom: 12, bearing: 20, pitch: 40 },
    ])
  }, [])

  const filtered = locations.filter(l => l.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        sx={{
          width: 240,
          backgroundColor: '#161b4cff',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          p: 2,
          gap: 2,
        }}
      >
        <Typography variant="h6" sx={{ mt: 2, fontWeight: 'bold' }}>
          Menu
        </Typography>

        <Button
          variant="contained"
          sx={{ backgroundColor: 'white', color: '#161b4cff' }}
          component={Link}
          href="/map" // change to search
          startIcon={<AddIcon />}
        >
          New
        </Button>

        <Button
          variant="outlined"
          sx={{ backgroundColor: 'white', color: '#161b4cff' }}
          component={Link}
          href="/map"
          startIcon={<MapIcon />}
        >
          Map
        </Button>

        <Button
          variant="contained"
          sx={{ backgroundColor: 'white', color: '#161b4cff' }}
          // component={Link}
          // href="/trash"
          startIcon={<DeleteIcon />}
        >
          Trash
        </Button>

        <Button
          variant="contained"
          sx={{ backgroundColor: 'white', color: '#161b4cff', mt: 50 }}
          component={Link}
          href="/home"
        >
          Logout
        </Button>
      </Box>

      <Container sx={{ py: 4 }}>
        <Typography variant="h5" fontWeight={"bold"} gutterBottom>Dashboard</Typography>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <TextField
            placeholder="Search locations..."
            value={q}
            onChange={e => setQ(e.target.value)}
            fullWidth
          />
          <Button component={Link} href="/map" variant="contained" sx={{ backgroundColor: "#161b4cff" }}>New</Button>
        </div>

        {filtered.length === 0 ? (
          <Typography color="text.secondary">No saved locations.</Typography>
        ) : (
          // <List>
          //   {filtered.map(loc => (
          //     <ListItem key={loc.id} button component={Link} href={`/map?focus=${encodeURIComponent(JSON.stringify(loc))}`}>
          //       <ListItemText primary={loc.name} secondary={`${loc.lat}, ${loc.lng}`} />
          //     </ListItem>
          //   ))}
          // </List>

          <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={2}>
            {filtered.map(loc => (
              <Card
                key={loc.id}
                sx={{
                  border: '1px solid #ddd',
                  borderRadius: 2,
                  p: 1,
                  boxShadow: 1,
                  backgroundColor: 'white',
                  position: "relative"
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                  }}
                >
                  <IconButton 
                    aria-label="more-options"
                    onClick={(e) => handleMenuOpen(e, loc)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>

                <CardContent>
                  <Typography variant="h6" fontWeight={"bold"}>{loc.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Latitude: {loc.lat}, Longitude: {loc.lng}
                  </Typography>
                  <Typography variant="body2">Zoom: {loc.zoom}</Typography>
                  <Typography variant="body2">Bearing: {loc.bearing}</Typography>
                  <Typography variant="body2">Pitch: {loc.pitch}</Typography>
                </CardContent>

                <CardActions>
                  <Button
                    component={Link}
                    href={`/map?focus=${encodeURIComponent(JSON.stringify(loc))}`}
                    variant="contained"
                    sx={{ backgroundColor: "#161b4cff" }}
                  >
                    Monitor
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>

          // <List>
          //   {filtered.map(loc => (
          //     <ListItemButton
          //       key={loc.id}
          //       component={Link}
          //       href={`/map?focus=${encodeURIComponent(JSON.stringify(loc))}`}
          //     >
          //       <ListItemText primary={loc.name} secondary={`${loc.lat}, ${loc.lng}`} />
          //     </ListItemButton>
          //   ))}
          // </List>

        )}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEdit}>Edit Name</MenuItem>
          <MenuItem onClick={handleDelete}>Delete</MenuItem>
        </Menu>

      </Container>
    </Box>
  )
}