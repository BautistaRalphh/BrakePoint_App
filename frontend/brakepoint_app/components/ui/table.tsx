'use client';

import React, { useState } from 'react';
import { DataGrid, GridColDef, Toolbar, ToolbarButton } from '@mui/x-data-grid';
import { Button, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Box, Typography } from '@mui/material';

import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

import './table.css';

interface ToolbarProps {
  title? : string;
  onAdd: () => void;
}

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    video_name: string;
    file_name: File | null;
  }) => void;
}

function AddModal({ open, onClose, onSubmit }: AddModalProps) {
  const [video_name, setVideoName] = React.useState('');
  const [file_name, setFile] = React.useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);

      if (selected.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(selected);
      } else {
      }
    }
  };

  const handleSubmit = () => {
    if (!video_name || !file_name) return; 
    onSubmit({ video_name, file_name });
    setVideoName('');
    setFile(null);
    onClose();
  };

  return (
    <Dialog className="add-modal" open={open} onClose={onClose} maxWidth="sm" fullWidth sx={{zIndex: 500000}}>
      <DialogTitle>Add New Video</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
        <TextField
          label="Video Name"
          variant="outlined"
          value={video_name}
          onChange={(e) => setVideoName(e.target.value)}
          fullWidth
        />

        <Button variant="contained" component="label">
          Upload File
          <input
            type="file"
            accept="video/*"
            hidden
            onChange={handleFileChange}
          />
        </Button>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CustomToolbar({ title, onAdd } : ToolbarProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
      <Toolbar>
        <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
          {title}
        </Typography>
      
        <ToolbarButton onClick={onAdd}>
          <FileUploadIcon fontSize="small"/>
        </ToolbarButton>
        
        <ToolbarButton>
          <DeleteIcon fontSize="small"/>
        </ToolbarButton>

        <ToolbarButton>
          <EditIcon fontSize="small"/>
        </ToolbarButton>
      </Toolbar>
  )
}

export default function Table() {
  const [handleOpenAddModal, setAddModalOpen] = useState(false);

  const columns = [
      { field: 'id', headerName: 'Video ID', width: 90 },
      { field: 'video_name', headerName: 'Name', flex: 1 },
      { field: 'uploaded_time', headerName: 'Uploaded Time', flex: 1 },
  ]
  
  const [rows, setRows] = useState<any>([
    { id: 1, video_name: "10212025Malate.mp4", uploaded_time: "10:00:01 October 21, 2025"}
  ]);

  const handleAdd = (data: any) => {
    setRows((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        video_name: data.videoName,
        file_name: data.file?.name,
      },
    ]);
  };

  return (
    <Box>
      <div className="table-container">
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize:  5} },
          }}
          slots={{
            toolbar: () => <CustomToolbar onAdd={() => setAddModalOpen(true)} />,
          }}
          slotProps={{toolbar:
            {title: "Videos"}
          }}
          showToolbar
          checkboxSelection
        />
      </div>
      <AddModal open={handleOpenAddModal} onClose={() => setAddModalOpen(false)} onSubmit={handleAdd} />
    </Box>
  );
}