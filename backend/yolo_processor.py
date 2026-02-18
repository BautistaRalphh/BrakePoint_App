import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import cv2
from ultralytics import YOLO
import numpy as np
from collections import defaultdict, deque, Counter
import math

# --- CONFIGURATION ---
MODEL_PATH = 'vehicles.pt'
PRETRAINED_MODEL_PATH = 'yolov8m.pt'
TRACKER_CONFIG = 'bytetrack.yaml'
CONFIDENCE_THRESHOLD = 0.25
YOLO_IMGSZ = 1280

HARDCODED_METER_PER_PIXEL = 0.1
SPEED_LIMIT_KMH = 80

# Speed estimation parameters
MAX_REALISTIC_SPEED_KMH = 150
MIN_REALISTIC_SPEED_KMH = 5
MIN_HISTORY_FOR_SPEED = 15
MIN_DISTANCE_TRAVELED_METERS = 10
MAX_FRAME_GAP = 15
SPEED_CORRECTION_FACTOR = 1.36
MIN_R_SQUARED = 0.90
MEAN_ERROR_PERCENT = 3.29

# Motorcycle-specific parameters
MOTORCYCLE_MIN_HISTORY_FOR_SPEED = 8
MOTORCYCLE_MIN_DISTANCE_METERS = 5
MOTORCYCLE_MIN_R_SQUARED = 0.80
MOTORCYCLE_MAX_FRAME_GAP = 25
MOTORCYCLE_STITCH_GAP_FRAMES = 45
MOTORCYCLE_STITCH_SPATIAL_DIST = 200
MOTORCYCLE_KALMAN_PROCESS_NOISE = 0.35
MOTORCYCLE_KALMAN_MEASUREMENT_NOISE = 0.3
MOTORCYCLE_IOU_DEDUP = 0.35
MOTORCYCLE_CONF_THRESHOLD = 0.08

# Behavior detection thresholds
ABRUPT_STOP_DECEL_THRESHOLD = 8.0
SWERVE_LATERAL_THRESHOLD = 0.5

# Detection enhancement (only used in hybrid mode)
FAR_FIELD_BOOST = True
MID_FIELD_BOOST = True

# Class mappings
CUSTOM_CLASS_MAPPING = {0: "Bus", 1: "Car", 2: "Jeepney", 3: "Motorcycle", 4: "Truck"}
YOLO_TO_STANDARD_MAPPING = {"bus": "Bus", "car": "Car", "motorcycle": "Motorcycle", "truck": "Truck"}


# ============================================================================
# Track class with Kalman filtering
# ============================================================================

class Track:
    def __init__(self, tid, xy, class_name, max_history=300):
        self.id = int(tid)
        self.class_name = class_name
        self.class_history = [class_name]
        self.box_sizes = []
        self.history = deque(maxlen=max_history)
        self.history.append((0, xy[0], xy[1]))
        self.raw_history = deque(maxlen=max_history)
        self.raw_history.append((0, xy[0], xy[1]))
        self.ground_history = deque(maxlen=max_history)
        self.ground_history.append((0, xy[0], xy[1]))
        self.speed_history = deque(maxlen=10)
        self.missed = 0
        self.last_seen_frame = 0

        # Kalman filter for position smoothing
        self.kalman = cv2.KalmanFilter(4, 2)
        self.kalman.measurementMatrix = np.array(
            [[1, 0, 0, 0], [0, 1, 0, 0]], np.float32)
        self.kalman.transitionMatrix = np.array(
            [[1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]], np.float32)

        is_mc = (class_name == "Motorcycle")
        pn = MOTORCYCLE_KALMAN_PROCESS_NOISE if is_mc else 0.03
        mn = MOTORCYCLE_KALMAN_MEASUREMENT_NOISE if is_mc else 2.0

        self.kalman.processNoiseCov = np.eye(4, dtype=np.float32) * pn
        self.kalman.measurementNoiseCov = np.eye(2, dtype=np.float32) * mn
        self.kalman.errorCovPost = np.eye(4, dtype=np.float32)
        self.kalman.statePost = np.array([[xy[0]], [xy[1]], [0], [0]], np.float32)

    def is_motorcycle(self):
        return self.get_majority_class() == "Motorcycle"

    def update(self, frame_id, xy, class_name=None, box_size=None, ground_xy=None):
        self.raw_history.append((frame_id, xy[0], xy[1]))
        if ground_xy is not None:
            self.ground_history.append((frame_id, ground_xy[0], ground_xy[1]))
        else:
            self.ground_history.append((frame_id, xy[0], xy[1]))
        self.kalman.predict()
        self.kalman.correct(np.array([[xy[0]], [xy[1]]], np.float32))
        state = self.kalman.statePost
        self.history.append((frame_id, float(state[0][0]), float(state[1][0])))
        if class_name:
            self.class_history.append(class_name)
        if box_size:
            self.box_sizes.append(box_size)
        self.last_seen_frame = frame_id
        self.missed = 0

    def get_majority_class(self):
        if not self.class_history:
            return self.class_name
        return Counter(self.class_history).most_common(1)[0][0]

    def get_corrected_class(self):
        return self.get_majority_class()

    def is_track_continuous(self, max_gap=None):
        if len(self.history) < 2:
            return False
        if max_gap is None:
            max_gap = MAX_FRAME_GAP
        history_list = list(self.history)
        for i in range(1, len(history_list)):
            if history_list[i][0] - history_list[i - 1][0] > max_gap:
                return False
        return True

    def get_total_distance(self):
        if len(self.history) < 2:
            return 0
        h = list(self.history)
        dx = h[-1][1] - h[0][1]
        dy = h[-1][2] - h[0][2]
        return np.sqrt(dx * dx + dy * dy)

    def get_average_movement_per_frame(self):
        if len(self.history) < 2:
            return 0
        total = 0
        h = list(self.history)
        for i in range(1, len(h)):
            dx = h[i][1] - h[i - 1][1]
            dy = h[i][2] - h[i - 1][2]
            total += np.sqrt(dx * dx + dy * dy)
        return total / (len(h) - 1)


# ============================================================================
# Helper functions
# ============================================================================

def get_tracking_point(box):
    """Get center point and box size from xyxy box."""
    x1, y1, x2, y2 = box
    return (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1, y2 - y1)


def get_ground_point(box):
    """Get bottom-center point from xyxy box (ground contact point)."""
    x1, y1, x2, y2 = box
    return (x1 + x2) / 2, y2


def calculate_iou(box1, box2):
    """Calculate IoU between two xyxy boxes."""
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2
    ix_min = max(x1_min, x2_min)
    iy_min = max(y1_min, y2_min)
    ix_max = min(x1_max, x2_max)
    iy_max = min(y1_max, y2_max)
    if ix_max < ix_min or iy_max < iy_min:
        return 0.0
    inter = (ix_max - ix_min) * (iy_max - iy_min)
    union = ((x1_max - x1_min) * (y1_max - y1_min) +
             (x2_max - x2_min) * (y2_max - y2_min) - inter)
    return inter / union if union > 0 else 0.0


# ============================================================================
# Vehicle Tracker
# ============================================================================

class VehicleTracker:
    def __init__(self, max_frames=300):
        self.tracks = {}
        self.max_frames = max_frames
        self.track_boxes = {}

    def cleanup_stale_tracks(self, current_frame_id, max_age=30):
        stale = [tid for tid, t in self.tracks.items()
                 if current_frame_id - t.last_seen_frame > max_age]
        for tid in stale:
            del self.tracks[tid]
            self.track_boxes.pop(tid, None)
        return len(stale)

    def update(self, frame_id, detections):
        # Deduplicate overlapping detections
        filtered = []
        for det in detections:
            is_dup = False
            det_box = det.get('box')
            det_is_mc = (det.get('class_name') == "Motorcycle")
            if det_box is not None:
                for j, other in enumerate(filtered):
                    other_box = other.get('box')
                    if other_box is not None:
                        iou = calculate_iou(det_box, other_box)
                        other_is_mc = (other.get('class_name') == "Motorcycle")
                        threshold = MOTORCYCLE_IOU_DEDUP if (det_is_mc or other_is_mc) else 0.5
                        if iou > threshold:
                            if det['track_id'] in self.tracks:
                                filtered[j] = det
                            is_dup = True
                            break
            if not is_dup:
                filtered.append(det)

        for det in filtered:
            tid = det['track_id']
            xy = (det['center_x'], det['center_y'])
            ground_xy = det.get('ground_xy')
            cls = det['class_name']
            bsz = det.get('box_size')
            if tid not in self.tracks:
                t = Track(tid, xy, cls, self.max_frames)
                if t.history:
                    t.history[0] = (frame_id, xy[0], xy[1])
                if t.raw_history:
                    t.raw_history[0] = (frame_id, xy[0], xy[1])
                if t.ground_history:
                    gxy = ground_xy if ground_xy else xy
                    t.ground_history[0] = (frame_id, gxy[0], gxy[1])
                if bsz:
                    t.box_sizes.append(bsz)
                t.last_seen_frame = frame_id
                self.tracks[tid] = t
            else:
                self.tracks[tid].update(frame_id, xy, cls, bsz, ground_xy=ground_xy)
            if det.get('box') is not None:
                self.track_boxes[tid] = det['box']


# ============================================================================
# Speed Estimation via Linear Fit
# ============================================================================

def calculate_speed_linear_fit(raw_positions, transformation_matrix, pixels_per_meter, fps,
                               min_r_squared=None):
    """
    Calculate speed using linear regression on perspective-transformed positions.
    Projects positions onto dominant travel direction and fits a line.
    Includes iterative outlier removal for robustness.
    """
    if min_r_squared is None:
        min_r_squared = MIN_R_SQUARED
    n = len(raw_positions)
    if n < 10:
        return None

    # Trim edges (start/end often have tracking noise)
    trim = max(2, n // 10)
    trimmed = list(raw_positions)[trim:-trim] if (2 * trim) < n else list(raw_positions)
    if len(trimmed) < 5:
        return None

    H = transformation_matrix
    scale = 1.0 / pixels_per_meter

    frames, world_x, world_y = [], [], []
    for fid, x, y in trimmed:
        tp = cv2.perspectiveTransform(
            np.array([[[x, y]]], dtype=np.float32), H)[0][0]
        frames.append(fid)
        world_x.append(float(tp[0]) * scale)
        world_y.append(float(tp[1]) * scale)

    frames = np.array(frames, dtype=np.float64)
    wx = np.array(world_x, dtype=np.float64)
    wy = np.array(world_y, dtype=np.float64)
    times = frames / fps

    # Project onto dominant travel direction
    direction = np.array([wx[-1] - wx[0], wy[-1] - wy[0]])
    dir_norm = np.linalg.norm(direction)
    if dir_norm < 0.5:
        return None
    direction = direction / dir_norm

    positions = wx * direction[0] + wy * direction[1]

    # Iterative outlier removal: fit, remove points > 2.5 sigma residual, refit.
    min_keep = max(5, int(len(positions) * 0.6))
    mask = np.ones(len(positions), dtype=bool)
    for _iter in range(2):
        t_sel = times[mask]
        p_sel = positions[mask]
        if len(p_sel) < min_keep:
            break
        try:
            c = np.polyfit(t_sel, p_sel, 1)
        except (np.linalg.LinAlgError, ValueError):
            break
        residuals = np.abs(positions - np.polyval(c, times))
        sigma = np.std(residuals[mask])
        if sigma < 1e-6:
            break
        new_mask = residuals < 2.5 * sigma
        if np.sum(new_mask) < min_keep:
            break
        if np.array_equal(mask, new_mask):
            break
        mask = new_mask

    t_clean = times[mask]
    p_clean = positions[mask]
    if len(p_clean) < 5:
        return None

    try:
        coefficients = np.polyfit(t_clean, p_clean, 1)
    except (np.linalg.LinAlgError, ValueError):
        return None

    velocity_ms = abs(coefficients[0])
    predicted = np.polyval(coefficients, t_clean)
    ss_res = np.sum((p_clean - predicted) ** 2)
    ss_tot = np.sum((p_clean - np.mean(p_clean)) ** 2)
    r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 1e-9 else 0.0

    if r_squared < min_r_squared:
        return None

    total_distance_m = dir_norm
    frame_diff = int(frames[-1] - frames[0])

    path_distance = sum(
        math.sqrt((wx[i] - wx[i - 1]) ** 2 + (wy[i] - wy[i - 1]) ** 2)
        for i in range(1, len(wx))
    )
    straightness = total_distance_m / path_distance if path_distance > 0 else 0

    speed_kmh = velocity_ms * 3.6 * SPEED_CORRECTION_FACTOR
    velocity_ms *= SPEED_CORRECTION_FACTOR

    return {
        'speed_ms': velocity_ms, 'speed_kmh': speed_kmh,
        'distance_m': total_distance_m, 'path_distance_m': path_distance,
        'r_squared': r_squared, 'straightness': straightness, 'frames': frame_diff
    }


# ============================================================================
# Behavior Detection (Post-processing)
# ============================================================================

def detect_abrupt_stop(raw_positions, transformation_matrix, pixels_per_meter, fps,
                       decel_threshold=ABRUPT_STOP_DECEL_THRESHOLD):
    """Detect abrupt stopping by analyzing speed changes across sliding windows."""
    n = len(raw_positions)
    if n < 15:
        return {'abrupt_stop': False, 'max_decel_ms2': 0.0, 'stop_frame': None}

    H = transformation_matrix
    scale = 1.0 / pixels_per_meter

    world = []
    for fid, x, y in raw_positions:
        tp = cv2.perspectiveTransform(
            np.array([[[x, y]]], dtype=np.float32), H)[0][0]
        world.append((fid, float(tp[0]) * scale, float(tp[1]) * scale))

    win = max(5, n // 8)
    window_speeds = []
    for start in range(0, len(world) - win + 1, max(1, win // 2)):
        seg = world[start:start + win]
        dx = seg[-1][1] - seg[0][1]
        dy = seg[-1][2] - seg[0][2]
        dist = math.sqrt(dx * dx + dy * dy)
        dt = (seg[-1][0] - seg[0][0]) / fps
        if dt > 0:
            window_speeds.append((seg[win // 2][0], dist / dt))

    if len(window_speeds) < 2:
        return {'abrupt_stop': False, 'max_decel_ms2': 0.0, 'stop_frame': None}

    max_decel = 0.0
    stop_frame = None
    is_abrupt = False

    for i in range(1, len(window_speeds)):
        dt = (window_speeds[i][0] - window_speeds[i - 1][0]) / fps
        if dt <= 0:
            continue
        speed_before = window_speeds[i - 1][1]
        speed_after = window_speeds[i][1]
        decel = (speed_before - speed_after) / dt
        if decel > max_decel:
            max_decel = decel
            stop_frame = int(window_speeds[i][0])
        if (not is_abrupt and decel >= decel_threshold and
                speed_before > 1.0 and speed_after < speed_before * 0.50 and speed_after < 5.0):
            is_abrupt = True

    # Cap unrealistic values (tracking errors)
    if max_decel > 30.0:
        is_abrupt = False
        max_decel = min(max_decel, 30.0)

    return {'abrupt_stop': is_abrupt, 'max_decel_ms2': round(max_decel, 2), 'stop_frame': stop_frame}


def detect_swerving(raw_positions, transformation_matrix, pixels_per_meter,
                    lateral_threshold=SWERVE_LATERAL_THRESHOLD, min_direction_changes=3):
    """Detect swerving by analyzing heading oscillation and lateral deviation from path."""
    n = len(raw_positions)
    if n < 10:
        return {'swerving': False, 'max_lateral_m': 0.0, 'direction_changes': 0, 'swerve_frame': None}

    H = transformation_matrix
    scale = 1.0 / pixels_per_meter

    frames, wx, wy = [], [], []
    for fid, x, y in raw_positions:
        tp = cv2.perspectiveTransform(
            np.array([[[x, y]]], dtype=np.float32), H)[0][0]
        frames.append(fid)
        wx.append(float(tp[0]) * scale)
        wy.append(float(tp[1]) * scale)

    wx = np.array(wx, dtype=np.float64)
    wy = np.array(wy, dtype=np.float64)

    # Compute headings
    step = max(1, min(3, n // 20))
    headings, heading_frames = [], []
    for i in range(step, n):
        dx = wx[i] - wx[i - step]
        dy = wy[i] - wy[i - step]
        if math.sqrt(dx * dx + dy * dy) < 0.15:
            continue
        headings.append(math.atan2(dy, dx))
        heading_frames.append(frames[i])

    if len(headings) < 5:
        return {'swerving': False, 'max_lateral_m': 0.0, 'direction_changes': 0, 'swerve_frame': None}

    headings = np.array(headings)
    heading_frames = np.array(heading_frames)

    # Smooth headings (circular moving average)
    k = max(3, min(7, len(headings) // 8))
    if k % 2 == 0:
        k += 1
    pad = k // 2
    h_padded = np.pad(headings, pad, mode='edge')
    sin_s = np.convolve(np.sin(h_padded), np.ones(k) / k, mode='valid')[:len(headings)]
    cos_s = np.convolve(np.cos(h_padded), np.ones(k) / k, mode='valid')[:len(headings)]
    headings_smooth = np.arctan2(sin_s, cos_s)

    delta_heading = np.diff(headings_smooth)
    delta_heading = (delta_heading + np.pi) % (2 * np.pi) - np.pi

    # Count significant direction reversals
    min_swing_rad = math.radians(10.0)
    significant_reversals = 0
    cum_swing = 0.0
    last_sign = 1 if delta_heading[0] >= 0 else -1
    worst_frame = heading_frames[0]
    max_swing = 0.0

    for i in range(len(delta_heading)):
        cur_sign = 1 if delta_heading[i] >= 0 else -1
        cum_swing += abs(delta_heading[i])
        if cur_sign != last_sign:
            if cum_swing >= min_swing_rad:
                significant_reversals += 1
                if cum_swing > max_swing:
                    max_swing = cum_swing
                    worst_frame = int(heading_frames[min(i + 1, len(heading_frames) - 1)])
            cum_swing = 0.0
            last_sign = cur_sign

    # Compute lateral deviation from smoothed path
    smooth_k = max(5, n // 5)
    if smooth_k % 2 == 0:
        smooth_k += 1
    sp = smooth_k // 2
    wx_s = np.convolve(np.pad(wx, sp, mode='edge'),
                       np.ones(smooth_k) / smooth_k, mode='valid')[:n]
    wy_s = np.convolve(np.pad(wy, sp, mode='edge'),
                       np.ones(smooth_k) / smooth_k, mode='valid')[:n]
    lateral_devs = np.sqrt((wx - wx_s) ** 2 + (wy - wy_s) ** 2)
    max_lat = float(np.max(lateral_devs))
    peak_lat_frame = int(frames[int(np.argmax(lateral_devs))])

    swerve_frame = worst_frame if significant_reversals >= min_direction_changes else peak_lat_frame

    # Reject implausibly large lateral deviations (tracking errors)
    if max_lat > 10.0:
        max_lat = 0.0
        significant_reversals = 0

    is_swerving = (significant_reversals >= min_direction_changes and max_lat >= lateral_threshold)

    return {
        'swerving': is_swerving, 'max_lateral_m': round(max_lat, 3),
        'direction_changes': significant_reversals, 'swerve_frame': swerve_frame
    }


def detect_speeding(speed_kmh, speed_limit_kmh, error_pct=MEAN_ERROR_PERCENT):
    """Detect speeding accounting for measurement error margin."""
    lower_bound = speed_limit_kmh * (1.0 - error_pct / 100.0)
    over = speed_kmh - speed_limit_kmh
    within_margin = (speed_kmh >= lower_bound and speed_kmh < speed_limit_kmh)
    return {
        'speeding': speed_kmh >= lower_bound,
        'margin_kmh': round(over, 2),
        'within_error_margin': within_margin
    }


# ============================================================================
# Post-processing: Track Merging and Filtering helpers
# ============================================================================

def _track_direction(raw):
    """Get the overall direction angle of a track."""
    if len(raw) < 3:
        return None
    n = len(raw)
    q = max(1, n // 4)
    x1 = np.mean([p[1] for p in raw[:q]])
    y1 = np.mean([p[2] for p in raw[:q]])
    x2 = np.mean([p[1] for p in raw[-q:]])
    y2 = np.mean([p[2] for p in raw[-q:]])
    dx, dy = x2 - x1, y2 - y1
    if math.sqrt(dx * dx + dy * dy) < 5.0:
        return None
    return math.atan2(dy, dx)


def _directions_compatible(dir_a, dir_b, max_angle_deg=60.0):
    """Check if two directions are compatible (within max_angle_deg)."""
    if dir_a is None or dir_b is None:
        return True
    diff = abs(dir_a - dir_b)
    diff = min(diff, 2 * math.pi - diff)
    return diff <= math.radians(max_angle_deg)


def _velocity_at_edge(raw, at_end=True, window=5):
    """Get velocity vector at the start or end of a track."""
    if len(raw) < window:
        return None
    seg = list(raw)[-window:] if at_end else list(raw)[:window]
    dt = seg[-1][0] - seg[0][0]
    if dt <= 0:
        return None
    dx = seg[-1][1] - seg[0][1]
    dy = seg[-1][2] - seg[0][2]
    return (dx / dt, dy / dt)


def _velocities_compatible(vel_a, vel_b, max_speed_ratio=2.5):
    """Check if two velocity vectors are compatible for merging."""
    if vel_a is None or vel_b is None:
        return True
    sa = math.sqrt(vel_a[0] ** 2 + vel_a[1] ** 2)
    sb = math.sqrt(vel_b[0] ** 2 + vel_b[1] ** 2)
    if sa < 0.5 or sb < 0.5:
        return True
    ratio = max(sa, sb) / min(sa, sb)
    if ratio > max_speed_ratio:
        return False
    dot = vel_a[0] * vel_b[0] + vel_a[1] * vel_b[1]
    cos_angle = dot / (sa * sb)
    return cos_angle > 0.5


def _predict_position(raw, dt_frames, at_end=True):
    """Predict where a track would be after dt_frames using edge velocity."""
    vel = _velocity_at_edge(raw, at_end=at_end)
    if vel is None:
        return None
    if at_end:
        last = raw[-1]
        return (last[1] + vel[0] * dt_frames, last[2] + vel[1] * dt_frames)
    else:
        first = raw[0]
        return (first[1] - vel[0] * dt_frames, first[2] - vel[1] * dt_frames)


def _match_to_existing_track(tracker, cx, cy, class_name, current_frame,
                              max_dist=120, max_age=15):
    """Find the closest existing track matching class and proximity."""
    best_tid, best_dist = None, float('inf')
    for tid, track in tracker.tracks.items():
        if track.get_corrected_class() != class_name:
            continue
        if current_frame - track.last_seen_frame > max_age:
            continue
        if not track.raw_history:
            continue
        last = track.raw_history[-1]
        dx, dy = cx - last[1], cy - last[2]
        d = math.sqrt(dx * dx + dy * dy)
        if d < max_dist and d < best_dist:
            best_dist, best_tid = d, tid
    return best_tid


# ============================================================================
# Post-processing: Track Merging
# ============================================================================

def merge_fragmented_tracks(tracker, max_gap_frames=60, max_spatial_dist=200,
                            overlap_max_dist=80):
    """Merge fragmented tracks that likely belong to the same vehicle using union-find."""
    if len(tracker.tracks) < 2:
        return 0

    fragments = {}
    for tid, track in tracker.tracks.items():
        raw = list(track.raw_history)
        if len(raw) < 2:
            continue
        direction = _track_direction(raw)
        fragments[tid] = {
            'first_frame': raw[0][0], 'last_frame': raw[-1][0],
            'start_pos': (raw[0][1], raw[0][2]),
            'end_pos': (raw[-1][1], raw[-1][2]),
            'n_frames': len(raw), 'class': track.get_corrected_class(),
            'direction': direction, 'raw': raw,
        }

    sorted_tids = sorted(fragments.keys(), key=lambda t: fragments[t]['first_frame'])
    parent = {tid: tid for tid in sorted_tids}
    rank = {tid: 0 for tid in sorted_tids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if rank[ra] < rank[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        if rank[ra] == rank[rb]:
            rank[ra] += 1

    for i, tid_a in enumerate(sorted_tids):
        fa = fragments[tid_a]
        for j in range(i + 1, len(sorted_tids)):
            tid_b = sorted_tids[j]
            fb = fragments[tid_b]
            if fa['class'] != fb['class']:
                continue
            if not _directions_compatible(fa['direction'], fb['direction'],
                                          max_angle_deg=60.0):
                continue

            merged = False
            frame_gap = fb['first_frame'] - fa['last_frame']

            # Gap-based merge
            if -5 <= frame_gap <= max_gap_frames:
                dx = fa['end_pos'][0] - fb['start_pos'][0]
                dy = fa['end_pos'][1] - fb['start_pos'][1]
                raw_dist = math.sqrt(dx * dx + dy * dy)

                vel_a = _velocity_at_edge(fa['raw'], at_end=True)
                vel_b = _velocity_at_edge(fb['raw'], at_end=False)
                if not _velocities_compatible(vel_a, vel_b):
                    continue

                predicted = _predict_position(fa['raw'], max(0, frame_gap), at_end=True)
                if predicted is not None:
                    pdx = predicted[0] - fb['start_pos'][0]
                    pdy = predicted[1] - fb['start_pos'][1]
                    pred_dist = math.sqrt(pdx * pdx + pdy * pdy)
                    use_dist = min(raw_dist, pred_dist)
                else:
                    use_dist = raw_dist

                if use_dist <= max_spatial_dist:
                    union(tid_a, tid_b)
                    merged = True

            # Overlap-based merge
            if not merged:
                ov_start = max(fa['first_frame'], fb['first_frame'])
                ov_end = min(fa['last_frame'], fb['last_frame'])
                if ov_end >= ov_start:
                    raw_a = list(tracker.tracks[tid_a].raw_history)
                    raw_b = list(tracker.tracks[tid_b].raw_history)
                    n_close = 0
                    n_checked = 0
                    for fa_entry in raw_a:
                        if fa_entry[0] < ov_start or fa_entry[0] > ov_end:
                            continue
                        for fb_entry in raw_b:
                            if abs(fa_entry[0] - fb_entry[0]) <= 1:
                                dx = fa_entry[1] - fb_entry[1]
                                dy = fa_entry[2] - fb_entry[2]
                                n_checked += 1
                                if math.sqrt(dx * dx + dy * dy) <= overlap_max_dist:
                                    n_close += 1
                                break
                    if n_checked >= 3 and n_close / n_checked >= 0.6:
                        union(tid_a, tid_b)

    groups = defaultdict(list)
    for tid in sorted_tids:
        groups[find(tid)].append(tid)

    n_removed = 0
    for root, members in groups.items():
        if len(members) <= 1:
            continue
        if len(members) > 4:
            print(f"  WARNING: skipping suspicious merge of {len(members)} tracks: "
                  f"{members}", flush=True)
            continue
        primary_tid = max(members, key=lambda t: fragments[t]['n_frames'])
        primary_track = tracker.tracks[primary_tid]
        all_raw, all_ground, all_classes = [], [], []
        for tid in members:
            trk = tracker.tracks[tid]
            all_raw.extend(list(trk.raw_history))
            all_ground.extend(list(trk.ground_history))
            all_classes.extend(trk.class_history)
        all_raw.sort(key=lambda x: x[0])
        all_ground.sort(key=lambda x: x[0])
        seen, deduped = set(), []
        for entry in all_raw:
            if entry[0] not in seen:
                deduped.append(entry)
                seen.add(entry[0])
        seen_g, deduped_g = set(), []
        for entry in all_ground:
            if entry[0] not in seen_g:
                deduped_g.append(entry)
                seen_g.add(entry[0])
        primary_track.raw_history = deque(deduped, maxlen=primary_track.raw_history.maxlen)
        primary_track.history = deque(deduped, maxlen=primary_track.history.maxlen)
        primary_track.ground_history = deque(deduped_g,
                                             maxlen=primary_track.ground_history.maxlen)
        primary_track.class_history = all_classes
        if deduped:
            primary_track.last_seen_frame = deduped[-1][0]
        for tid in members:
            if tid != primary_tid:
                tracker.tracks.pop(tid, None)
                tracker.track_boxes.pop(tid, None)
                n_removed += 1
        print(f"  Merged {members} -> Track {primary_tid} ({len(deduped)} pts)",
              flush=True)

    return n_removed


# ============================================================================
# Post-processing: Direction Filtering and Deduplication
# ============================================================================

def filter_by_dominant_direction(speeds, tracker, transformation_matrix, pixels_per_meter,
                                 angle_tolerance_deg=45.0):
    """Remove tracks going opposite to the dominant traffic direction."""
    if len(speeds) < 3:
        return speeds, 0

    H = transformation_matrix
    track_angles = {}
    for tid in speeds:
        track = tracker.tracks.get(tid)
        if track is None or len(track.raw_history) < 5:
            continue
        raw = list(track.raw_history)
        n = len(raw)
        q1 = raw[:max(1, n // 4)]
        q4 = raw[-max(1, n // 4):]
        x1, y1 = np.mean([p[1] for p in q1]), np.mean([p[2] for p in q1])
        x2, y2 = np.mean([p[1] for p in q4]), np.mean([p[2] for p in q4])
        p1 = cv2.perspectiveTransform(
            np.array([[[x1, y1]]], dtype=np.float32), H)[0][0]
        p2 = cv2.perspectiveTransform(
            np.array([[[x2, y2]]], dtype=np.float32), H)[0][0]
        track_angles[tid] = math.atan2(float(p2[1] - p1[1]), float(p2[0] - p1[0]))

    if len(track_angles) < 3:
        return speeds, 0

    dominant = math.atan2(
        sum(math.sin(a) for a in track_angles.values()),
        sum(math.cos(a) for a in track_angles.values())
    )
    tol = math.radians(angle_tolerance_deg)
    filtered, removed = {}, []

    for tid, data in speeds.items():
        if tid not in track_angles:
            filtered[tid] = data
            continue
        diff = abs(track_angles[tid] - dominant)
        diff = min(diff, 2 * math.pi - diff)
        if diff <= tol:
            filtered[tid] = data
        else:
            removed.append(tid)

    if removed:
        print(f"Direction filter: removed {len(removed)} opposite-direction tracks",
              flush=True)
    return filtered, len(removed)


def deduplicate_tracks(speeds, tracker, max_overlap_frames=10, min_spatial_dist=50):
    """Remove duplicate track measurements for the same vehicle."""
    if len(speeds) < 2:
        return speeds, 0

    track_info = {}
    for tid in speeds:
        track = tracker.tracks.get(tid)
        if track is None or len(track.raw_history) < 2:
            continue
        raw = list(track.raw_history)
        track_info[tid] = {
            'first_frame': raw[0][0], 'last_frame': raw[-1][0],
            'start_pos': (raw[0][1], raw[0][2]),
            'end_pos': (raw[-1][1], raw[-1][2]),
            'n_frames': len(raw), 'speed': speeds[tid]['speed']
        }

    sorted_ids = sorted(track_info.keys(),
                        key=lambda t: track_info[t]['first_frame'])
    to_remove = set()

    for i in range(len(sorted_ids)):
        if sorted_ids[i] in to_remove:
            continue
        for j in range(i + 1, len(sorted_ids)):
            if sorted_ids[j] in to_remove:
                continue
            a, b = sorted_ids[i], sorted_ids[j]
            ia, ib = track_info[a], track_info[b]
            gap = ib['first_frame'] - ia['last_frame']
            if gap > max_overlap_frames:
                break
            if gap < -max_overlap_frames:
                continue
            dx = ia['end_pos'][0] - ib['start_pos'][0]
            dy = ia['end_pos'][1] - ib['start_pos'][1]
            if math.sqrt(dx * dx + dy * dy) > min_spatial_dist:
                continue
            avg_spd = (ia['speed'] + ib['speed']) / 2
            if avg_spd > 0 and abs(ia['speed'] - ib['speed']) / avg_spd > 0.50:
                continue
            to_remove.add(b if ia['n_frames'] >= ib['n_frames'] else a)

    if to_remove:
        print(f"Deduplication: removed {len(to_remove)} tracks", flush=True)
    return {t: d for t, d in speeds.items() if t not in to_remove}, len(to_remove)


def stitch_tracks_for_behavior(tracker, max_gap_frames=30, max_spatial_dist=150,
                               mc_max_gap_frames=None, mc_max_spatial_dist=None):
    """Stitch fragmented tracks for behavior analysis across fragments."""
    if mc_max_gap_frames is None:
        mc_max_gap_frames = max_gap_frames
    if mc_max_spatial_dist is None:
        mc_max_spatial_dist = max_spatial_dist

    fragments = []
    for tid, track in tracker.tracks.items():
        if len(track.raw_history) < 5:
            continue
        raw = list(track.raw_history)
        ground = list(track.ground_history)
        fragments.append({
            'id': tid, 'class': track.get_corrected_class(),
            'first_frame': raw[0][0], 'last_frame': raw[-1][0],
            'start_pos': (raw[0][1], raw[0][2]),
            'end_pos': (raw[-1][1], raw[-1][2]),
            'raw_history': raw, 'ground_history': ground,
        })
    fragments.sort(key=lambda f: f['first_frame'])

    used = set()
    stitched = []
    for frag in fragments:
        if frag['id'] in used:
            continue
        chain = list(frag['raw_history'])
        ground_chain = list(frag['ground_history'])
        chain_ids = [frag['id']]
        cur_end = frag['end_pos']
        cur_last = frag['last_frame']
        cur_class = frag['class']
        used.add(frag['id'])

        changed = True
        while changed:
            changed = False
            best, best_dist = None, float('inf')
            for c in fragments:
                if c['id'] in used or c['class'] != cur_class:
                    continue
                gap = c['first_frame'] - cur_last
                is_mc = (cur_class == "Motorcycle")
                gl = mc_max_gap_frames if is_mc else max_gap_frames
                dl = mc_max_spatial_dist if is_mc else max_spatial_dist
                if gap < 0 or gap > gl:
                    continue
                dx = c['start_pos'][0] - cur_end[0]
                dy = c['start_pos'][1] - cur_end[1]
                d = math.sqrt(dx * dx + dy * dy)
                if d < dl and d < best_dist:
                    best, best_dist = c, d
            if best:
                chain.extend(best['raw_history'])
                ground_chain.extend(best['ground_history'])
                chain_ids.append(best['id'])
                cur_end = best['end_pos']
                cur_last = best['last_frame']
                used.add(best['id'])
                changed = True

        stitched.append({
            'ids': chain_ids, 'class': cur_class,
            'raw_history': chain, 'ground_history': ground_chain,
            'n_fragments': len(chain_ids)
        })
    return stitched


# ============================================================================
# Main Detection Function
# ============================================================================

def run_detection_on_video(video_path: str, calibration_points=None,
                           reference_distance_meters=None, reference_points=None,
                           progress_callback=None, video_record=None,
                           speed_limit_kmh=None):
    """
    Run YOLO object detection on video with perspective-transform speed estimation
    and post-processing behavior detection.

    Uses linear-fit speed estimation on perspective-transformed track positions,
    Kalman-filtered tracking, and post-processing for behavior detection
    (speeding, swerving, abrupt stopping).

    Detection runs on the ORIGINAL frame (not warped) for best YOLO accuracy.
    The perspective transform is only applied to track points for metric calculation.

    Args:
        video_path: Path to the video file
        calibration_points: List of 4 dicts with x, y coordinates for perspective transform
        reference_distance_meters: Real-world distance between reference points in meters
        reference_points: List of 2 dicts with x, y coordinates for scale calibration
        progress_callback: Optional callback function(progress: int)
        video_record: Optional Video model instance for database progress updates
        speed_limit_kmh: Speed limit in km/h (default: SPEED_LIMIT_KMH config value)

    Returns:
        Dictionary with keys: status, message, total_unique, total_speeding,
        total_swerving, total_abrupt_stopping, breakdown, meter_per_pixel,
        jeepney_hotspot
    """
    if speed_limit_kmh is None:
        speed_limit_kmh = SPEED_LIMIT_KMH

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

    # --- Load models ---
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        results_summary["message"] = f"Model load failed: {str(e)}"
        return results_summary

    pretrained_model = None
    use_hybrid = False
    if os.path.exists(PRETRAINED_MODEL_PATH):
        try:
            pretrained_model = YOLO(PRETRAINED_MODEL_PATH)
            use_hybrid = True
            print(f"[YOLO] Hybrid mode: {PRETRAINED_MODEL_PATH} + {MODEL_PATH}",
                  flush=True)
        except Exception as e:
            print(f"[YOLO] Pretrained model load failed, single model: {e}",
                  flush=True)

    if not use_hybrid:
        print(f"[YOLO] Single model mode: {MODEL_PATH}", flush=True)

    # --- Open video ---
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        results_summary["message"] = f"Could not open video: {video_path}"
        return results_summary

    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    if actual_fps == 0:
        actual_fps = 30.0
    fps = actual_fps

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video: {frame_width}x{frame_height} @ {actual_fps:.1f} FPS, "
          f"{total_frames} frames", flush=True)

    # --- Compute perspective transform and calibration ---
    transformation_matrix = None
    pixels_per_meter = 1.0 / HARDCODED_METER_PER_PIXEL

    if calibration_points and len(calibration_points) == 4:
        # Convert dict points to array
        src_pts = []
        for pt in calibration_points:
            if isinstance(pt, dict):
                src_pts.append([pt['x'], pt['y']])
            else:
                src_pts.append([pt[0], pt[1]])
        src_arr = np.float32(src_pts)

        # Compute destination rectangle from source point geometry (preserves aspect ratio)
        rect_width = int(max(
            np.linalg.norm(src_arr[1] - src_arr[0]),
            np.linalg.norm(src_arr[2] - src_arr[3])
        ))
        rect_height = int(max(
            np.linalg.norm(src_arr[3] - src_arr[0]),
            np.linalg.norm(src_arr[2] - src_arr[1])
        ))
        rect_width = max(rect_width, 1)
        rect_height = max(rect_height, 1)

        dst_arr = np.float32([
            [0, 0],
            [rect_width, 0],
            [rect_width, rect_height],
            [0, rect_height]
        ])

        transformation_matrix = cv2.getPerspectiveTransform(src_arr, dst_arr)
        print(f"[Calibration] Perspective transform: {rect_width}x{rect_height} "
              f"bird's-eye view", flush=True)

        # Compute pixels_per_meter from reference points
        if (reference_points and len(reference_points) == 2 and
                reference_distance_meters and reference_distance_meters > 0):
            ref_pts = []
            for pt in reference_points:
                if isinstance(pt, dict):
                    ref_pts.append([pt['x'], pt['y']])
                else:
                    ref_pts.append([pt[0], pt[1]])

            ref_arr = np.float32(ref_pts).reshape(-1, 1, 2)
            transformed_ref = cv2.perspectiveTransform(ref_arr, transformation_matrix)
            p1 = transformed_ref[0][0]
            p2 = transformed_ref[1][0]
            pixel_dist = np.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)

            if pixel_dist > 0:
                pixels_per_meter = pixel_dist / reference_distance_meters
                print(f"[Calibration] Reference: {reference_distance_meters:.2f}m = "
                      f"{pixel_dist:.1f}px -> {pixels_per_meter:.2f} px/m", flush=True)
            else:
                pixels_per_meter = rect_width / 10.0
                print(f"[Calibration] Reference points coincide, fallback: "
                      f"{pixels_per_meter:.2f} px/m", flush=True)
        else:
            pixels_per_meter = rect_width / 10.0
            print(f"[Calibration] No reference measurement, estimated: "
                  f"{pixels_per_meter:.2f} px/m", flush=True)
    else:
        # No calibration points: use identity transform with default scale
        transformation_matrix = np.eye(3, dtype=np.float32)
        pixels_per_meter = 1.0 / HARDCODED_METER_PER_PIXEL
        print(f"[Calibration] No calibration points, using default: "
              f"{pixels_per_meter:.2f} px/m", flush=True)

    meter_per_pixel = 1.0 / pixels_per_meter
    results_summary["meter_per_pixel"] = meter_per_pixel

    # --- Frame processing ---
    tracker = VehicleTracker()
    unique_track_ids_seen = set()
    unique_counts_raw = {}  # Raw class counts from first detection

    frame_id = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Update progress every 10 frames
        if total_frames > 0 and frame_id % 10 == 0:
            progress = min(int((frame_id / total_frames) * 100), 99)
            if video_record:
                video_record.yolo_progress = progress
                video_record.processing_stage = 'yolo'
                video_record.save(update_fields=['yolo_progress', 'processing_stage'])

        # --- Detection on ORIGINAL frame (not warped) for best accuracy ---
        detections = []

        if use_hybrid and pretrained_model is not None:
            # Pretrained model for standard vehicle classes
            results = pretrained_model.track(
                frame, persist=True, conf=CONFIDENCE_THRESHOLD,
                iou=0.3, verbose=False, imgsz=YOLO_IMGSZ)
            for r in results:
                if r.boxes:
                    boxes = r.boxes.xyxy.cpu().numpy()
                    tids = (r.boxes.id.cpu().numpy().astype(int)
                            if r.boxes.id is not None
                            else np.arange(len(boxes)))
                    classes = r.boxes.cls.cpu().numpy().astype(int)
                    for box, tid, cid in zip(boxes, tids, classes):
                        yc = pretrained_model.names[int(cid)]
                        if yc in YOLO_TO_STANDARD_MAPPING:
                            cx, cy, bsz = get_tracking_point(box)
                            gx, gy = get_ground_point(box)
                            detections.append({
                                'track_id': tid,
                                'class_name': YOLO_TO_STANDARD_MAPPING[yc],
                                'center_x': cx, 'center_y': cy,
                                'box': box, 'box_size': bsz,
                                'ground_xy': (gx, gy)
                            })

            # Custom model for Jeepney detection only
            results = model.track(
                frame, persist=True, conf=CONFIDENCE_THRESHOLD,
                iou=0.3, verbose=False, imgsz=YOLO_IMGSZ)
            for r in results:
                if r.boxes:
                    boxes = r.boxes.xyxy.cpu().numpy()
                    tids = (r.boxes.id.cpu().numpy().astype(int)
                            if r.boxes.id is not None
                            else np.arange(len(boxes)) + 100000)
                    classes = r.boxes.cls.cpu().numpy().astype(int)
                    for box, tid, cid in zip(boxes, tids, classes):
                        if int(cid) == 2:  # Jeepney class in custom model
                            if any(calculate_iou(box, e['box']) > 0.3
                                   for e in detections if e.get('box') is not None):
                                continue
                            cx, cy, bsz = get_tracking_point(box)
                            gx, gy = get_ground_point(box)
                            real_tid = (tid + 100000
                                        if r.boxes.id is not None else tid)
                            detections.append({
                                'track_id': real_tid,
                                'class_name': 'Jeepney',
                                'center_x': cx, 'center_y': cy,
                                'box': box, 'box_size': bsz,
                                'ground_xy': (gx, gy)
                            })

            # Far-field boost: upscale top 40% for better far-distance detection
            if FAR_FIELD_BOOST:
                hf, wf = frame.shape[:2]
                far_h = int(hf * 0.4)
                if far_h > 10 and wf > 10:
                    far_up = cv2.resize(frame[:far_h, :], (wf * 2, far_h * 2),
                                        interpolation=cv2.INTER_LINEAR)
                    for r in pretrained_model.predict(
                            far_up, conf=CONFIDENCE_THRESHOLD, iou=0.3,
                            verbose=False, imgsz=YOLO_IMGSZ):
                        if r.boxes:
                            for box_f, cls_f in zip(
                                    r.boxes.xyxy.cpu().numpy(),
                                    r.boxes.cls.cpu().numpy().astype(int)):
                                yc = pretrained_model.names[int(cls_f)]
                                if yc not in YOLO_TO_STANDARD_MAPPING:
                                    continue
                                mb = box_f / 2.0  # Scale back to original coords
                                if any(calculate_iou(mb, e['box']) > 0.3
                                       for e in detections
                                       if e.get('box') is not None):
                                    continue
                                cx, cy, bsz = get_tracking_point(mb)
                                sc = YOLO_TO_STANDARD_MAPPING[yc]
                                mt = _match_to_existing_track(
                                    tracker, cx, cy, sc, frame_id,
                                    max_dist=120, max_age=15)
                                if mt is not None:
                                    gx, gy = get_ground_point(mb)
                                    detections.append({
                                        'track_id': mt, 'class_name': sc,
                                        'center_x': cx, 'center_y': cy,
                                        'box': mb, 'box_size': bsz,
                                        'ground_xy': (gx, gy)
                                    })

            # Mid-field boost: upscale middle band for motorcycle detection
            if MID_FIELD_BOOST:
                hf, wf = frame.shape[:2]
                mt_top, mt_bot = int(hf * 0.3), int(hf * 0.7)
                mid_h = mt_bot - mt_top
                if mid_h > 10 and wf > 10:
                    mid_up = cv2.resize(
                        frame[mt_top:mt_bot, :],
                        (int(wf * 1.5), int(mid_h * 1.5)),
                        interpolation=cv2.INTER_LINEAR)
                    for r in pretrained_model.predict(
                            mid_up, conf=MOTORCYCLE_CONF_THRESHOLD, iou=0.3,
                            verbose=False, imgsz=YOLO_IMGSZ):
                        if r.boxes:
                            for box_m, cls_m in zip(
                                    r.boxes.xyxy.cpu().numpy(),
                                    r.boxes.cls.cpu().numpy().astype(int)):
                                if pretrained_model.names[int(cls_m)] != 'motorcycle':
                                    continue
                                mb = box_m / 1.5
                                mb[1] += mt_top
                                mb[3] += mt_top
                                if any(calculate_iou(mb, e['box']) > 0.25
                                       for e in detections
                                       if e.get('box') is not None):
                                    continue
                                cx, cy, bsz = get_tracking_point(mb)
                                mt = _match_to_existing_track(
                                    tracker, cx, cy, 'Motorcycle', frame_id,
                                    max_dist=100, max_age=15)
                                if mt is not None:
                                    gx, gy = get_ground_point(mb)
                                    detections.append({
                                        'track_id': mt,
                                        'class_name': 'Motorcycle',
                                        'center_x': cx, 'center_y': cy,
                                        'box': mb, 'box_size': bsz,
                                        'ground_xy': (gx, gy)
                                    })
        else:
            # Single model mode: custom model detects all classes
            results = model.track(
                frame, persist=True, conf=CONFIDENCE_THRESHOLD,
                tracker=TRACKER_CONFIG, iou=0.3, verbose=False, imgsz=YOLO_IMGSZ)
            for r in results:
                if r.boxes and r.boxes.id is not None:
                    boxes = r.boxes.xyxy.cpu().numpy()
                    tids = r.boxes.id.cpu().numpy().astype(int)
                    classes = r.boxes.cls.cpu().numpy().astype(int)
                    for box, tid, cid in zip(boxes, tids, classes):
                        class_name = CUSTOM_CLASS_MAPPING.get(
                            int(cid), model.names.get(int(cid), 'unknown'))
                        cx, cy, bsz = get_tracking_point(box)
                        gx, gy = get_ground_point(box)
                        detections.append({
                            'track_id': tid,
                            'class_name': class_name,
                            'center_x': cx, 'center_y': cy,
                            'box': box, 'box_size': bsz,
                            'ground_xy': (gx, gy)
                        })

        # Track unique IDs and classes for raw breakdown
        for det in detections:
            tid = det['track_id']
            if tid not in unique_track_ids_seen:
                unique_track_ids_seen.add(tid)
                cls = det['class_name']
                unique_counts_raw[cls] = unique_counts_raw.get(cls, 0) + 1

        # Update tracker (handles deduplication internally)
        tracker.update(frame_id, detections)

        frame_id += 1
        if frame_id % 200 == 0:
            print(f"  Processed {frame_id}/{total_frames} frames, "
                  f"{len(tracker.tracks)} active tracks", flush=True)

    cap.release()
    print(f"Frame processing complete: {frame_id} frames, "
          f"{len(tracker.tracks)} tracks", flush=True)

    # ========================================================================
    # POST-PROCESSING
    # ========================================================================

    # 1. Merge fragmented tracks
    print(f"\nMerging fragmented tracks...", flush=True)
    print(f"  Before: {len(tracker.tracks)}", flush=True)
    n_merged = merge_fragmented_tracks(
        tracker, max_gap_frames=60, max_spatial_dist=250, overlap_max_dist=120)
    print(f"  After: {len(tracker.tracks)} ({n_merged} absorbed)", flush=True)

    # Recompute breakdown from merged tracker (more accurate than raw counts)
    unique_counts = {}
    for tid, track in tracker.tracks.items():
        if len(track.raw_history) >= 3:
            cls = track.get_corrected_class()
            unique_counts[cls] = unique_counts.get(cls, 0) + 1

    # 2. Calculate speeds using linear fit
    print(f"\nCalculating speeds... ({len(tracker.tracks)} tracks)", flush=True)
    speeds = {}
    for tid, track in tracker.tracks.items():
        is_mc = track.is_motorcycle()
        mh = MOTORCYCLE_MIN_HISTORY_FOR_SPEED if is_mc else MIN_HISTORY_FOR_SPEED
        if len(track.raw_history) < mh:
            continue
        mg = MOTORCYCLE_MAX_FRAME_GAP if is_mc else MAX_FRAME_GAP
        if not track.is_track_continuous(max_gap=mg):
            continue
        if track.get_average_movement_per_frame() < (0.5 if is_mc else 1.0):
            continue

        # Linear fit on raw box-center positions (no Kalman lag)
        fit = calculate_speed_linear_fit(
            list(track.raw_history), transformation_matrix, pixels_per_meter, fps,
            min_r_squared=0.0
        )
        if fit is None:
            continue
        actual_r2_threshold = MOTORCYCLE_MIN_R_SQUARED if is_mc else MIN_R_SQUARED
        if fit['r_squared'] < actual_r2_threshold:
            continue
        md = MOTORCYCLE_MIN_DISTANCE_METERS if is_mc else MIN_DISTANCE_TRAVELED_METERS
        if fit['distance_m'] < md:
            continue
        if fit['speed_kmh'] > MAX_REALISTIC_SPEED_KMH or fit['speed_kmh'] < MIN_REALISTIC_SPEED_KMH:
            continue

        # Detect behaviors for this track
        raw_pos = list(track.raw_history)
        ground_pos = list(track.ground_history)
        stop = detect_abrupt_stop(raw_pos, transformation_matrix, pixels_per_meter, fps)
        swerve = detect_swerving(ground_pos, transformation_matrix, pixels_per_meter)
        spd_info = detect_speeding(fit['speed_kmh'], speed_limit_kmh)

        speeds[tid] = {
            'speed': fit['speed_kmh'], 'class_name': track.get_corrected_class(),
            'distance': fit['distance_m'], 'frames': fit['frames'],
            'r_squared': fit['r_squared'],
            'abrupt_stop': stop['abrupt_stop'],
            'max_decel_ms2': stop['max_decel_ms2'],
            'swerving': swerve['swerving'],
            'max_lateral_m': swerve['max_lateral_m'],
            'direction_changes': swerve['direction_changes'],
            'speeding': spd_info['speeding'],
            'speed_margin_kmh': spd_info['margin_kmh'],
            'within_error_margin': spd_info['within_error_margin'],
        }

    # 3. Filter and deduplicate
    print(f"Tracks before post-processing: {len(speeds)}", flush=True)
    speeds, n_dir = filter_by_dominant_direction(
        speeds, tracker, transformation_matrix, pixels_per_meter,
        angle_tolerance_deg=45.0)
    speeds, n_ded = deduplicate_tracks(
        speeds, tracker, max_overlap_frames=20, min_spatial_dist=200)
    print(f"Tracks after post-processing: {len(speeds)} "
          f"(dir: -{n_dir}, dedup: -{n_ded})", flush=True)

    # 4. Stitch tracks for additional behavior detection
    stitched_tracks = stitch_tracks_for_behavior(
        tracker, max_gap_frames=30, max_spatial_dist=120,
        mc_max_gap_frames=MOTORCYCLE_STITCH_GAP_FRAMES,
        mc_max_spatial_dist=MOTORCYCLE_STITCH_SPATIAL_DIST)

    for st in stitched_tracks:
        if st['n_fragments'] == 1 and st['ids'][0] in speeds:
            continue
        raw = st['raw_history']
        if len(raw) < 10:
            continue
        sf = calculate_speed_linear_fit(
            raw, transformation_matrix, pixels_per_meter, fps, min_r_squared=0.70)
        if sf is None:
            continue
        stop = detect_abrupt_stop(raw, transformation_matrix, pixels_per_meter, fps)
        ground = st.get('ground_history', raw)
        swerve = detect_swerving(ground, transformation_matrix, pixels_per_meter)
        has_beh = stop['abrupt_stop'] or swerve['swerving']

        if has_beh or sf is not None:
            # Update existing speed records with behavior info from stitched tracks
            for cid in st['ids']:
                if cid in speeds:
                    if stop['abrupt_stop']:
                        speeds[cid]['abrupt_stop'] = True
                        speeds[cid]['max_decel_ms2'] = max(
                            speeds[cid].get('max_decel_ms2', 0),
                            stop['max_decel_ms2'])
                    if swerve['swerving']:
                        speeds[cid]['swerving'] = True
                        speeds[cid]['max_lateral_m'] = max(
                            speeds[cid].get('max_lateral_m', 0),
                            swerve['max_lateral_m'])
                        speeds[cid]['direction_changes'] = max(
                            speeds[cid].get('direction_changes', 0),
                            swerve['direction_changes'])

    # Set final progress
    if video_record:
        video_record.yolo_progress = 100
        video_record.processing_stage = 'yolo'
        video_record.save(update_fields=['yolo_progress', 'processing_stage'])

    # ========================================================================
    # BUILD RESULTS
    # ========================================================================
    speeding_count = sum(1 for d in speeds.values() if d.get('speeding'))
    swerving_count = sum(1 for d in speeds.values() if d.get('swerving'))
    abrupt_stop_count = sum(1 for d in speeds.values() if d.get('abrupt_stop'))

    jeepney_count = unique_counts.get('Jeepney', 0) + unique_counts.get('jeepney', 0)
    is_jeepney_hotspot = jeepney_count > 15

    results_summary["status"] = "success"
    results_summary["total_unique"] = sum(unique_counts.values())
    results_summary["total_speeding"] = speeding_count
    results_summary["total_swerving"] = swerving_count
    results_summary["total_abrupt_stopping"] = abrupt_stop_count
    results_summary["breakdown"] = unique_counts
    results_summary["meter_per_pixel"] = meter_per_pixel
    results_summary["jeepney_hotspot"] = is_jeepney_hotspot

    # Print summary
    print("\n" + "=" * 60, flush=True)
    print("YOLO VIDEO PROCESSING SUMMARY", flush=True)
    print("=" * 60, flush=True)
    print(f"Scale: {pixels_per_meter:.2f} px/m ({meter_per_pixel:.6f} m/px)",
          flush=True)
    print(f"Total Unique Vehicles: {results_summary['total_unique']}", flush=True)
    print(f"Vehicles with valid speed: {len(speeds)}", flush=True)
    print(f"\nAggressive Behaviors:", flush=True)
    print(f"  Speeding (>{speed_limit_kmh} km/h): {speeding_count}", flush=True)
    print(f"  Swerving: {swerving_count}", flush=True)
    print(f"  Abrupt Stopping: {abrupt_stop_count}", flush=True)
    print(f"\nJeepney Hotspot: {'YES' if is_jeepney_hotspot else 'NO'} "
          f"({jeepney_count} jeepneys)", flush=True)
    print(f"\nClass Breakdown:", flush=True)
    for name, count in sorted(unique_counts.items()):
        print(f"  {name}: {count}", flush=True)

    if speeds:
        all_spd = [d['speed'] for d in speeds.values()]
        all_r2 = [d.get('r_squared', 0) for d in speeds.values()]
        print(f"\nSpeed Stats (km/h):", flush=True)
        print(f"  Mean: {np.mean(all_spd):.2f}, Median: {np.median(all_spd):.2f}",
              flush=True)
        print(f"  Range: {np.min(all_spd):.2f} - {np.max(all_spd):.2f}, "
              f"Mean R-squared: {np.mean(all_r2):.4f}", flush=True)

        for tid, d in sorted(speeds.items()):
            flags = []
            if d.get('abrupt_stop'):
                flags.append(f"STOP({d['max_decel_ms2']:.1f}m/s2)")
            if d.get('swerving'):
                flags.append(f"SWERVE({d['direction_changes']}rev)")
            if d.get('speeding'):
                flags.append(f"SPEED({d['speed']:.1f}km/h)")
            if flags:
                print(f"  Track {tid} ({d['class_name']}): {'; '.join(flags)}",
                      flush=True)

    print("=" * 60 + "\n", flush=True)

    return results_summary
