import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import cv2
from ultralytics import YOLO
import numpy as np

MODEL_PATH = 'best_300.pt'
TRACKER_CONFIG = 'bytetrack.yaml'
CONFIDENCE_THRESHOLD = 0.5

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
    # You can adjust these based on your desired output dimensions
    height, width = frame.shape[:2]
    
    # TOP-DOWN VIEW (default): Maps the selected area to full frame
    dst_points = np.float32([
        [0, 0],                    # top-left
        [width - 1, 0],            # top-right
        [width - 1, height - 1],   # bottom-right
        [0, height - 1]            # bottom-left
    ])
    
    # LEFT-RIGHT VIEW (side perspective):
    # dst_points = np.float32([
    #     [0, height - 1],           # top-left -> bottom-left
    #     [0, 0],                    # top-right -> top-left
    #     [width - 1, 0],            # bottom-right -> top-right
    #     [width - 1, height - 1]    # bottom-left -> bottom-right
    # ])
    
    # Calculate perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_points, dst_points)
    
    # Apply the perspective transformation
    transformed_frame = cv2.warpPerspective(frame, matrix, (width, height))
    
    return transformed_frame

def run_detection_on_video(video_path: str, calibration_points=None):
    """
    Run YOLO object detection on video with optional perspective transformation.
    
    Args:
        video_path: Path to the video file
        calibration_points: Optional list of 4 calibration points for perspective transform
    """
    results_summary = {
        "status": "failed",
        "message": "",
        "total_unique": 0,
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

    counted_track_ids = set()
    unique_counts = {}

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if calibration_points:
            frame = apply_perspective_transform(frame, calibration_points)

        results = model.track(source=frame, conf=CONFIDENCE_THRESHOLD,
                              tracker=TRACKER_CONFIG, persist=True, verbose=False)
        result = results[0]
        boxes = result.boxes

        if boxes.id is None:
            continue

        track_ids = boxes.id.cpu().numpy().astype(int)

        for box, track_id in zip(boxes, track_ids):
            if track_id not in counted_track_ids:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                counted_track_ids.add(track_id)
                unique_counts[class_name] = unique_counts.get(class_name, 0) + 1

    cap.release()

    results_summary["status"] = "success"
    results_summary["total_unique"] = len(counted_track_ids)
    results_summary["breakdown"] = unique_counts
    return results_summary