import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import cv2
from ultralytics import YOLO
import numpy as np
from collections import deque
import math

# --- CONFIGURATION ---
MODEL_PATH = 'vehicles.pt'
TRACKER_CONFIG = 'bytetrack.yaml'
CONFIDENCE_THRESHOLD = 0.5

HARDCODED_METER_PER_PIXEL = 0.1   
SPEED_LIMIT_KMH = 80              # km/h - Realistic highway/main road speed limit
MAX_HISTORY = 15                  
MIN_HISTORY_FOR_SPEED = 5         
MIN_HISTORY_FOR_ACCELERATION = 8  

# Aggressive behavior thresholds
LATERAL_ACCEL_MIN = 4.5           # m/s² (~0.46g) - minimum for aggressive swerving
LATERAL_ACCEL_MAX = 9.0           # m/s² (~0.92g) - maximum for swerving
LONGITUDINAL_ACCEL_THRESHOLD = -5.5  # m/s² (~0.56g) - for abrupt stopping (negative)
MIN_SWERVING_DIRECTION_CHANGES = 3   # Require at least 3 direction changes for swerving

# Sanity check limits
MAX_REALISTIC_SPEED_KMH = 150     # km/h - anything above is likely a tracking error
MAX_REALISTIC_ACCEL = 10.0        # m/s² (~1g) - maximum realistic acceleration/deceleration
MIN_REALISTIC_SPEED_KMH = 5       # km/h - filter out very slow moving objects                   

class Track:
    def __init__(self, tid, xy, max_history=MAX_HISTORY):
        self.id = int(tid)
        self.history = deque(maxlen=max_history)  
        self.history.append(xy)
        self.speed_history = deque(maxlen=10)
        self.lateral_accel_history = deque(maxlen=8)
        self.missed = 0
        self.is_speeding = False
        self.speeding_frames = 0  
        self.is_swerving = False
        self.is_abrupt_stopping = False
        self.abrupt_stop_frames = 0 
        self.aggressive_behaviors = []
        self.heading_angle = None  
        self.is_reversing = False 

    def update(self, xy):
        self.history.append(xy)
        self.missed = 0

    def calculate_instantaneous_speed(self, meter_per_pixel, fps):
        """Calculate speed between consecutive frames"""
        if len(self.history) < 2:
            return None
        
        p1 = list(self.history)[-2]
        p2 = list(self.history)[-1]
        
        dx = (p2[0] - p1[0])
        dy = (p2[1] - p1[1])
        pixel_dist = math.sqrt(dx * dx + dy * dy)
        
        meters = pixel_dist * meter_per_pixel
        dt = 1.0 / fps if fps > 0 else 1.0
        
        return meters / dt

    def speed_m_s(self, meter_per_pixel, fps):
        """Calculate smoothed speed using multiple methods and averaging"""
        if len(self.history) < MIN_HISTORY_FOR_SPEED:
            return None

        speeds = []
        
        # Method 1: Instantaneous speed (frame-to-frame)
        instant_speed = self.calculate_instantaneous_speed(meter_per_pixel, fps)
        if instant_speed is not None:
            speeds.append(instant_speed)
        
        # Method 2: Short window average (last 3-5 frames)
        if len(self.history) >= 3:
            window_size = min(5, len(self.history))
            recent_points = list(self.history)[-window_size:]
            
            total_distance = 0
            for i in range(1, len(recent_points)):
                p1 = recent_points[i-1]
                p2 = recent_points[i]
                dx = (p2[0] - p1[0])
                dy = (p2[1] - p1[1])
                pixel_dist = math.sqrt(dx * dx + dy * dy)
                total_distance += pixel_dist
            
            meters = total_distance * meter_per_pixel
            dt = (window_size - 1) / fps if fps > 0 and window_size > 1 else 1.0
            speeds.append(meters / dt)
        
        # Method 3: Longer window for stability (last 7-10 frames)
        if len(self.history) >= 7:
            window_size = min(10, len(self.history))
            p1 = list(self.history)[-window_size]
            p2 = list(self.history)[-1]
            
            dx = (p2[0] - p1[0])
            dy = (p2[1] - p1[1])
            pixel_dist = math.sqrt(dx * dx + dy * dy)
            
            meters = pixel_dist * meter_per_pixel
            dt = (window_size - 1) / fps if fps > 0 else 1.0
            speeds.append(meters / dt)
        
        if not speeds:
            return None
        
        # Calculate weighted average (more weight to recent methods)
        if len(speeds) == 3:
            current_speed = speeds[0] * 0.3 + speeds[1] * 0.4 + speeds[2] * 0.3
        elif len(speeds) == 2:
            current_speed = speeds[0] * 0.4 + speeds[1] * 0.6
        else:
            current_speed = speeds[0]
        
        # Add to speed history for temporal smoothing
        self.speed_history.append(current_speed)
        
        if len(self.speed_history) >= 3:
            sorted_speeds = sorted(self.speed_history)
            n = len(sorted_speeds)
            if n >= 5:
                trim_count = max(1, n // 5)
                trimmed_speeds = sorted_speeds[trim_count:-trim_count]
            else:
                trimmed_speeds = sorted_speeds
            
            weights = [0.1, 0.15, 0.2, 0.25, 0.3] 
            smoothed_speed = 0
            weight_sum = 0
            
            for i, speed in enumerate(list(self.speed_history)[-5:]):
                if i < len(weights):
                    smoothed_speed += speed * weights[i]
                    weight_sum += weights[i]
            
            if weight_sum > 0:
                smoothed_speed = smoothed_speed / weight_sum
                # Sanity check: filter out unrealistic speeds (likely tracking errors)
                speed_kmh = smoothed_speed * 3.6
                if speed_kmh > MAX_REALISTIC_SPEED_KMH or speed_kmh < MIN_REALISTIC_SPEED_KMH:
                    return None  # Invalid speed, ignore this measurement
                return smoothed_speed
        
        # Final sanity check on current_speed
        speed_kmh = current_speed * 3.6
        if speed_kmh > MAX_REALISTIC_SPEED_KMH or speed_kmh < MIN_REALISTIC_SPEED_KMH:
            return None
        
        return current_speed
    
    def get_velocity_vector(self, meter_per_pixel, fps):
        """Get velocity as a 2D vector (vx, vy) in m/s"""
        if len(self.history) < MIN_HISTORY_FOR_SPEED:
            return None, None
        
        window_size = min(5, len(self.history))
        p1 = list(self.history)[-window_size]
        p2 = list(self.history)[-1]
        
        dx_pixels = p2[0] - p1[0]
        dy_pixels = p2[1] - p1[1]
        
        dx_meters = dx_pixels * meter_per_pixel
        dy_meters = dy_pixels * meter_per_pixel
        
        dt = (window_size - 1) / fps if fps > 0 else 1.0
        
        vx = dx_meters / dt
        vy = dy_meters / dt
        
        # Update heading angle (direction of travel)
        if dx_meters != 0 or dy_meters != 0:
            self.heading_angle = math.atan2(dy_meters, dx_meters)
        
        return vx, vy
    
    def get_heading_degrees(self):
        """Get current heading in degrees (0-360, where 0=East, 90=South, 180=West, 270=North)"""
        if self.heading_angle is None:
            return None
        degrees = math.degrees(self.heading_angle)
        return (degrees + 360) % 360
    
    def is_moving_towards_point(self, target_point, tolerance_degrees=45):
        """
        Check if vehicle is moving towards a specific point (e.g., intersection, crossing)
        
        Args:
            target_point: (x, y) tuple of target location
            tolerance_degrees: How many degrees off-angle is still considered "towards"
        
        Returns:
            Boolean indicating if vehicle is heading towards the point
        """
        if self.heading_angle is None or len(self.history) < 2:
            return False
        
        current_pos = list(self.history)[-1]
        
        # Calculate angle to target
        dx = target_point[0] - current_pos[0]
        dy = target_point[1] - current_pos[1]
        angle_to_target = math.atan2(dy, dx)
        
        # Calculate angular difference
        angle_diff = abs(self.heading_angle - angle_to_target)
        # Normalize to 0-180 degrees
        angle_diff = min(angle_diff, 2 * math.pi - angle_diff)
        angle_diff_degrees = math.degrees(angle_diff)
        
        return angle_diff_degrees <= tolerance_degrees
    
    def detect_reversing(self):
        """
        Detect if vehicle is moving in reverse by comparing heading consistency
        Returns True if vehicle appears to be reversing
        """
        if len(self.history) < 8:
            return False
        
        history_list = list(self.history)
        
        # Check recent movement direction vs longer-term direction
        # Recent movement (last 3 frames)
        recent_p1 = history_list[-3]
        recent_p2 = history_list[-1]
        recent_angle = math.atan2(recent_p2[1] - recent_p1[1], recent_p2[0] - recent_p1[0])
        
        # Longer-term movement (frames 5-8 ago)
        older_p1 = history_list[-8]
        older_p2 = history_list[-5]
        older_angle = math.atan2(older_p2[1] - older_p1[1], older_p2[0] - older_p1[0])
        
        # Calculate angular difference
        angle_diff = abs(recent_angle - older_angle)
        angle_diff = min(angle_diff, 2 * math.pi - angle_diff)
        
        # If direction changed by ~180 degrees, likely reversing
        is_reversed = math.degrees(angle_diff) > 135
        
        if is_reversed:
            self.is_reversing = True
        
        return is_reversed

    
    def calculate_accelerations(self, meter_per_pixel, fps):
        """Calculate longitudinal and lateral accelerations with direction awareness"""
        if len(self.history) < MIN_HISTORY_FOR_ACCELERATION:
            return None, None
        
        history_list = list(self.history)
        n = len(history_list)
        
        idx1 = 0
        idx2 = n // 2
        idx3 = n - 1
        
        p1 = history_list[idx1]
        p2 = history_list[idx2]
        p3 = history_list[idx3]
        
        dt1 = idx2 / fps if fps > 0 else 1.0
        dt2 = (idx3 - idx2) / fps if fps > 0 else 1.0
        
        dx1 = (p2[0] - p1[0]) * meter_per_pixel
        dy1 = (p2[1] - p1[1]) * meter_per_pixel
        vx1 = dx1 / dt1
        vy1 = dy1 / dt1
        v1 = math.sqrt(vx1**2 + vy1**2)
        
        dx2 = (p3[0] - p2[0]) * meter_per_pixel
        dy2 = (p3[1] - p2[1]) * meter_per_pixel
        vx2 = dx2 / dt2
        vy2 = dy2 / dt2
        v2 = math.sqrt(vx2**2 + vy2**2)
        
        if v2 > 0.5: 
            heading = math.atan2(dy2, dx2)
            
            total_dt = dt1 + dt2
            longitudinal_accel = (v2 - v1) / total_dt
            
            dv_x = vx2 - vx1
            dv_y = vy2 - vy1
            
            perpendicular_x = -math.sin(heading)
            perpendicular_y = math.cos(heading)
            lateral_accel = abs((dv_x * perpendicular_x + dv_y * perpendicular_y) / total_dt)
            
            # Sanity check: filter out unrealistic acceleration values (likely tracking errors)
            if abs(longitudinal_accel) > MAX_REALISTIC_ACCEL or abs(lateral_accel) > MAX_REALISTIC_ACCEL:
                return None, None  # Invalid acceleration, likely tracking error
            
            # Check for direction reversal (potential reversing behavior)
            heading_prev = math.atan2(dy1, dx1)
            heading_diff = abs(heading - heading_prev)
            heading_diff = min(heading_diff, 2 * math.pi - heading_diff)
            
            # If heading changed significantly, might be reversing
            if math.degrees(heading_diff) > 135:
                self.is_reversing = True
            
            return longitudinal_accel, lateral_accel
        
        return None, None
    
    def detect_swerving(self, lateral_accel):
        """
        Detect swerving based on rapid changes in lateral acceleration (oscillating pattern)
        True swerving = erratic side-to-side movement, not just turning
        
        Returns True if swerving pattern is detected
        """
        if lateral_accel is None:
            return False
        
        # Filter out unrealistic values before adding to history
        if lateral_accel > MAX_REALISTIC_ACCEL:
            return False
        
        # Add current lateral acceleration to history
        self.lateral_accel_history.append(lateral_accel)
        
        # Need at least 6 samples to detect oscillation pattern
        if len(self.lateral_accel_history) < 6:
            return False
        
        accel_list = list(self.lateral_accel_history)
        
        # Check for oscillating pattern (sign changes in acceleration)
        direction_changes = 0
        for i in range(1, len(accel_list)):
            # Look for changes in direction (positive to negative or vice versa)
            # Use signed lateral acceleration by checking if perpendicular component changes sign
            if i >= 2:
                # Check if middle value is a local extremum (peak or valley)
                prev_val = accel_list[i-2]
                curr_val = accel_list[i-1]
                next_val = accel_list[i]
                
                # Peak (turning one way then the other)
                if (curr_val > prev_val and curr_val > next_val) or \
                   (curr_val < prev_val and curr_val < next_val):
                    direction_changes += 1
        
        # Swerving detected if multiple direction changes with significant magnitude
        avg_magnitude = sum(accel_list) / len(accel_list)
        
        # Require MORE direction changes and HIGHER magnitude for true swerving
        if direction_changes >= MIN_SWERVING_DIRECTION_CHANGES and avg_magnitude >= LATERAL_ACCEL_MIN:
            return True
        
        return False

def calculate_meter_per_pixel(calibration_points, reference_distance_meters, frame_shape, reference_points=None, perspective_matrix=None):
    """
    Calculate the meter-per-pixel scale factor based on reference measurements.
    
    BEST PRACTICE: Reference points should be selected in the MIDDLE/CENTER of the calibration
    area to minimize perspective distortion. Avoid selecting points too close or too far from
    the camera, as they will have different pixel-to-meter ratios due to perspective.
    
    Args:
        calibration_points: List of 4 dictionaries with x, y coordinates (for perspective transform)
        reference_distance_meters: Real-world distance in meters (e.g., lane width = 3m)
        frame_shape: Tuple of (height, width) of the frame
        reference_points: List of 2 dictionaries with x, y coordinates for direct distance measurement
        perspective_matrix: The cv2 perspective transform matrix (if available)
    
    Returns:
        meter_per_pixel: Scale factor for converting pixels to meters
    """
    # Method 1: Two-point reference AFTER perspective transform
    if reference_points and len(reference_points) == 2 and reference_distance_meters and perspective_matrix is not None:
        src_pts = np.float32([[reference_points[0]['x'], reference_points[0]['y']],
                              [reference_points[1]['x'], reference_points[1]['y']]])
        
        transformed_pts = cv2.perspectiveTransform(src_pts.reshape(-1, 1, 2), perspective_matrix)
        
        p1_transformed = transformed_pts[0][0]
        p2_transformed = transformed_pts[1][0]
        
        dx = p2_transformed[0] - p1_transformed[0]
        dy = p2_transformed[1] - p1_transformed[1]
        pixel_distance = math.sqrt(dx * dx + dy * dy)
        
        if pixel_distance > 0:
            meter_per_pixel = reference_distance_meters / pixel_distance
            
            print(f"\n[Calibration - Two-Point Method with Perspective Transform]", flush=True)
            print(f"Reference distance: {reference_distance_meters:.2f} meters", flush=True)
            print(f"Original points: ({reference_points[0]['x']:.1f}, {reference_points[0]['y']:.1f}) → ({reference_points[1]['x']:.1f}, {reference_points[1]['y']:.1f})", flush=True)
            print(f"Transformed points: ({p1_transformed[0]:.1f}, {p1_transformed[1]:.1f}) → ({p2_transformed[0]:.1f}, {p2_transformed[1]:.1f})", flush=True)
            print(f"Pixel distance in bird's eye view: {pixel_distance:.2f} pixels", flush=True)
            print(f"Calculated scale: {meter_per_pixel:.6f} meters/pixel", flush=True)
            
            height, width = frame_shape[:2]
            real_width = width * meter_per_pixel
            real_height = height * meter_per_pixel
            print(f"Frame dimensions in real world: ~{real_width:.2f}m × {real_height:.2f}m\n", flush=True)
            
            return meter_per_pixel
    
    # Method 2: Four-point calibration area 
    if calibration_points and len(calibration_points) == 4 and reference_distance_meters:
        height, width = frame_shape[:2]
        
        avg_pixel_distance = height
        
        meter_per_pixel = reference_distance_meters / avg_pixel_distance
        
        print(f"\n[Calibration - Four-Point Method (Fallback)]", flush=True)
        print(f"Reference distance: {reference_distance_meters:.2f} meters", flush=True)
        print(f"Frame dimensions after transform: {width}x{height} pixels", flush=True)
        print(f"Calculated scale: {meter_per_pixel:.6f} meters/pixel", flush=True)
        print(f"Frame width in real world: ~{width * meter_per_pixel:.2f} meters\n", flush=True)
        
        return meter_per_pixel
    
    # Fallback to hardcoded value
    print(f"\n[Calibration - Using Hardcoded Value]", flush=True)
    print(f"Scale: {HARDCODED_METER_PER_PIXEL} meters/pixel\n", flush=True)
    return HARDCODED_METER_PER_PIXEL

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

def run_detection_on_video(video_path: str, calibration_points=None, reference_distance_meters=None, reference_points=None, progress_callback=None, video_record=None):
    """
    Run YOLO object detection on video with optional perspective transformation and aggressive behavior detection.
    
    Args:
        video_path: Path to the video file
        calibration_points: List of 4 calibration points for perspective transform
        reference_distance_meters: Real-world distance in meters for scale calculation
        reference_points: List of 2 points with known distance (e.g., road marking edges)
        progress_callback: Optional callback function(progress: int) for progress updates
        video_record: Optional Video model instance for database progress updates
    """
    results_summary = {
        "status": "failed",
        "message": "",
        "total_unique": 0,
        "total_speeding": 0,
        "total_swerving": 0,
        "total_abrupt_stopping": 0,
        "breakdown": {},
        "meter_per_pixel": HARDCODED_METER_PER_PIXEL,
        "jeepney_hotspot": False
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
    
    # Calculate accurate meter_per_pixel if calibration data is provided
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    meter_per_pixel = HARDCODED_METER_PER_PIXEL
    perspective_matrix = None
    
    # If we have 4 calibration points, calculate the perspective transform matrix first
    if calibration_points and len(calibration_points) == 4:
        src_points = np.float32([
            [calibration_points[0]['x'], calibration_points[0]['y']],  # top-left
            [calibration_points[1]['x'], calibration_points[1]['y']],  # top-right
            [calibration_points[2]['x'], calibration_points[2]['y']],  # bottom-right
            [calibration_points[3]['x'], calibration_points[3]['y']]   # bottom-left
        ])
        
        dst_points = np.float32([
            [0, 0],
            [frame_width - 1, 0],
            [frame_width - 1, frame_height - 1],
            [0, frame_height - 1]
        ])
        
        perspective_matrix = cv2.getPerspectiveTransform(src_points, dst_points)
        print(f"\n[Perspective Transform] Matrix calculated from 4 calibration points", flush=True)
    
    # Now calculate meter_per_pixel with the perspective matrix (if available)
    if reference_points and len(reference_points) == 2 and reference_distance_meters:
        # Use two-point method with perspective transform
        meter_per_pixel = calculate_meter_per_pixel(
            calibration_points,
            reference_distance_meters,
            (frame_height, frame_width),
            reference_points=reference_points,
            perspective_matrix=perspective_matrix
        )
        results_summary["meter_per_pixel"] = meter_per_pixel
    elif calibration_points and reference_distance_meters:
        # Use four-point method (fallback - less accurate)
        meter_per_pixel = calculate_meter_per_pixel(
            calibration_points, 
            reference_distance_meters,
            (frame_height, frame_width),
            perspective_matrix=perspective_matrix
        )
        results_summary["meter_per_pixel"] = meter_per_pixel
    else:
        print(f"\n[Warning] Using default scale: {HARDCODED_METER_PER_PIXEL} meters/pixel", flush=True)
        print("[Warning] For accurate speed detection, provide calibration and reference points\n", flush=True)

    # Map to store the custom track objects
    active_tracks = {} 
    
    # Set to track unique IDs that have appeared for total count
    unique_track_ids_seen = set()
    # Sets to track unique IDs with aggressive behaviors
    speeding_track_ids = set()
    swerving_track_ids = set()
    abrupt_stopping_track_ids = set()
    unique_counts = {}

    # Get total frame count for progress calculation
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        
        # Update progress every 10 frames
        if total_frames > 0 and frame_idx % 10 == 0:
            progress = min(int((frame_idx / total_frames) * 100), 100)
            if video_record:
                video_record.yolo_progress = progress
                video_record.processing_stage = 'yolo'
                video_record.save(update_fields=['yolo_progress', 'processing_stage'])

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

                # Speed and Acceleration Calculation (only after sufficient history)
                current_track = active_tracks[tid]
                
                # Update velocity vector (which also updates heading angle)
                vx, vy = current_track.get_velocity_vector(meter_per_pixel, fps)
                
                # Calculate speed using calibrated meter_per_pixel
                speed_m_s = current_track.speed_m_s(meter_per_pixel, fps)
                behaviors_detected = []
                
                if speed_m_s is not None:
                    speed_kmh = speed_m_s * 3.6
                    
                    # Check for speeding - require sustained speeding (multiple frames)
                    if speed_kmh > SPEED_LIMIT_KMH:
                        current_track.speeding_frames += 1
                        # Only flag as speeding if sustained for at least 3 frames
                        if current_track.speeding_frames >= 3 and not current_track.is_speeding:
                            current_track.is_speeding = True
                            speeding_track_ids.add(tid)
                            if "Speeding" not in current_track.aggressive_behaviors:
                                current_track.aggressive_behaviors.append("Speeding")
                        if current_track.is_speeding:
                            behaviors_detected.append("SPEEDING")
                    else:
                        # Reset counter if not speeding
                        current_track.speeding_frames = max(0, current_track.speeding_frames - 1)
                
                # Calculate accelerations using calibrated meter_per_pixel
                longitudinal_accel, lateral_accel = current_track.calculate_accelerations(
                    meter_per_pixel, fps
                )
                
                if longitudinal_accel is not None and lateral_accel is not None:
                    # Check for swerving using oscillation detection instead of simple threshold
                    if current_track.detect_swerving(lateral_accel):
                        if not current_track.is_swerving:
                            current_track.is_swerving = True
                            swerving_track_ids.add(tid)
                            if "Swerving" not in current_track.aggressive_behaviors:
                                current_track.aggressive_behaviors.append("Swerving")
                        behaviors_detected.append("SWERVING")
                    
                    # Check for abrupt stopping (negative longitudinal acceleration below threshold)
                    # Require sustained hard braking, not just momentary spike
                    stopping_threshold = LONGITUDINAL_ACCEL_THRESHOLD
                    if current_track.is_reversing:
                        # Reversing vehicles have different acceleration profile
                        stopping_threshold = LONGITUDINAL_ACCEL_THRESHOLD * 1.5
                    
                    if longitudinal_accel < stopping_threshold:
                        current_track.abrupt_stop_frames += 1
                        # Only flag if sustained for at least 2 frames
                        if current_track.abrupt_stop_frames >= 2 and not current_track.is_abrupt_stopping:
                            current_track.is_abrupt_stopping = True
                            abrupt_stopping_track_ids.add(tid)
                            if "Abrupt Stopping" not in current_track.aggressive_behaviors:
                                current_track.aggressive_behaviors.append("Abrupt Stopping")
                        if current_track.is_abrupt_stopping:
                            behaviors_detected.append("ABRUPT STOPPING")
                    else:
                        # Reset counter if not hard braking
                        current_track.abrupt_stop_frames = max(0, current_track.abrupt_stop_frames - 1)
                
                # Detect reversing behavior
                if current_track.detect_reversing():
                    behaviors_detected.append("REVERSING")
                
                # Print detection info periodically with direction information
                if frame_idx % 10 == 0 and (speed_m_s is not None or longitudinal_accel is not None):
                    status_parts = []
                    if speed_m_s is not None:
                        status_parts.append(f"Speed: {speed_kmh:.1f} km/h")
                    
                    # Add heading information
                    heading_deg = current_track.get_heading_degrees()
                    if heading_deg is not None:
                        # Convert to cardinal direction
                        cardinal = ""
                        if 337.5 <= heading_deg or heading_deg < 22.5:
                            cardinal = "E"
                        elif 22.5 <= heading_deg < 67.5:
                            cardinal = "SE"
                        elif 67.5 <= heading_deg < 112.5:
                            cardinal = "S"
                        elif 112.5 <= heading_deg < 157.5:
                            cardinal = "SW"
                        elif 157.5 <= heading_deg < 202.5:
                            cardinal = "W"
                        elif 202.5 <= heading_deg < 247.5:
                            cardinal = "NW"
                        elif 247.5 <= heading_deg < 292.5:
                            cardinal = "N"
                        elif 292.5 <= heading_deg < 337.5:
                            cardinal = "NE"
                        status_parts.append(f"Heading: {cardinal} ({heading_deg:.1f}°)")
                    
                    if longitudinal_accel is not None:
                        status_parts.append(f"Long Accel: {longitudinal_accel:.2f} m/s²")
                    if lateral_accel is not None:
                        status_parts.append(f"Lat Accel: {lateral_accel:.2f} m/s²")
                    
                    behavior_str = " | ".join(behaviors_detected) if behaviors_detected else "Normal"
                    status_line = f"Frame {frame_idx}: ID {tid} ({class_name}) - {' | '.join(status_parts)} [{behavior_str}]"
                    print(status_line, flush=True)
        
    cap.release()

    # Set final progress to 100% when YOLO processing is complete
    if video_record:
        video_record.yolo_progress = 100
        video_record.processing_stage = 'yolo'
        video_record.save(update_fields=['yolo_progress', 'processing_stage'])

    # Check for jeepney hotspot (>15 jeepneys detected)
    jeepney_count = unique_counts.get('jeepney', 0)
    is_jeepney_hotspot = jeepney_count > 15

    results_summary["status"] = "success"
    results_summary["total_unique"] = len(unique_track_ids_seen)
    results_summary["total_speeding"] = len(speeding_track_ids)
    results_summary["total_swerving"] = len(swerving_track_ids)
    results_summary["total_abrupt_stopping"] = len(abrupt_stopping_track_ids)
    results_summary["breakdown"] = unique_counts
    results_summary["meter_per_pixel"] = meter_per_pixel
    results_summary["jeepney_hotspot"] = is_jeepney_hotspot
    
    # Print the summary to the console as requested
    print("\n" + "="*60, flush=True)
    print("YOLO VIDEO PROCESSING SUMMARY", flush=True)
    print("="*60, flush=True)
    print(f"Scale Factor: {meter_per_pixel:.6f} meters/pixel", flush=True)
    print(f"Total Unique Objects Tracked: {results_summary['total_unique']}", flush=True)
    print(f"\nAggressive Behaviors Detected:", flush=True)
    print(f"  • Speeding (>{SPEED_LIMIT_KMH} km/h): {results_summary['total_speeding']} vehicles", flush=True)
    print(f"  • Swerving ({LATERAL_ACCEL_MIN}-{LATERAL_ACCEL_MAX} m/s²): {results_summary['total_swerving']} vehicles", flush=True)
    print(f"  • Abrupt Stopping (<{LONGITUDINAL_ACCEL_THRESHOLD} m/s²): {results_summary['total_abrupt_stopping']} vehicles", flush=True)
    print(f"\nJeepney Hotspot: {'YES' if is_jeepney_hotspot else 'NO'} ({jeepney_count} jeepneys detected)", flush=True)
    print(f"\nClass Breakdown:", flush=True)
    for name, count in results_summary['breakdown'].items():
        print(f"  • {name}: {count}", flush=True)
    print("="*60 + "\n", flush=True)

    return results_summary