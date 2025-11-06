'use client'
import { useEffect, useState } from 'react'
import { Box, Card, CardContent, CardActions, Container, Typography, TextField, Button, IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { useRouter } from 'next/navigation'
import DeleteIcon from '@mui/icons-material/Delete';
import MapIcon from '@mui/icons-material/Map';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { getSavedLocations } from '@/lib/api/api'

type Loc = { id: number; name: string; lat: number; lng: number; zoom?: number; bearing?: number; pitch?: number }

export default function DashboardPage() {
  const [locations, setLocations] = useState<Loc[]>([
    { id: 1, name: "Manila City Hall", lat: 14.5995, lng: 120.9842, zoom: 15, bearing: 0, pitch: 45 },
    { id: 2, name: "Quezon City Circle", lat: 14.6542, lng: 121.0493, zoom: 16, bearing: 90, pitch: 60 },
    { id: 3, name: "Makati Business District", lat: 14.5547, lng: 121.0244, zoom: 17, bearing: 180, pitch: 50 },
    { id: 4, name: "BGC The Fort", lat: 14.5507, lng: 121.0470, zoom: 16, bearing: 45, pitch: 55 },
    { id: 5, name: "EDSA Ortigas", lat: 14.5816, lng: 121.0577, zoom: 15, bearing: 270, pitch: 40 },
  ])
  const [q, setQ] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)
  const router = useRouter()

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedLoc, setSelectedLoc] = useState<Loc | null>(null)
  
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState('')

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
      setEditName(selectedLoc.name)
      setEditDialogOpen(true)
    }
    handleMenuClose()
  }

  const handleEditSave = () => {
    if (selectedLoc && editName.trim() !== '') {
      setLocations(prev =>
        prev.map(l =>
          l.id === selectedLoc.id ? { ...l, name: editName.trim() } : l
        )
      )
      setEditDialogOpen(false)
      setEditName('')
    }
  }

  const handleDelete = () => {
    if (selectedLoc) {
      setDeleteDialogOpen(true)
    }
    handleMenuClose()
  }

  const handleDeleteConfirm = () => {
    if (selectedLoc) {
      setLocations(prev => prev.filter(l => l.id !== selectedLoc.id))
      setDeleteDialogOpen(false)
    }
  }

  const handleNavigateToMap = (url: string) => {
    setIsNavigating(true)
    router.push(url)
  }

  useEffect(() => {
    // Try to load from API, but fall back to hardcoded data
    getSavedLocations()
      .then(data => {
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations)
        }
      })
      .catch(() => {
        // Keep hardcoded data if API fails
      })
    
    router.prefetch('/map')
  }, [])

  const filtered = locations.filter(l => l.name.toLowerCase().includes(q.toLowerCase()))

  if (isNavigating) {
    return (
      <Box sx={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#e8eaf6',
        zIndex: 9999
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ 
            width: 50, 
            height: 50, 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid #161b4cff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></Box>
          <Typography variant="h6" style={{ color: '#161b4cff' }}>Loading...</Typography>
        </Box>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </Box>
    )
  }

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
          onClick={() => handleNavigateToMap('/map')}
          startIcon={<AddIcon />}
        >
          New
        </Button>

        <Button
          variant="outlined"
          sx={{ backgroundColor: 'white', color: '#161b4cff' }}
          onClick={() => handleNavigateToMap('/map')}
          startIcon={<MapIcon />}
        >
          Map
        </Button>

        <Button
          variant="contained"
          sx={{ backgroundColor: 'white', color: '#161b4cff' }}
          startIcon={<DeleteIcon />}
        >
          Trash
        </Button>

        <Button
          variant="contained"
          sx={{ backgroundColor: 'white', color: '#161b4cff', mt: 50 }}
          onClick={() => handleNavigateToMap('/home')}
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
          <Button onClick={() => handleNavigateToMap('/map')} variant="contained" sx={{ backgroundColor: "#161b4cff" }}>New</Button>
        </div>

        {filtered.length === 0 ? (
          <Typography color="text.secondary">No saved locations found.</Typography>
        ) : (
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
                  <Typography variant="body2">Bearing: {loc.bearing}°</Typography>
                  <Typography variant="body2">Pitch: {loc.pitch}°</Typography>
                </CardContent>

                <CardActions>
                  <Button
                    onClick={() => handleNavigateToMap(`/map?focus=${encodeURIComponent(JSON.stringify(loc))}`)}
                    variant="contained"
                    sx={{ backgroundColor: "#161b4cff" }}
                  >
                    Monitor
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}
        
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEdit}>Edit Name</MenuItem>
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>Delete</MenuItem>
        </Menu>

        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Location Name</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Location Name"
              type="text"
              fullWidth
              variant="outlined"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleEditSave()
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} variant="contained" sx={{ backgroundColor: "#161b4cff" }}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Location</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{selectedLoc?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} variant="contained" color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </Box>
  )
}