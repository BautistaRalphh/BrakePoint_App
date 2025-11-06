'use client';

import React, { useState } from 'react';
import { DataGrid, GridColDef, Toolbar, ToolbarButton } from '@mui/x-data-grid';
import { Button, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Box, Typography, Snackbar, Alert } from '@mui/material';

import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import './table.css';

interface ToolbarProps {
  title? : string;
  onAdd: () => void;
}

interface TableProps {
  onVideoFileSelect: (url: string) => void;
}
interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    video_name: string;
    file_name: File | null;
    calibration_points: { x: number; y: number }[];
  }) => void;
  onVideoFileSelect: (url: string) => void;
}

function AddModal({ open, onClose, onSubmit, onVideoFileSelect }: AddModalProps) {
  const [video_name, setVideoName] = React.useState('');
  const [file_name, setFile] = React.useState<File | null>(null);
  const [showCalibration, setShowCalibration] = React.useState(false);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [calibrationPoints, setCalibrationPoints] = React.useState<{ x: number; y: number }[]>([]);
  const [videoDimensions, setVideoDimensions] = React.useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [showWarning, setShowWarning] = React.useState(false);
  const [pendingPoint, setPendingPoint] = React.useState<{ x: number; y: number } | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);

      if (selected.type.startsWith('video/')) {
        const url = URL.createObjectURL(selected);
        setVideoUrl(url);
        setShowCalibration(true);
        onVideoFileSelect(url); 
      }      
      if (selected.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(selected);
      } else {
      }
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      video.currentTime = 0.1;
    }
  };

  const handleVideoSeeked = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (calibrationPoints.length >= 4 || isPanning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Account for zoom and pan when calculating click position
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    // Convert to original video coordinates
    const x = (canvasX - pan.x) / zoom;
    const y = (canvasY - pan.y) / zoom;

    const maxExtrapolation = Math.max(canvas.width, canvas.height) * 0.5; // 50% beyond boundary
    const isExtremePoint = 
      x < -maxExtrapolation || 
      x > canvas.width + maxExtrapolation ||
      y < -maxExtrapolation || 
      y > canvas.height + maxExtrapolation;

    if (isExtremePoint) {
      setPendingPoint({ x, y });
      setShowWarning(true);
      return;
    }

    const newPoints = [...calibrationPoints, { x, y }];
    setCalibrationPoints(newPoints);
    drawPoints(newPoints);
  };

  const handleConfirmExtremePoint = () => {
    if (pendingPoint) {
      const newPoints = [...calibrationPoints, pendingPoint];
      setCalibrationPoints(newPoints);
      drawPoints(newPoints);
      setPendingPoint(null);
    }
    setShowWarning(false);
  };

  const handleCancelExtremePoint = () => {
    setPendingPoint(null);
    setShowWarning(false);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // Handle panning
    if (isPanning) {
      const dx = canvasX - panStart.x;
      const dy = canvasY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: canvasX, y: canvasY });
      drawPoints(calibrationPoints);
      return;
    }

    // Show crosshairs
    if (calibrationPoints.length < 4) {
      const x = (canvasX - pan.x) / zoom;
      const y = (canvasY - pan.y) / zoom;
      setMousePos({ x, y });
      drawPoints(calibrationPoints, { x, y });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || e.shiftKey) { // Right click or Shift + Left click
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      setIsPanning(true);
      setPanStart({ x: canvasX, y: canvasY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(5, zoom * zoomFactor));

    // Zoom towards mouse position
    const dx = mouseX - pan.x;
    const dy = mouseY - pan.y;
    
    setPan({
      x: mouseX - dx * (newZoom / zoom),
      y: mouseY - dy * (newZoom / zoom)
    });
    
    setZoom(newZoom);
    
    // Redraw after zoom
    setTimeout(() => drawPoints(calibrationPoints, mousePos), 0);
  };

  const handleCanvasMouseLeave = () => {
    setMousePos(null);
    drawPoints(calibrationPoints);
  };

  const drawPoints = (points: { x: number; y: number }[], cursorPos?: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save context and apply transformations
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    // Draw video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw guide lines in video coordinates
    if (cursorPos && points.length < 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cursorPos.x, 0);
      ctx.lineTo(cursorPos.x, canvas.height);
      ctx.stroke();
      
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, cursorPos.y);
      ctx.lineTo(canvas.width, cursorPos.y);
      ctx.stroke();
      
      ctx.setLineDash([]);
    }

    // Fill shape if 4 points
    if (points.length === 4) {
      ctx.fillStyle = 'rgba(22, 27, 76, 0.3)';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.lineTo(points[2].x, points[2].y);
      ctx.lineTo(points[3].x, points[3].y);
      ctx.closePath();
      ctx.fill();
    }

    // Draw points
    points.forEach((point, index) => {
      ctx.fillStyle = '#161b4cff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8 / zoom, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${16 / zoom}px Arial`;
      ctx.fillText(`${index + 1}`, point.x - 5 / zoom, point.y + 5 / zoom);

      if (index > 0) {
        ctx.strokeStyle = '#161b4cff';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.moveTo(points[index - 1].x, points[index - 1].y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    });

    // Close the polygon
    if (points.length === 4) {
      ctx.strokeStyle = '#161b4cff';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(points[3].x, points[3].y);
      ctx.lineTo(points[0].x, points[0].y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const resetCalibration = () => {
    setCalibrationPoints([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    drawPoints(calibrationPoints);
  };

  const handleBackToUpload = () => {
    setShowCalibration(false);
    setCalibrationPoints([]);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!video_name || !file_name || calibrationPoints.length !== 4) {
      alert('Please provide a video name and select exactly 4 calibration points');
      return;
    }
  
    const formData = new FormData();
    formData.append('file', file_name);
    formData.append('calibration_points', JSON.stringify(calibrationPoints));
    formData.append('video_name', video_name);
  
    try {
      const response = await fetch('http://127.0.0.1:8000/brakepoint/api/upload_and_process/', {
        method: 'POST',
        body: formData,
      });
  
      const data = await response.json();
      console.log('YOLO detection results:', data);
  
      // You could show results in the table or alert
      alert(`Detected ${data.total_unique} unique objects!`);
  
      onSubmit({ video_name, file_name, calibration_points: calibrationPoints });
      
      // Cleanup
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      setVideoName('');
      setFile(null);
      setShowCalibration(false);
      setCalibrationPoints([]);
      setVideoUrl(null);
      
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to process video');
    }
  };

  return (
    <Dialog className="add-modal" open={open} onClose={onClose} maxWidth="md" fullWidth sx={{zIndex: 500000}}>
      <DialogTitle>
        {showCalibration ? 'Camera Calibration' : 'Add New Video'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
        {!showCalibration ? (
          <>
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
          </>
        ) : (
          <>
            <DialogContentText>
              Click on the video to select 4 corner points for perspective transformation.
              Points should be selected in order: <strong>top-left, top-right, bottom-right, bottom-left</strong>.
              <br/><strong>Scroll to zoom</strong>, <strong>Right-click + drag</strong> or <strong>Shift + drag</strong> to pan.
            </DialogContentText>

            <Box sx={{ position: 'relative', width: '100%', backgroundColor: '#000', overflow: 'hidden' }}>
              <video
                ref={videoRef}
                src={videoUrl || ''}
                onLoadedMetadata={handleVideoLoad}
                onSeeked={handleVideoSeeked}
                onLoadedData={handleVideoSeeked}
                style={{ display: 'none' }}
                preload="auto"
              />
              <canvas
                ref={canvasRef}
                width={videoDimensions.width}
                height={videoDimensions.height}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: '100%',
                  height: 'auto',
                  cursor: isPanning ? 'grabbing' : calibrationPoints.length < 4 ? 'crosshair' : 'default',
                  border: '2px solid #ccc',
                  minHeight: '400px'
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Points: {calibrationPoints.length}/4 | Zoom: {zoom.toFixed(1)}x
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  variant="outlined" 
                  onClick={resetZoom}
                  size="small"
                >
                  Reset View
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={resetCalibration}
                  disabled={calibrationPoints.length === 0}
                  size="small"
                >
                  Reset Points
                </Button>
              </Box>
            </Box>

            {calibrationPoints.length === 4 && (
              <Box sx={{ p: 1.5, bgcolor: 'success.light', borderRadius: 1, opacity: 0.7 }}>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  ✓ All 4 points selected. You can now proceed with the upload.
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        {showCalibration && (
          <Button onClick={handleBackToUpload} color="secondary">
            Back
          </Button>
        )}
        <Button 
          onClick={showCalibration ? handleSubmit : undefined} 
          variant="contained" 
          color="primary"
          disabled={showCalibration && calibrationPoints.length !== 4}
        >
          {showCalibration ? 'Upload & Process' : 'Next'}
        </Button>
      </DialogActions>

      {/* Warning Dialog for Extreme Points */}
      <Dialog
        open={showWarning}
        onClose={handleCancelExtremePoint}
        maxWidth="sm"
        sx={{ zIndex: 500001 }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6">Point Outside Boundary</Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This point is very far outside the image boundary. This might cause distortion in the perspective transformation.
          </DialogContentText>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2" color="info.dark">
              <strong>Note:</strong> Placing points outside the visible frame can be useful when corners aren't visible, 
              but extreme positions may lead to unexpected warping.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelExtremePoint} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleConfirmExtremePoint} variant="contained" color="warning">
            Add Point Anyway
          </Button>
        </DialogActions>
      </Dialog>
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

export default function Table({ onVideoFileSelect }: TableProps) {
  const [handleOpenAddModal, setAddModalOpen] = useState(false);

  const columns = [
      { field: 'id', headerName: 'Video ID', width: 90 },
      { field: 'video_name', headerName: 'Name', flex: 1 },
      { field: 'uploaded_time', headerName: 'Uploaded Time', flex: 1 },
  ]
  
  const [rows, setRows] = useState<any>([
    { id: 1, video_name: "10212025Malate.mp4", uploaded_time: "10:00:01 October 21, 2025"}
  ]);

  const handleAdd = (data: { video_name: string; file_name: File | null; calibration_points: { x: number; y: number }[] }) => {
    setRows((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        video_name: data.video_name,
        uploaded_time: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
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
      <AddModal 
        open={handleOpenAddModal} 
        onClose={() => setAddModalOpen(false)} 
        onSubmit={handleAdd} 
        onVideoFileSelect={onVideoFileSelect} 
      />
    </Box>
  );
}