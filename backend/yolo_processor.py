import cv2
import os
from ultralytics import YOLO
import numpy as np

MODEL_PATH = 'best_300.pt'
TRACKER_CONFIG = 'bytetrack.yaml'
CONFIDENCE_THRESHOLD = 0.5

def run_detection_on_video(video_path: str):
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