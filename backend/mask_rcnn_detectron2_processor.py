import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import cv2
import torch
import numpy as np
from collections import defaultdict
from django.db import connection

try:
    from detectron2.config import get_cfg
    from detectron2.engine import DefaultPredictor
    from detectron2.model_zoo import model_zoo
    DETECTRON2_AVAILABLE = True
except ImportError:
    DETECTRON2_AVAILABLE = False
    print("[Mask R-CNN] WARNING: Detectron2 not installed. Traffic sign detection will be skipped.", flush=True)
    print("[Mask R-CNN] Install with: pip install detectron2 -f https://dl.fbaipublicfiles.com/detectron2/wheels/cu118/torch2.0/index.html", flush=True)

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, 'traffic_sign.pth')
CONFIDENCE_THRESHOLD = 0.7  
MODEL_DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

# Tracking configuration
IOU_THRESHOLD = 0.3  # IoU threshold for matching signs across frames

# Traffic sign classes based on trained model
TRAFFIC_SIGN_CLASSES = {
    0: 'Background',  
    1: 'Direction Sign',
    2: '100kph Speed Limit Sign',
    3: '60kph Speed Limit Sign',
    4: 'Pedestrian Sign',
    5: 'Dangerous Road Sign',
    6: 'Stop Sign',
    7: '30kph Speed Limit Sign',
    8: '80kph Speed Limit Sign',
    9: '40kph Speed Limit Sign',
    10: 'No Turn Sign',
    11: '50kph Speed Limit Sign',
    12: '15kph Speed Limit Sign',
    13: '10kph Speed Limit Sign',
    14: '20kph Speed Limit Sign',
    15: '25kph Speed Limit Sign'
}

def setup_detectron2_config(model_path=MODEL_PATH, num_classes=16):
    """
    Setup Detectron2 configuration for Mask R-CNN inference.
    
    Args:
        model_path: Path to the trained model weights
        num_classes: Number of classes (15 sign types + 1 background)
    
    Returns:
        cfg: Detectron2 configuration object
    """
    cfg = get_cfg()
    
    cfg.merge_from_file(model_zoo.get_config_file("COCO-InstanceSegmentation/mask_rcnn_R_50_FPN_3x.yaml"))
    
    # Model configuration
    cfg.MODEL.ROI_HEADS.NUM_CLASSES = num_classes - 1  
    cfg.MODEL.WEIGHTS = model_path
    cfg.MODEL.DEVICE = MODEL_DEVICE
    
    cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = CONFIDENCE_THRESHOLD
    cfg.MODEL.ROI_HEADS.NMS_THRESH_TEST = 0.5
    cfg.INPUT.FORMAT = "BGR" 
    
    return cfg

def calculate_iou(box1, box2):
    """
    Calculate Intersection over Union (IoU) between two bounding boxes.
    
    Args:
        box1, box2: [x1, y1, x2, y2] format
    
    Returns:
        iou: Float value between 0 and 1
    """
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    # Calculate intersection area
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    if x2_i < x1_i or y2_i < y1_i:
        return 0.0
    
    intersection_area = (x2_i - x1_i) * (y2_i - y1_i)
    
    # Calculate union area
    box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
    box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
    union_area = box1_area + box2_area - intersection_area
    
    iou = intersection_area / union_area if union_area > 0 else 0.0
    return iou

class SignTracker:
    """Track traffic signs across video frames to count unique signs."""
    
    def __init__(self, iou_threshold=IOU_THRESHOLD):
        self.iou_threshold = iou_threshold
        self.tracked_signs = {}  # {track_id: {'class': str, 'box': [x1,y1,x2,y2]}}
        self.next_track_id = 1
        self.unique_sign_counts = defaultdict(int)
    
    def update(self, detections, frame_idx):
        """
        Update tracker with new frame detections.
        
        Args:
            detections: List of dicts with 'class', 'confidence', 'box'
            frame_idx: Current frame number
        
        Returns:
            matched_track_ids: List of track IDs for current detections
        """
        matched_track_ids = []
        unmatched_detections = list(range(len(detections)))
        unmatched_tracks = list(self.tracked_signs.keys())
        
        # Match current detections with existing tracks
        for det_idx in list(unmatched_detections):
            detection = detections[det_idx]
            best_iou = 0
            best_track_id = None
            
            for track_id in list(unmatched_tracks):
                track = self.tracked_signs[track_id]
                
                # Only match if same class
                if track['class'] != detection['class']:
                    continue
                
                iou = calculate_iou(detection['box'], track['box'])
                
                if iou > self.iou_threshold and iou > best_iou:
                    best_iou = iou
                    best_track_id = track_id
            
            if best_track_id is not None:
                # Update existing track
                self.tracked_signs[best_track_id]['box'] = detection['box']
                matched_track_ids.append(best_track_id)
                unmatched_detections.remove(det_idx)
                unmatched_tracks.remove(best_track_id)
        
        # Create new tracks for unmatched detections
        for det_idx in unmatched_detections:
            detection = detections[det_idx]
            track_id = self.next_track_id
            self.next_track_id += 1
            
            self.tracked_signs[track_id] = {
                'class': detection['class'],
                'box': detection['box'],
                'first_seen': frame_idx
            }
            self.unique_sign_counts[detection['class']] += 1
            matched_track_ids.append(track_id)
        
        return matched_track_ids
    
    def get_unique_counts(self):
        """Get counts of unique signs detected."""
        return dict(self.unique_sign_counts)
    
    def get_total_unique(self):
        """Get total number of unique signs."""
        return sum(self.unique_sign_counts.values())

def run_traffic_sign_detection_on_video(video_path: str, model_path=MODEL_PATH, progress_callback=None, video_record=None):

    print(f"\n{'='*60}", flush=True)
    print(f"[Mask R-CNN] TRAFFIC SIGN DETECTION STARTED", flush=True)
    print(f"[Mask R-CNN] Video: {video_path}", flush=True)
    print(f"[Mask R-CNN] Model: {model_path}", flush=True)
    print(f"[Mask R-CNN] Device: {MODEL_DEVICE}", flush=True)
    print(f"{'='*60}\n", flush=True)
    
    results_summary = {
        "status": "failed",
        "message": "",
        "total_detections": 0,
        "unique_signs": 0,
        "sign_counts": {},
        "frame_detections": [] 
    }
    
    if not DETECTRON2_AVAILABLE:
        results_summary["message"] = "Detectron2 not installed. Please install it to use traffic sign detection."
        print(f"[Mask R-CNN] ERROR: {results_summary['message']}", flush=True)
        return results_summary
    
    if not os.path.exists(video_path):
        results_summary["message"] = f"Video not found: {video_path}"
        print(f"[Mask R-CNN] ERROR: {results_summary['message']}", flush=True)
        return results_summary
    
    if not os.path.exists(model_path):
        results_summary["message"] = f"Model file not found: {model_path}"
        print(f"[Mask R-CNN] ERROR: {results_summary['message']}", flush=True)
        return results_summary
    
    try:
        print(f"[Mask R-CNN] Setting up Detectron2 configuration...", flush=True)
        cfg = setup_detectron2_config(model_path)
        print(f"[Mask R-CNN] Loading model from {model_path}...", flush=True)
        predictor = DefaultPredictor(cfg)
        print(f"[Mask R-CNN] Model loaded successfully on {MODEL_DEVICE}", flush=True)
    except Exception as e:
        results_summary["message"] = f"Model setup failed: {str(e)}"
        print(f"[Mask R-CNN] ERROR: {results_summary['message']}", flush=True)
        import traceback
        traceback.print_exc()
        return results_summary
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        results_summary["message"] = f"Could not open video: {video_path}"
        print(f"[Mask R-CNN] ERROR: {results_summary['message']}", flush=True)
        return results_summary
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"[Mask R-CNN] Processing video...", flush=True)
    print(f"[Mask R-CNN] FPS: {fps}, Total Frames: {total_frames}", flush=True)
    print(f"[Mask R-CNN] video_record provided: {video_record is not None}", flush=True)
    if video_record:
        print(f"[Mask R-CNN] video_record ID: {video_record.id}", flush=True)
    
    # Initialize tracker for unique sign counting
    tracker = SignTracker(iou_threshold=IOU_THRESHOLD)
    
    all_frame_detections = []
    frame_idx = 0
    detection_count = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_idx += 1
        
        # No progress tracking - just process frames
        
        outputs = predictor(frame)
        
        # Extract predictions
        instances = outputs["instances"].to("cpu")
        boxes = instances.pred_boxes.tensor.numpy() if instances.has("pred_boxes") else []
        scores = instances.scores.numpy() if instances.has("scores") else []
        classes = instances.pred_classes.numpy() if instances.has("pred_classes") else []
        
        # Store frame detections
        frame_info = {
            'frame_number': frame_idx,
            'detections': []
        }
        
        # Collect all detections for this frame
        frame_detections = []
        for box, score, cls in zip(boxes, scores, classes):
            detection_count += 1
            class_name = TRAFFIC_SIGN_CLASSES.get(int(cls) + 1, f'class_{int(cls) + 1}')
            
            x1, y1, x2, y2 = box
            detection = {
                'class': class_name,
                'confidence': float(score),
                'box': [int(x1), int(y1), int(x2), int(y2)]
            }
            frame_detections.append(detection)
            frame_info['detections'].append(detection)
        
        # Update tracker with this frames detections
        if frame_detections:
            track_ids = tracker.update(frame_detections, frame_idx)
            
            if frame_idx % 30 == 0:
                for detection, track_id in zip(frame_detections, track_ids):
                    x1, y1, x2, y2 = detection['box']
                    print(f"Frame {frame_idx}: {detection['class']} (ID: {track_id}) at "
                          f"[{x1}, {y1}, {x2}, {y2}] (confidence: {detection['confidence']:.2f})", flush=True)
        
        if frame_info['detections']:
            all_frame_detections.append(frame_info)
        
        # Progress logging only (not saved to DB)
        if frame_idx % 100 == 0:
            progress = min((frame_idx / total_frames) * 100, 100.0) if total_frames > 0 else 0
            print(f"[Mask R-CNN] Progress: {progress:.1f}% ({frame_idx}/{total_frames} frames)", flush=True)
    
    cap.release()
    
    # Get unique sign counts from tracker
    unique_sign_counts = tracker.get_unique_counts()
    total_unique = tracker.get_total_unique()
    
    results_summary["status"] = "success"
    results_summary["total_detections"] = detection_count
    results_summary["unique_signs"] = total_unique
    results_summary["sign_counts"] = unique_sign_counts
    results_summary["frame_detections"] = all_frame_detections
    results_summary["total_frames_processed"] = frame_idx
    
    # Print summary
    print("\n" + "="*60, flush=True)
    print("MASK R-CNN TRAFFIC SIGN DETECTION SUMMARY", flush=True)
    print("="*60, flush=True)
    print(f"Total Frames Processed: {frame_idx}", flush=True)
    print(f"Total Sign Detections (all frames): {detection_count}", flush=True)
    print(f"Unique Signs Identified: {total_unique}", flush=True)
    print(f"\nUnique Sign Type Breakdown:", flush=True)
    for sign_type, count in sorted(unique_sign_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {sign_type}: {count} unique signs", flush=True)
    print("="*60 + "\n", flush=True)
    
    return results_summary

def detect_signs_on_first_frame_of_video(video_path: str, model_path=MODEL_PATH) -> list:

    if not DETECTRON2_AVAILABLE:
        print("[Mask R-CNN] Detectron2 not available for first-frame detection", flush=True)
        return []

    if not os.path.exists(model_path):
        print(f"[Mask R-CNN] Model not found: {model_path}", flush=True)
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[Mask R-CNN] Could not open video for first-frame detection: {video_path}", flush=True)
        return []

    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        print("[Mask R-CNN] Could not read first frame", flush=True)
        return []

    try:
        cfg = setup_detectron2_config(model_path)
        predictor = DefaultPredictor(cfg)
        outputs = predictor(frame)
    except Exception as e:
        print(f"[Mask R-CNN] First-frame detection failed: {e}", flush=True)
        return []

    instances = outputs["instances"].to("cpu")
    classes = instances.pred_classes.numpy() if instances.has("pred_classes") else []

    detected = set()
    for cls in classes:
        class_name = TRAFFIC_SIGN_CLASSES.get(int(cls) + 1)
        if class_name and class_name != "Background":
            detected.add(class_name)

    print(f"[Mask R-CNN] First-frame detected: {sorted(detected)}", flush=True)
    return sorted(detected)


def detect_signs_on_image_bytes(image_bytes: bytes, model_path=MODEL_PATH) -> list:

    if not DETECTRON2_AVAILABLE:
        print("[Mask R-CNN] Detectron2 not available for image-bytes detection", flush=True)
        return []

    if not os.path.exists(model_path):
        print(f"[Mask R-CNN] Model not found: {model_path}", flush=True)
        return []

    import numpy as np
    nparr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        print("[Mask R-CNN] Could not decode image bytes", flush=True)
        return []

    try:
        cfg = setup_detectron2_config(model_path)
        predictor = DefaultPredictor(cfg)
        outputs = predictor(frame)
    except Exception as e:
        print(f"[Mask R-CNN] Image-bytes detection failed: {e}", flush=True)
        return []

    instances = outputs["instances"].to("cpu")
    classes = instances.pred_classes.numpy() if instances.has("pred_classes") else []

    detected = set()
    for cls in classes:
        class_name = TRAFFIC_SIGN_CLASSES.get(int(cls) + 1)
        if class_name and class_name != "Background":
            detected.add(class_name)

    print(f"[Mask R-CNN] Image-bytes detected: {sorted(detected)}", flush=True)
    return sorted(detected)


if __name__ == "__main__":
    video_path = "test_video.mp4"
    
    if DETECTRON2_AVAILABLE:
        results = run_traffic_sign_detection_on_video(video_path)
        
        print("\nFinal Results:")
        print(f"Status: {results['status']}")
        print(f"Total Detections: {results['total_detections']}")
        print(f"Sign Counts: {results['sign_counts']}")
    else:
        print("Detectron2 is not installed. Please install it first.")
