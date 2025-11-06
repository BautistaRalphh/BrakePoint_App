import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import cv2
from ultralytics import YOLO
import numpy as np
from collections import deque
import math

# --- CONFIGURATION ---
MODEL_PATH = 'best_300.pt'
TRACKER_CONFIG = 'bytetrack.yaml'
CONFIDENCE_THRESHOLD = 0.5

HARDCODED_METER_PER_PIXEL = 0.05  
SPEED_LIMIT_KMH = 60              
MAX_HISTORY = 8                   

class Track:
    def __init__(self, tid, xy, max_history=MAX_HISTORY):
        self.id = int(tid)
        self.history = deque(maxlen=max_history)  
        self.history.append(xy)
        self.missed = 0
        self.is_speeding = False

    def update(self, xy):
        self.history.append(xy)
        self.missed = 0

    def speed_m_s(self, meter_per_pixel, fps):
        p1 = self.history[0]  
        p2 = self.history[-1] 

        if len(self.history) < 2:
             return None

        # Distance in pixels between first and last point in history
        dx = (p2[0] - p1[0])
        dy = (p2[1] - p1[1])
        pixel_dist = math.sqrt(dx * dx + dy * dy)
        
        # Convert to meters
        meters = pixel_dist * meter_per_pixel
        
        # Calculate time difference
        # Time for N points is (N - 1) * (1/fps)
        dt = (len(self.history) - 1) / fps if fps > 0 and len(self.history) > 1 else 1.0
        
        mps = meters / dt
        return mps

def apply_perspective_transform(frame, calibration_points):
    """
    Apply perspective transformation to the frame using the 4 calibration points.
    
    Args:
        frame: The input video frame
        calibration_points: List of 4 dictionaries with x, y coordinates
                           Order: top-left, top-right, bottom-right, bottom-left
    
    Returns:
        Transformed frame with bird's eye view perspective
    """
    if not calibration_points or len(calibration_points) != 4:
        return frame
    
    # Extract source points from calibration
    src_points = np.float32([
        [calibration_points[0]['x'], calibration_points[0]['y']],  # top-left
        [calibration_points[1]['x'], calibration_points[1]['y']],  # top-right
        [calibration_points[2]['x'], calibration_points[2]['y']],  # bottom-right
        [calibration_points[3]['x'], calibration_points[3]['y']]   # bottom-left
    ])
    
    # Define destination points for bird's eye view (rectangular)
    height, width = frame.shape[:2]
    
    # TOP-DOWN VIEW (default): Maps the selected area to full frame
    dst_points = np.float32([
        [0, 0],                    # top-left
        [width - 1, 0],            # top-right
        [width - 1, height - 1],   # bottom-right
        [0, height - 1]            # bottom-left
    ])
    
    # Calculate perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_points, dst_points)
    
    # Apply the perspective transformation
    transformed_frame = cv2.warpPerspective(frame, matrix, (width, height))
    
    return transformed_frame

def run_detection_on_video(video_path: str, calibration_points=None):
    """
    Run YOLO object detection on video with optional perspective transformation and speed calculation.
    """
    results_summary = {
        "status": "failed",
        "message": "",
        "total_unique": 0,
        "total_speeding": 0,
        "breakdown": {}
    }

    if not os.path.exists(video_path):
        results_summary["message"] = f"Video not found: {video_path}"
        return results_summary

    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        results_summary["message"] = f"Model load failed: {str(e)}"
        return results_summary

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        results_summary["message"] = f"Could not open video: {video_path}"
        return results_summary

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30.0 # Default if unknown

    # Map to store our custom track objects {track_id: Track}
    active_tracks = {} 
    
    # Set to track unique IDs that have appeared for total count
    unique_track_ids_seen = set()
    # Set to track unique IDs that have been marked as speeding
    speeding_track_ids = set() 
    unique_counts = {}

    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Apply Perspective Transform
        if calibration_points:
            frame = apply_perspective_transform(frame, calibration_points)

        # Run YOLO Tracking
        results = model.track(source=frame, conf=CONFIDENCE_THRESHOLD,
                              tracker=TRACKER_CONFIG, persist=True, verbose=False)
        result = results[0]
        boxes = result.boxes

        # Update Tracks and Calculate Speed
        current_frame_track_ids = set()
        if boxes.id is not None:
            track_ids = boxes.id.cpu().numpy().astype(int)
            xywh = boxes.xywh.cpu().numpy()
            cls = boxes.cls.cpu().numpy().astype(int)

            for tid, box_data, class_id in zip(track_ids, xywh, cls):
                unique_track_ids_seen.add(tid)
                current_frame_track_ids.add(tid)
                
                # Center point (x, y)
                x_center, y_center, _, _ = box_data
                center = (x_center, y_center)
                class_name = model.names.get(class_id, 'unknown')

                if tid not in active_tracks:
                    # New track found
                    active_tracks[tid] = Track(tid, center)
                    # Count for breakdown only when first seen
                    unique_counts[class_name] = unique_counts.get(class_name, 0) + 1
                else:
                    # Update existing track
                    active_tracks[tid].update(center)

                # Speed Calculation (only after sufficient history)
                current_track = active_tracks[tid]
                speed_m_s = current_track.speed_m_s(HARDCODED_METER_PER_PIXEL, fps)
                
                if speed_m_s is not None:
                    speed_kmh = speed_m_s * 3.6
                    
                    if speed_kmh > SPEED_LIMIT_KMH:
                        current_track.is_speeding = True
                        speeding_track_ids.add(tid)
                        
                    # Print speed for all tracked vehicles frequently, with flush=True
                    if frame_idx % 5 == 0: # Log every 5 frames
                        status = "SPEEDING!" if current_track.is_speeding else ""
                        print(f"Frame {frame_idx}: Track ID {tid} ({class_name}) Speed: {speed_kmh:.2f} km/h {status}", flush=True)

        frame_idx += 1
        
    cap.release()

    results_summary["status"] = "success"
    results_summary["total_unique"] = len(unique_track_ids_seen)
    results_summary["total_speeding"] = len(speeding_track_ids)
    results_summary["breakdown"] = unique_counts
    
    # Print the summary to the console as requested, with flush=True
    print("\n--- YOLO Video Processing Summary ---", flush=True)
    print(f"Total Unique Objects Tracked: {results_summary['total_unique']}", flush=True)
    print(f"Total Unique Speeding Vehicles: {results_summary['total_speeding']}", flush=True)
    print("Class Breakdown:", flush=True)
    for name, count in results_summary['breakdown'].items():
        print(f"- {name}: {count}", flush=True)
    print("-----------------------------------\n", flush=True)

    return results_summary