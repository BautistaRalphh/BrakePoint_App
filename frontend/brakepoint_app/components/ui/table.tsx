'use client';

import React, { useState, useEffect } from 'react';
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
  onEdit: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

interface TableProps {
  onVideoFileSelect: (url: string, thumbnail?: string) => void;
  hideUpload?: boolean;
  cameraId?: number | null;
  onUploadComplete?: () => void;
  visibleCameraIds?: number[];
  onProcessingStart?: (videoName: string, videoId: number) => void;
  onProcessingComplete?: (videoName: string, success: boolean, data?: any) => void;
  onVideoSelect?: (videoData: any) => void;
  onMultipleVideoSelect?: (videoDataArray: any[]) => void;
}
interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    video_name: string;
    file_name: File | null;
    calibration_points: { x: number; y: number }[];
    reference_distance_meters?: number;
  }) => void;
  onVideoFileSelect: (url: string) => void;
  cameraId?: number | null;
  onUploadComplete?: () => void;
  onProcessingStart?: (videoName: string, videoId: number) => void;
  onProcessingComplete?: (videoName: string, success: boolean, data?: any) => void;
}

function AddModal({ open, onClose, onSubmit, onVideoFileSelect, cameraId, onUploadComplete, onProcessingStart, onProcessingComplete }: AddModalProps) {
  const [video_name, setVideoName] = React.useState('');
  const [file_name, setFile] = React.useState<File | null>(null);
  const [showCalibration, setShowCalibration] = React.useState(false);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [calibrationPoints, setCalibrationPoints] = React.useState<{ x: number; y: number }[]>([]);
  const [referencePoints, setReferencePoints] = React.useState<{ x: number; y: number }[]>([]);
  const [referenceDistance, setReferenceDistance] = React.useState<number>(3); 
  const [showReferenceStep, setShowReferenceStep] = React.useState(false); 
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
    if (isPanning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    
    const x = (canvasX - pan.x) / zoom;
    const y = (canvasY - pan.y) / zoom;

    // Step 1: Select 4 calibration points for perspective transform
    if (!showReferenceStep && calibrationPoints.length < 4) {
      const maxExtrapolation = Math.max(canvas.width, canvas.height) * 0.5;
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
      drawPoints(newPoints, referencePoints);
      
      // Move to reference point selection after 4 points
      if (newPoints.length === 4) {
        setTimeout(() => setShowReferenceStep(true), 500);
      }
      return;
    }

    // Step 2: Select 2 reference points for scale calculation
    if (showReferenceStep && referencePoints.length < 2) {
      const newPoints = [...referencePoints, { x, y }];
      setReferencePoints(newPoints);
      drawPoints(calibrationPoints, newPoints);
    }
  };

  const handleConfirmExtremePoint = () => {
    if (pendingPoint) {
      const newPoints = [...calibrationPoints, pendingPoint];
      setCalibrationPoints(newPoints);
      drawPoints(newPoints, referencePoints);
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

    if (isPanning) {
      const dx = canvasX - panStart.x;
      const dy = canvasY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: canvasX, y: canvasY });
      drawPoints(calibrationPoints, referencePoints);
      return;
    }

    // Show crosshairs when adding points
    const needsMorePoints = (!showReferenceStep && calibrationPoints.length < 4) || 
                            (showReferenceStep && referencePoints.length < 2);
    
    if (needsMorePoints) {
      const x = (canvasX - pan.x) / zoom;
      const y = (canvasY - pan.y) / zoom;
      setMousePos({ x, y });
      drawPoints(calibrationPoints, referencePoints, { x, y });
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

    const dx = mouseX - pan.x;
    const dy = mouseY - pan.y;
    
    setPan({
      x: mouseX - dx * (newZoom / zoom),
      y: mouseY - dy * (newZoom / zoom)
    });
    
    setZoom(newZoom);
    setTimeout(() => drawPoints(calibrationPoints, referencePoints, mousePos), 0);
  };

  const handleCanvasMouseLeave = () => {
    setMousePos(null);
    drawPoints(calibrationPoints, referencePoints);
  };

  const drawPoints = (
    fourPoints: { x: number; y: number }[], 
    twoPoints: { x: number; y: number }[],
    cursorPos?: { x: number; y: number }
  ) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw guide lines and preview connections
    if (cursorPos) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      
      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(cursorPos.x, 0);
      ctx.lineTo(cursorPos.x, canvas.height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, cursorPos.y);
      ctx.lineTo(canvas.width, cursorPos.y);
      ctx.stroke();
      
      // Preview connection to previous point(s)
      if (!showReferenceStep && fourPoints.length > 0 && fourPoints.length < 4) {
        ctx.strokeStyle = 'rgba(22, 27, 76, 0.5)';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([10 / zoom, 5 / zoom]);
        
        // Draw line from last point to cursor
        ctx.beginPath();
        ctx.moveTo(fourPoints[fourPoints.length - 1].x, fourPoints[fourPoints.length - 1].y);
        ctx.lineTo(cursorPos.x, cursorPos.y);
        ctx.stroke();
        
        // If 3 points exist, show preview of closing line
        if (fourPoints.length === 3) {
          ctx.strokeStyle = 'rgba(22, 27, 76, 0.3)';
          ctx.setLineDash([5 / zoom, 10 / zoom]);
          ctx.beginPath();
          ctx.moveTo(cursorPos.x, cursorPos.y);
          ctx.lineTo(fourPoints[0].x, fourPoints[0].y);
          ctx.stroke();
        }
      }
      
      // Preview reference line
      if (showReferenceStep && twoPoints.length === 1) {
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
        ctx.lineWidth = 3 / zoom;
        ctx.setLineDash([10 / zoom, 5 / zoom]);
        ctx.beginPath();
        ctx.moveTo(twoPoints[0].x, twoPoints[0].y);
        ctx.lineTo(cursorPos.x, cursorPos.y);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }

    // Draw 4-point calibration polygon
    if (fourPoints.length > 0) {
      if (fourPoints.length === 4) {
        ctx.fillStyle = 'rgba(22, 27, 76, 0.3)';
        ctx.beginPath();
        ctx.moveTo(fourPoints[0].x, fourPoints[0].y);
        ctx.lineTo(fourPoints[1].x, fourPoints[1].y);
        ctx.lineTo(fourPoints[2].x, fourPoints[2].y);
        ctx.lineTo(fourPoints[3].x, fourPoints[3].y);
        ctx.closePath();
        ctx.fill();
      }

      fourPoints.forEach((point, index) => {
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
          ctx.moveTo(fourPoints[index - 1].x, fourPoints[index - 1].y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      });

      if (fourPoints.length === 4) {
        ctx.strokeStyle = '#161b4cff';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.moveTo(fourPoints[3].x, fourPoints[3].y);
        ctx.lineTo(fourPoints[0].x, fourPoints[0].y);
        ctx.stroke();
      }
    }

    // Draw 2-point reference line (on top of polygon)
    if (twoPoints.length > 0) {
      twoPoints.forEach((point, index) => {
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10 / zoom, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${16 / zoom}px Arial`;
        ctx.fillText(`R${index + 1}`, point.x - 7 / zoom, point.y + 5 / zoom);

        if (index === 1) {
          ctx.strokeStyle = '#4CAF50';
          ctx.lineWidth = 4 / zoom;
          ctx.beginPath();
          ctx.moveTo(twoPoints[0].x, twoPoints[0].y);
          ctx.lineTo(twoPoints[1].x, twoPoints[1].y);
          ctx.stroke();
          
          const midX = (twoPoints[0].x + twoPoints[1].x) / 2;
          const midY = (twoPoints[0].y + twoPoints[1].y) / 2;
          ctx.fillStyle = '#4CAF50';
          ctx.font = `bold ${20 / zoom}px Arial`;
          ctx.fillText(`${referenceDistance}m`, midX, midY - 15 / zoom);
        }
      });
    }

    ctx.restore();
  };

  const resetCalibration = () => {
    setCalibrationPoints([]);
    setReferencePoints([]);
    setShowReferenceStep(false);
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
    drawPoints(calibrationPoints, referencePoints);
  };

  const handleBackToUpload = () => {
    setShowCalibration(false);
    setCalibrationPoints([]);
    setReferencePoints([]);
    setShowReferenceStep(false);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!video_name || !file_name) {
      alert('Please provide a video name and file');
      return;
    }

    if (!cameraId) {
      alert('Please select a camera first');
      return;
    }

    if (calibrationPoints.length !== 4) {
      alert('Please select 4 calibration points for perspective transform');
      return;
    }

    if (referencePoints.length !== 2) {
      alert('Please select 2 reference points for scale calculation (e.g., road marking edges)');
      return;
    }

    if (!referenceDistance || referenceDistance <= 0) {
      alert('Please provide a valid reference distance in meters');
      return;
    }
  
    const formData = new FormData();
    formData.append('file', file_name);
    formData.append('video_name', video_name);
    formData.append('camera_id', cameraId.toString());
    formData.append('calibration_points', JSON.stringify(calibrationPoints));
    formData.append('reference_points', JSON.stringify(referencePoints));
    formData.append('reference_distance_meters', referenceDistance.toString());
    
    // Get auth token
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('Please log in to upload videos');
      return;
    }

    // Cleanup and close modal immediately
    const uploadingVideoName = video_name;
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoName('');
    setFile(null);
    setShowCalibration(false);
    setCalibrationPoints([]);
    setReferencePoints([]);
    setShowReferenceStep(false);
    setReferenceDistance(3);
    setVideoUrl(null);
    onClose();

    // Process in background
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload_and_process/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      
      const data = await response.json();
  
      // Start progress polling if we have a video ID
      if (data.video_id && onProcessingStart) {
        onProcessingStart(uploadingVideoName, data.video_id);
      }
  
      onSubmit({ 
        video_name: uploadingVideoName, 
        file_name, 
        calibration_points: calibrationPoints,
        reference_distance_meters: referenceDistance
      });
      
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      if (onProcessingComplete) {
        onProcessingComplete(uploadingVideoName, false, { error: 'Failed to process video' });
      }
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
              <strong>Step 1: Select 4 Corner Points</strong>
              <br/>Click on the video to select 4 corner points for bird's eye view perspective transformation.
              <br/>Points should be selected in order: <strong>top-left, top-right, bottom-right, bottom-left</strong>.
              {showReferenceStep && (
                <>
                  <br/><br/>
                  <strong>Step 2: Set Scale with Reference Points</strong>
                  <br/>Now click 2 points on a road marking with known width (e.g., lane edges = 3 meters).
                  <br/>⚠️ <strong>Important:</strong> Select markings in the <strong>middle/center</strong> of your calibration area for best accuracy.
                  <br/>Avoid markings that are too close or too far from the camera due to perspective distortion.
                </>
              )}
              <br/><strong>Scroll to zoom</strong>, <strong>Right-click + drag</strong> or <strong>Shift + drag</strong> to pan.
            </DialogContentText>

            <Box sx={{ mb: 2 }}>
              <TextField
                label="Reference Distance (meters)"
                type="number"
                value={referenceDistance}
                onChange={(e) => setReferenceDistance(parseFloat(e.target.value) || 0)}
                fullWidth
                helperText="Enter the real-world distance between your 2 reference points (e.g., lane width = 3m)"
                inputProps={{ min: 0.1, step: 0.5 }}
              />
            </Box>

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
                  cursor: isPanning ? 'grabbing' : 'crosshair',
                  border: '2px solid #ccc',
                  minHeight: '400px'
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {showReferenceStep 
                  ? `Reference Points: ${referencePoints.length}/2 | Zoom: ${zoom.toFixed(1)}x`
                  : `Calibration Points: ${calibrationPoints.length}/4 | Zoom: ${zoom.toFixed(1)}x`
                }
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
                  disabled={calibrationPoints.length === 0 && referencePoints.length === 0}
                  size="small"
                >
                  Reset Points
                </Button>
              </Box>
            </Box>

            {calibrationPoints.length === 4 && referencePoints.length === 2 && (
              <Box sx={{ p: 1.5, bgcolor: 'success.light', borderRadius: 1, opacity: 0.7 }}>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  ✓ All points selected (4 calibration + 2 reference). You can now proceed with the upload.
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
          disabled={showCalibration && !(calibrationPoints.length === 4 && referencePoints.length === 2)}
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

interface EditModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (videoId: number, newName: string) => void;
  videoId: number | null;
  currentName: string;
}

function EditModal({ open, onClose, onSubmit, videoId, currentName }: EditModalProps) {
  const [videoName, setVideoName] = React.useState(currentName);

  React.useEffect(() => {
    setVideoName(currentName);
  }, [currentName, open]);

  const handleSubmit = () => {
    if (!videoName.trim()) {
      alert('Please provide a video name');
      return;
    }
    if (videoId !== null) {
      onSubmit(videoId, videoName.trim());
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Video Name</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        <TextField
          label="Video Name"
          variant="outlined"
          value={videoName}
          onChange={(e) => setVideoName(e.target.value)}
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CustomToolbar({ title, onAdd, onEdit, onDelete, hasSelection } : ToolbarProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
      <Toolbar>
        <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
          {title}
        </Typography>
      
        <ToolbarButton onClick={onAdd}>
          <FileUploadIcon fontSize="small"/>
        </ToolbarButton>
        
        <ToolbarButton onClick={onDelete} disabled={!hasSelection}>
          <DeleteIcon fontSize="small"/>
        </ToolbarButton>

        <ToolbarButton onClick={onEdit} disabled={!hasSelection}>
          <EditIcon fontSize="small"/>
        </ToolbarButton>
      </Toolbar>
  )
}

export default function Table({ onVideoFileSelect, hideUpload = false, cameraId, onUploadComplete, visibleCameraIds = [], onProcessingStart, onProcessingComplete, onVideoSelect, onMultipleVideoSelect }: TableProps) {
  const [handleOpenAddModal, setAddModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const showCameraColumn = cameraId === null && visibleCameraIds.length > 0;

  const columns: GridColDef[] = [
      { field: 'id', headerName: 'ID', width: 60 },
      ...(showCameraColumn ? [{ field: 'camera_id', headerName: 'Camera', width: 80, align: 'center' as const, headerAlign: 'center' as const }] : []),
      { field: 'video_name', headerName: 'Video Name', flex: 1, minWidth: 150 },
      { field: 'uploaded_time', headerName: 'Uploaded', width: 160 },
      { field: 'vehicles', headerName: 'Vehicles', width: 80, align: 'center', headerAlign: 'center' },
      { field: 'signs', headerName: 'Signs', width: 70, align: 'center', headerAlign: 'center' },
      { field: 'speeding', headerName: 'Speeding', width: 85, align: 'center', headerAlign: 'center' },
      { field: 'swerving', headerName: 'Swerving', width: 85, align: 'center', headerAlign: 'center' },
      { field: 'abrupt_stop', headerName: 'Abrupt Stop', width: 100, align: 'center', headerAlign: 'center' },
      { field: 'jeepney_hotspot', headerName: 'Jeepney Hotspot', width: 130, align: 'center', headerAlign: 'center',
        renderCell: (params) => (
          <Box sx={{ 
            color: params.value ? '#4CAF50' : '#666',
            fontWeight: params.value ? 'bold' : 'normal'
          }}>
            {params.value ? 'Yes' : 'No'}
          </Box>
        )
      },
      { field: 'duration', headerName: 'Duration', width: 90, align: 'center', headerAlign: 'center' },
      { field: 'status', headerName: 'Status', width: 100,
        renderCell: (params) => (
          <Box sx={{ 
            color: params.value === 'completed' ? '#4CAF50' : 
                   params.value === 'failed' ? '#f44336' : 
                   params.value === 'processing' ? '#ff9800' : '#666',
            textTransform: 'capitalize'
          }}>
            {params.value}
          </Box>
        )
      },
  ]
  
  const [rows, setRows] = useState<any>([]);
  const [loading, setLoading] = useState(false);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found');
        setRows([]);
        return;
      }

      if (cameraId === null && visibleCameraIds.length > 0) {
        const videoPromises = visibleCameraIds.map(camId =>
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${camId}/videos/`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }).then(res => res.json())
        );

        const results = await Promise.all(videoPromises);
        const allVideos: any[] = [];
        
        results.forEach(data => {
          if (data.success && data.videos) {
            allVideos.push(...data.videos);
          }
        });

        allVideos.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

        const transformedRows = allVideos.map((video: any) => ({
          id: video.id,
          camera_id: video.camera,
          video_name: video.filename,
          uploaded_time: new Date(video.uploaded_at).toLocaleString(),
          vehicles: video.vehicles || 0,
          signs: video.signs || 0,
          speeding: video.speeding_count || 0,
          swerving: video.swerving_count || 0,
          abrupt_stop: video.abrupt_stopping_count || 0,
          jeepney_hotspot: video.jeepney_hotspot || false,
          duration: video.duration_seconds ? `${Math.round(video.duration_seconds)}s` : 'N/A',
          status: video.processing_status || 'pending',
          sign_classes: video.sign_classes || [],
          thumbnail: video.thumbnail || null,
        }));
        setRows(transformedRows);
        setLoading(false);
        return;
      }

      if (cameraId === null) {
        setRows([]);
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/videos/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.videos) {
          const transformedRows = data.videos.map((video: any) => ({
            id: video.id,
            video_name: video.filename,
            uploaded_time: new Date(video.uploaded_at).toLocaleString(),
            vehicles: video.vehicles || 0,
            signs: video.signs || 0,
            speeding: video.speeding_count || 0,
            swerving: video.swerving_count || 0,
            abrupt_stop: video.abrupt_stopping_count || 0,
            jeepney_hotspot: video.jeepney_hotspot || false,
            duration: video.duration_seconds ? `${Math.round(video.duration_seconds)}s` : 'N/A',
            status: video.processing_status || 'pending',
            sign_classes: video.sign_classes || [],
            thumbnail: video.thumbnail || null,
          }));
          setRows(transformedRows);
        }
      } else {
        console.error('Failed to fetch videos:', response.statusText);
        setRows([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const visibleCameraIdsKey = visibleCameraIds.sort((a, b) => a - b).join(',');

  useEffect(() => {
    fetchVideos();
  }, [cameraId, visibleCameraIdsKey]);

  const handleAdd = (data: { video_name: string; file_name: File | null; calibration_points: { x: number; y: number }[] }) => {
    fetchVideos();
  };

  const handleEdit = () => {
    if (selectedRows.length !== 1) {
      alert('Please select exactly one video to edit');
      return;
    }
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (videoId: number, newName: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setSnackbar({ open: true, message: 'Authentication required', severity: 'error' });
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: newName }),
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Video name updated successfully', severity: 'success' });
        fetchVideos();
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        const errorData = await response.json();
        setSnackbar({ open: true, message: errorData.message || 'Failed to update video', severity: 'error' });
      }
    } catch (error) {
      console.error('Error updating video:', error);
      setSnackbar({ open: true, message: 'Error updating video', severity: 'error' });
    }
  };

  const handleDelete = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one video to delete');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setSnackbar({ open: true, message: 'Authentication required', severity: 'error' });
        setDeleteDialogOpen(false);
        return;
      }

      const deletePromises = selectedRows.map(row =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${row.id}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount === selectedRows.length) {
        setSnackbar({ 
          open: true, 
          message: `Successfully deleted ${successCount} video${successCount > 1 ? 's' : ''}`, 
          severity: 'success' 
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: `Deleted ${successCount} of ${selectedRows.length} videos`, 
          severity: 'warning' 
        });
      }

      setDeleteDialogOpen(false);
      setSelectedRows([]);
      fetchVideos();
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Error deleting videos:', error);
      setSnackbar({ open: true, message: 'Error deleting videos', severity: 'error' });
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Box>
      <div className="table-container">
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize:  5} },
          }}
          slots={{
            toolbar: hideUpload ? undefined : () => <CustomToolbar 
              onAdd={() => setAddModalOpen(true)} 
              onEdit={handleEdit}
              onDelete={handleDelete}
              hasSelection={selectedRows.length > 0}
            />,
          }}
          slotProps={{toolbar:
            {title: "Videos"}
          }}
          showToolbar={!hideUpload}
          checkboxSelection
          onRowSelectionModelChange={(newSelection) => {
            const selection: any = newSelection;
            const selectionIds = selection.ids ? Array.from(selection.ids) : [];
            const selectedVideos = rows.filter(row => selectionIds.includes(row.id));
            setSelectedRows(selectedVideos);
            
            if (onMultipleVideoSelect && selectedVideos.length > 1) {
              onMultipleVideoSelect(selectedVideos);
            } else if (onVideoSelect && selectedVideos.length === 1) {
              onVideoSelect(selectedVideos[0]);
            } else if (selectedVideos.length === 0 && onVideoSelect) {
              onVideoSelect(null);
            }
          }}
        />
      </div>
      {!hideUpload && (
        <>
          <AddModal 
            open={handleOpenAddModal} 
            onClose={() => setAddModalOpen(false)} 
            onSubmit={handleAdd} 
            onVideoFileSelect={onVideoFileSelect}
            cameraId={cameraId}
            onUploadComplete={onUploadComplete}
            onProcessingStart={onProcessingStart}
            onProcessingComplete={onProcessingComplete}
          />
          <EditModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSubmit={handleEditSubmit}
            videoId={selectedRows.length === 1 ? selectedRows[0].id : null}
            currentName={selectedRows.length === 1 ? selectedRows[0].video_name : ''}
          />
          <Dialog
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
          >
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete {selectedRows.length} video{selectedRows.length > 1 ? 's' : ''}?
                This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)} color="secondary">
                Cancel
              </Button>
              <Button onClick={handleDeleteConfirm} variant="contained" color="error">
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}