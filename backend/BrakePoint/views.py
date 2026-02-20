from rest_framework.decorators import api_view, permission_classes
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib import messages
from django.contrib.auth import authenticate, login
from django.db.models import Sum
from django.db.models.functions import TruncDate
from .models import SavedLocation, Camera, Video
from .serializers import SavedLocationSerializer, SignupSerializer, CameraSerializer, VideoSerializer
import requests
import tempfile, os

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from yolo_processor import run_detection_on_video
from mask_rcnn_detectron2_processor import run_traffic_sign_detection_on_video
from django.utils import timezone

api_view(['GET'])
@permission_classes([AllowAny])
def home(request):
    return Response({
        "message": "Welcome to BrakePoint API backend. Frontend handled by Next.js."
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard(request):
    locations = SavedLocation.objects.all().order_by('-id')
    serializer = SavedLocationSerializer(locations, many=True)
    return Response({
        "view": "dashboard",
        "locations": serializer.data
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def examine(request):
    # You can later return saved polygons/cameras if you store them
    return Response({
        "view": "examine",
        "message": "Map editing and viewing handled by Next.js frontend."
    })

# ---- Log In and Sign Up ----
api_view(['GET', 'POST'])
permission_classes([AllowAny])
def sign_up(request):
    if request.method == 'GET':
         return
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
    

# ---- SavedLocations ----
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])   # tighten later if needed
def saved_locations_api(request):
    if request.method == 'GET':
        qs = SavedLocation.objects.all().order_by('-id')
        return Response({"SavedLocations": SavedLocationSerializer(qs, many=True).data})
    # POST (create)
    ser = SavedLocationSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response({"success": True, "SavedLocation": ser.data})
    return Response({"success": False, "error": ser.errors}, status=400)

@api_view(['PUT', 'DELETE'])
@permission_classes([AllowAny])   # tighten later if needed
def saved_location_detail_api(request, pk: int):
    try:
        loc = SavedLocation.objects.get(pk=pk)
    except SavedLocation.DoesNotExist:
        return Response({"success": False, "error": "Not found"}, status=404)

    if request.method == 'PUT':
        ser = SavedLocationSerializer(loc, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response({"success": True, "SavedLocation": ser.data})
        return Response({"success": False, "error": ser.errors}, status=400)

    # DELETE
    loc.delete()
    return Response({"success": True})

@api_view(['GET'])
@permission_classes([AllowAny])
def saved_location_behaviors_api(request, pk: int):
    """Get detailed aggressive behavior stats for a saved location"""
    try:
        loc = SavedLocation.objects.get(pk=pk)
    except SavedLocation.DoesNotExist:
        return Response({"success": False, "error": "Not found"}, status=404)

    # Get all completed videos linked to this location's cameras
    videos = Video.objects.filter(
        camera__saved_location=loc,
        processing_status='completed'
    ).order_by('-uploaded_at')

    video_data = VideoSerializer(videos, many=True).data
    camera_data = CameraSerializer(loc.cameras.all(), many=True).data

    return Response({
        "success": True,
        "location": SavedLocationSerializer(loc).data,
        "cameras": camera_data,
        "videos": video_data,
        "summary": {
            "total_vehicles": loc.total_vehicles,
            "total_occurrences": loc.total_occurrences,
            "speeding": loc.total_speeding,
            "swerving": loc.total_swerving,
            "abrupt_stopping": loc.total_abrupt_stopping,
            "behaviors": loc.behavior_summary,
            "camera_count": loc.camera_count,
        }
    })

# ---- Auth (session-based example) ----
@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    from django.middleware.csrf import get_token
    return Response({"csrfToken": get_token(request)})

@api_view(['GET'])
@permission_classes([AllowAny])
def check_auth(request):
    if request.user.is_authenticated:
        return Response({
            "authenticated": True,
            "user": {"username": request.user.username, "id": request.user.id}
        })
    return Response({"authenticated": False})

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    from rest_framework_simplejwt.tokens import RefreshToken
    
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(request, username=username, password=password)
    
    if not user:
        return Response({"success": False, "error": "Invalid credentials"}, status=400)
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    
    return Response({
        "success": True,
        "user": {"username": user.username, "id": user.id},
        "access": str(refresh.access_token),
        "refresh": str(refresh)
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def api_signup(request):
    ser = SignupSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response({"success": True})
    return Response({"success": False, "error": ser.errors}, status=400)

# Helper function for reverse geocoding
def get_location_name(lat, lng):
    """Get location name from coordinates using Nominatim API"""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1"
        headers = {'User-Agent': 'BrakePoint/1.0'}
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.ok:
            data = response.json()
            address = data.get('address', {})
            
            # Build a readable location string
            parts = []
            if address.get('road'):
                parts.append(address['road'])
            if address.get('suburb') or address.get('neighbourhood'):
                parts.append(address.get('suburb') or address.get('neighbourhood'))
            if address.get('city') or address.get('town') or address.get('municipality'):
                parts.append(address.get('city') or address.get('town') or address.get('municipality'))
            if address.get('country'):
                parts.append(address['country'])
            
            return ', '.join(parts) if parts else data.get('display_name', '')
    except Exception as e:
        print(f"Reverse geocoding failed: {e}")
    
    return None

# ---- Cameras ----
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])  
def cameras_api(request):
    user = request.user 
    print(f"Camera API called - User: {user.username}, Authenticated: {request.user.is_authenticated}")
    
    if request.method == 'GET':
        cameras = Camera.objects.filter(user=user)
        ser = CameraSerializer(cameras, many=True)
        return Response({"success": True, "cameras": ser.data})
    
    data = request.data.copy()
    lat = float(data.get('lat'))
    lng = float(data.get('lng'))
    
    # Get actual location name from reverse geocoding
    location_name = get_location_name(lat, lng)
    
    # Auto-generate name if not provided
    if not data.get('name'):
        if location_name:
            # Extract street/area name for camera name
            parts = location_name.split(',')
            data['name'] = f"{parts[0].strip()} Camera" if parts else f"Camera at {lat:.4f}°, {lng:.4f}°"
        else:
            data['name'] = f"Camera at {lat:.4f}°, {lng:.4f}°"
    
    # Auto-generate location if not provided
    if not data.get('location'):
        if location_name:
            data['location'] = location_name
        else:
            lat_dir = 'N' if lat >= 0 else 'S'
            lng_dir = 'E' if lng >= 0 else 'W'
            data['location'] = f"{abs(lat):.4f}°{lat_dir}, {abs(lng):.4f}°{lng_dir}"
    
    ser = CameraSerializer(data=data)
    if ser.is_valid():
        camera = ser.save(user=user)
        
        # Auto-link camera to nearest saved location (within ~500m)
        if not camera.saved_location:
            from math import radians, cos, sin, asin, sqrt
            
            def haversine(lat1, lng1, lat2, lng2):
                lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
                dlat = lat2 - lat1
                dlng = lng2 - lng1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
                return 6371000 * 2 * asin(sqrt(a))  # meters
            
            nearest = None
            min_dist = float('inf')
            for loc in SavedLocation.objects.all():
                dist = haversine(lat, lng, loc.lat, loc.lng)
                if dist < min_dist:
                    min_dist = dist
                    nearest = loc
            
            if nearest and min_dist <= 500:  # within 500 meters
                camera.saved_location = nearest
                camera.save()
        
        return Response({"success": True, "camera": CameraSerializer(camera).data}, status=201)
    return Response({"success": False, "error": ser.errors}, status=400)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def upload_and_process_video(request):
    """
    Receives uploaded video, saves temporarily, and runs both YOLO vehicle detection 
    and Mask R-CNN traffic sign detection with calibration.
    Creates a Video record linked to a Camera.
    """
    print(f"[upload] method={request.method} content_type={request.content_type} FILES={list(request.FILES.keys())} POST={list(request.POST.keys())} user={request.user}", flush=True)
    try:
        return _upload_and_process_video(request)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def _upload_and_process_video(request):
    user = request.user
    video_file = request.FILES.get('file')
    video_name = request.POST.get('video_name', 'Untitled Video')
    camera_id = request.POST.get('camera_id')
    is_dry_run = request.POST.get('is_dry_run', 'false').lower() == 'true'
    
    if not video_file:
        return Response({'error': 'No video file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not camera_id:
        return Response({'error': 'Camera ID is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        camera = Camera.objects.get(pk=camera_id, user=user)
    except Camera.DoesNotExist:
        return Response({'error': 'Camera not found'}, status=status.HTTP_404_NOT_FOUND)

    calibration_points_json = request.POST.get('calibration_points')
    reference_points_json = request.POST.get('reference_points')
    reference_distance_str = request.POST.get('reference_distance_meters')
    use_sign_detection = request.POST.get('use_sign_detection', 'false').lower() == 'true'
    
    calibration_points = None
    reference_points = None
    reference_distance_meters = None
    
    if calibration_points_json:
        import json
        calibration_points = json.loads(calibration_points_json)
    
    if reference_points_json:
        import json
        reference_points = json.loads(reference_points_json)
    
    if reference_distance_str:
        try:
            reference_distance_meters = float(reference_distance_str)
        except ValueError:
            return Response({'error': 'Invalid reference distance value'}, status=status.HTTP_400_BAD_REQUEST)

    # Fall back to camera's saved calibration if not provided in this upload
    if not calibration_points and camera.is_calibrated:
        calibration_points = camera.calibration_points
    if not reference_points and camera.is_calibrated:
        reference_points = camera.reference_points
    if reference_distance_meters is None and camera.is_calibrated:
        reference_distance_meters = camera.reference_distance_meters

    # Save calibration to camera for future reuse (if new calibration was provided)
    save_calibration = request.POST.get('save_calibration', 'true').lower() == 'true'
    if save_calibration and calibration_points_json:
        camera.calibration_points = calibration_points or []
        camera.reference_points = reference_points or []
        camera.reference_distance_meters = reference_distance_meters
        camera.is_calibrated = True
        camera.save()

    video_record = Video.objects.create(
        camera=camera,
        filename=video_name,
        calibration_points=calibration_points or [],
        reference_points=reference_points or [],
        reference_distance_meters=reference_distance_meters,
        processing_status='processing',
        processing_started_at=timezone.now()
    )

    project_tmp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tmp')
    os.makedirs(project_tmp, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4", dir=project_tmp) as tmp_file:
        for chunk in video_file.chunks():
            tmp_file.write(chunk)
        temp_path = tmp_file.name
    
    try:

        import cv2
        import base64
        cap = cv2.VideoCapture(temp_path)
        if cap.isOpened():
            video_record.fps = cap.get(cv2.CAP_PROP_FPS)
            video_record.duration_seconds = cap.get(cv2.CAP_PROP_FRAME_COUNT) / video_record.fps if video_record.fps > 0 else 0
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            video_record.resolution = f"{frame_width}x{frame_height}"
            
            # Generate thumbnail (frame 1)
            try:
                seek_time = min(1.0, video_record.duration_seconds * 0.1) if video_record.duration_seconds > 0 else 1.0
                cap.set(cv2.CAP_PROP_POS_MSEC, seek_time * 1000)
                ret, frame = cap.read()
                if ret and frame is not None:
                    # Resize to reasonable thumbnail size (maintain aspect ratio, max width 640px)
                    max_width = 640
                    height, width = frame.shape[:2]
                    if width > max_width:
                        scale = max_width / width
                        new_width = max_width
                        new_height = int(height * scale)
                        frame = cv2.resize(frame, (new_width, new_height))
                    
                    # Encode to JPEG
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    # Convert to base64
                    thumbnail_base64 = base64.b64encode(buffer).decode('utf-8')
                    video_record.thumbnail = f"data:image/jpeg;base64,{thumbnail_base64}"
            except Exception as thumb_error:
                print(f"[Error] Thumbnail generation failed: {thumb_error}", flush=True)
            
            cap.release()
        
        # Get file size
        video_record.file_size_mb = os.path.getsize(temp_path) / (1024 * 1024)
        video_record.save()

        # Return immediately, then process in background
        response_data = {
            'success': True,
            'video_id': video_record.id,
            'camera_id': camera.id,
            'message': 'Video uploaded successfully, processing started',
            'processing_status': 'processing'
        }
        
        # Start processing in background thread (after response is sent)
        import threading
        import re as _re
        
        # Extract speed limit from camera tags (e.g. "30kph Speed Limit" → 30)
        _speed_limit = None
        if isinstance(camera.tags, list):
            for _tag in camera.tags:
                _m = _re.match(r'(\d+)\s*kph\s+speed\s+limit', str(_tag), _re.IGNORECASE)
                if _m:
                    _speed_limit = int(_m.group(1))
                    break

        def process_video_background(is_dry_run):
            """Process video in background thread"""
            # Close any parent thread database connections
            from django.db import connection
            import time
            
            connection.close()
            
            try:
                # Get fresh video instance
                video_obj = Video.objects.get(pk=video_record.id)
                
                # Run YOLO vehicle detection
                yolo_results = run_detection_on_video(
                    temp_path, 
                    calibration_points, 
                    reference_distance_meters,
                    reference_points,
                    video_record=video_obj,
                    speed_limit_kmh=_speed_limit
                )
                
                # Reload Video object for Mask R-CNN
                video_obj.refresh_from_db()
                
                # Run Mask R-CNN traffic sign detection (only if requested)
                sign_results = {}
                if use_sign_detection:
                    print(f"[views.py] Starting Mask R-CNN for video {video_obj.id}", flush=True)
                    sign_results = run_traffic_sign_detection_on_video(temp_path, video_record=video_obj)
                    print(f"[views.py] Mask R-CNN completed: {sign_results.get('status')}", flush=True)
                else:
                    print(f"[views.py] Skipping Mask R-CNN for video {video_obj.id} (not requested)", flush=True)

                # Reload for final update
                connection.close()
                video_obj = Video.objects.get(pk=video_record.id)
                
                # Update video record with results
                if yolo_results.get('status') == 'success':
                    video_obj.vehicles = yolo_results.get('total_unique', 0)
                    video_obj.speeding_count = yolo_results.get('total_speeding', 0)
                    video_obj.swerving_count = yolo_results.get('total_swerving', 0)
                    video_obj.abrupt_stopping_count = yolo_results.get('total_abrupt_stopping', 0)
                    video_obj.vehicle_breakdown = yolo_results.get('breakdown', {})
                    video_obj.meter_per_pixel = yolo_results.get('meter_per_pixel', None)
                    video_obj.jeepney_hotspot = yolo_results.get('jeepney_hotspot', False)

                    if is_dry_run:
                        camera.refresh_from_db()

                        camera.calibration_points = calibration_points or []
                        camera.reference_points = reference_points or []
                        camera.reference_distance_meters = reference_distance_meters
                        camera.meter_per_pixel = yolo_results.get('meter_per_pixel')
                        camera.is_calibrated = True
                        camera.save()
                
                if sign_results.get('status') == 'success':
                    video_obj.signs = sign_results.get('unique_signs', 0) 
                    sign_counts = sign_results.get('sign_counts', {})
                    video_obj.sign_classes = list(sign_counts.keys())
                    video_obj.sign_breakdown = sign_counts
                
                video_obj.processing_status = 'completed'
                video_obj.processing_completed_at = timezone.now()
                video_obj.save()
                print(f"[views.py] Processing completed for video {video_obj.id}", flush=True)
                
            except Exception as e:
                print(f"[Error] Video {video_record.id} processing failed: {e}", flush=True)
                import traceback
                traceback.print_exc()
                # Retry DB connection before saving failure state
                for _attempt in range(3):
                    try:
                        connection.close()
                        connection.ensure_connection()
                        video_obj = Video.objects.get(pk=video_record.id)
                        video_obj.processing_status = 'failed'
                        video_obj.processing_stage = ''
                        video_obj.yolo_progress = 0
                        video_obj.processing_completed_at = timezone.now()
                        video_obj.save()
                        print(f"[Error] Saved failure state for video {video_record.id}", flush=True)
                        break
                    except Exception as save_error:
                        print(f"[Error] Save attempt {_attempt+1} failed: {save_error}", flush=True)
                        import time
                        time.sleep(2)
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception as cleanup_error:
                        print(f"[Error] Could not delete temp file: {cleanup_error}", flush=True)
                connection.close()
        
        # Start background thread
        thread = threading.Thread(target=process_video_background, args=(is_dry_run,), daemon=True)
        thread.start()

    except Exception as e:
        # Mark as failed
        video_record.processing_status = 'failed'
        video_record.error_message = str(e)
        video_record.processing_completed_at = timezone.now()
        video_record.save()
        
        response_data = {
            'success': False,
            'error': str(e),
            'video_id': video_record.id
        }

    return Response(response_data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def camera_videos_api(request, pk: int):
    """Get all videos for a specific camera"""
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    # Get all videos for this camera, ordered by most recent first
    videos = Video.objects.filter(camera=camera).order_by('-uploaded_at')
    ser = VideoSerializer(videos, many=True)
    
    return Response({"success": True, "videos": ser.data})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated]) 
def camera_delete_api(request, pk: int):
    user = request.user 
    print(f"DELETE Camera API called - Camera ID: {pk}, User: {user.username}, Authenticated: {request.user.is_authenticated}")
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
        print(f"Camera found: {camera.id}, User: {camera.user.username}")
    except Camera.DoesNotExist:
        print(f"Camera not found with ID {pk} for user {user.username}")
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    camera.delete()
    return Response({"success": True})

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def camera_polygon_api(request, pk: int):
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    polygon_data = request.data.get('polygon')
    
    # Allow null to clear the polygon
    if polygon_data is None:
        camera.polygon = []
        camera.save()
        return Response({"success": True, "message": "Polygon cleared"})
    
    # Validate that polygon is a list
    if not isinstance(polygon_data, list):
        return Response({"success": False, "error": "Polygon must be a list"}, status=400)
    
    camera.polygon = polygon_data
    camera.save()
    
    return Response({"success": True, "polygon": camera.polygon})

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def camera_calibration_api(request, pk: int):
    """Get, save, or clear calibration data for a camera"""
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    if request.method == 'GET':
        return Response({
            "success": True,
            "is_calibrated": camera.is_calibrated,
            "calibration_points": camera.calibration_points,
            "reference_points": camera.reference_points,
            "reference_distance_meters": camera.reference_distance_meters,
            "meter_per_pixel": camera.meter_per_pixel,
        })
    
    if request.method == 'PUT':
        camera.calibration_points = request.data.get('calibration_points', [])
        camera.reference_points = request.data.get('reference_points', [])
        camera.reference_distance_meters = request.data.get('reference_distance_meters')
        camera.meter_per_pixel = request.data.get('meter_per_pixel')
        camera.is_calibrated = True
        camera.save()
        return Response({
            "success": True,
            "message": "Calibration saved",
            "is_calibrated": camera.is_calibrated,
        })
    
    # DELETE — clear calibration
    camera.calibration_points = []
    camera.reference_points = []
    camera.reference_distance_meters = None
    camera.meter_per_pixel = None
    camera.is_calibrated = False
    camera.save()
    return Response({"success": True, "message": "Calibration cleared"})

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def camera_tags_api(request, pk: int):
    """Get or update tags for a camera"""
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    if request.method == 'GET':
        return Response({"success": True, "tags": camera.tags})
    
    # PUT — replace all tags
    tags = request.data.get('tags', [])
    if not isinstance(tags, list):
        return Response({"success": False, "error": "Tags must be a list"}, status=400)
    
    # Sanitise: deduplicate, strip whitespace, remove empties
    cleaned = list(dict.fromkeys(t.strip() for t in tags if isinstance(t, str) and t.strip()))
    camera.tags = cleaned
    camera.save()
    
    return Response({"success": True, "tags": camera.tags})

@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def video_detail_api(request, pk: int):
    """Update or delete a specific video"""
    user = request.user
    
    try:
        video = Video.objects.get(pk=pk, camera__user=user)
    except Video.DoesNotExist:
        return Response({"success": False, "error": "Video not found"}, status=404)
    
    if request.method == 'PATCH':
        updated = False

        filename = request.data.get('filename')
        if filename:
            video.filename = filename
            updated = True

        for field in ('vehicles', 'speeding_count', 'swerving_count', 'abrupt_stopping_count'):
            val = request.data.get(field)
            if val is not None:
                try:
                    setattr(video, field, int(val))
                    updated = True
                except (ValueError, TypeError):
                    return Response({"success": False, "error": f"Invalid value for {field}"}, status=400)

        # Handle calibration fields
        calibration_points = request.data.get('calibration_points')
        if calibration_points is not None:
            video.calibration_points = calibration_points
            updated = True

        reference_points = request.data.get('reference_points')
        if reference_points is not None:
            video.reference_points = reference_points
            updated = True

        reference_distance_meters = request.data.get('reference_distance_meters')
        if reference_distance_meters is not None:
            try:
                video.reference_distance_meters = float(reference_distance_meters) if reference_distance_meters else None
                updated = True
            except (ValueError, TypeError):
                return Response({"success": False, "error": "Invalid value for reference_distance_meters"}, status=400)

        if updated:
            video.save()
            ser = VideoSerializer(video)
            return Response({"success": True, "video": ser.data})
        return Response({"success": False, "error": "No valid fields provided"}, status=400)
    
    elif request.method == 'DELETE':
        video.delete()
        return Response({"success": True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def video_progress_api(request, pk: int):
    """Get processing status for a specific video"""
    user = request.user
    
    try:
        video = Video.objects.get(pk=pk, camera__user=user)
        return Response({
            "success": True,
            "processing_status": video.processing_status,
            "processing_stage": video.processing_stage,
            "yolo_progress": video.yolo_progress,
        })
    except Video.DoesNotExist:
        return Response({"success": False, "error": "Video not found"}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_timeline_api(request):
    user = request.user

    raw_ids = request.query_params.get('camera_ids', '')
    if not raw_ids:
        return Response({"success": False, "error": "camera_ids is required"}, status=400)

    try:
        camera_ids = [int(x) for x in raw_ids.split(',') if x.strip()]
    except ValueError:
        return Response({"success": False, "error": "Invalid camera_ids"}, status=400)

    # Only allow cameras owned by this user
    cameras = Camera.objects.filter(pk__in=camera_ids, user=user)
    if not cameras.exists():
        return Response({"success": False, "error": "No matching cameras found"}, status=404)

    qs = Video.objects.filter(
        camera__in=cameras,
        processing_status='completed',
    )

    start = request.query_params.get('start')
    end = request.query_params.get('end')
    if start:
        qs = qs.filter(uploaded_at__date__gte=start)
    if end:
        qs = qs.filter(uploaded_at__date__lte=end)

    rows = (
        qs
        .annotate(date=TruncDate('uploaded_at'))
        .values('date')
        .annotate(
            speeding=Sum('speeding_count'),
            swerving=Sum('swerving_count'),
            abrupt_stopping=Sum('abrupt_stopping_count'),
            vehicles=Sum('vehicles'),
        )
        .order_by('date')
    )

    data = [
        {
            'date': row['date'].isoformat(),
            'speeding': row['speeding'] or 0,
            'swerving': row['swerving'] or 0,
            'abrupt_stopping': row['abrupt_stopping'] or 0,
            'vehicles': row['vehicles'] or 0,
        }
        for row in rows
    ]

    return Response({"success": True, "timeline": data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary_api(request):
    user = request.user
    cameras = Camera.objects.filter(user=user)

    qs = Video.objects.filter(camera__in=cameras, processing_status='completed')

    start = request.query_params.get('start')
    end = request.query_params.get('end')
    if start:
        qs = qs.filter(uploaded_at__date__gte=start)
    if end:
        qs = qs.filter(uploaded_at__date__lte=end)

    totals = qs.aggregate(
        vehicles=Sum('vehicles'),
        speeding=Sum('speeding_count'),
        swerving=Sum('swerving_count'),
        abrupt_stopping=Sum('abrupt_stopping_count'),
    )

    total_vehicles = totals['vehicles'] or 0
    total_speeding = totals['speeding'] or 0
    total_swerving = totals['swerving'] or 0
    total_abrupt = totals['abrupt_stopping'] or 0
    total_adb = total_speeding + total_swerving + total_abrupt

    # Vehicle breakdown (merge dicts from all videos)
    breakdown: dict[str, int] = {}
    for vb in qs.values_list('vehicle_breakdown', flat=True):
        if isinstance(vb, dict):
            for k, v in vb.items():
                breakdown[k] = breakdown.get(k, 0) + (v if isinstance(v, int) else 0)

    # Per-camera aggregates
    per_camera = []
    for cam in cameras:
        cam_qs = qs.filter(camera=cam)
        cam_totals = cam_qs.aggregate(
            vehicles=Sum('vehicles'),
            speeding=Sum('speeding_count'),
            swerving=Sum('swerving_count'),
            abrupt_stopping=Sum('abrupt_stopping_count'),
        )
        # Get thumbnail from most recent completed video
        latest_vid = cam_qs.order_by('-uploaded_at').values_list('thumbnail', flat=True).first()

        per_camera.append({
            'id': cam.id,
            'name': cam.name,
            'lat': cam.lat,
            'lng': cam.lng,
            'location': cam.location,
            'total_videos': cam_qs.count(),
            'vehicles': cam_totals['vehicles'] or 0,
            'speeding': cam_totals['speeding'] or 0,
            'swerving': cam_totals['swerving'] or 0,
            'abrupt_stopping': cam_totals['abrupt_stopping'] or 0,
            'adb': (cam_totals['speeding'] or 0)
                 + (cam_totals['swerving'] or 0)
                 + (cam_totals['abrupt_stopping'] or 0),
            'thumbnail': latest_vid if latest_vid else None,
            'tags': cam.tags if isinstance(cam.tags, list) else [],
        })

    return Response({
        "success": True,
        "totals": {
            "vehicles": total_vehicles,
            "adb": total_adb,
            "speeding": total_speeding,
            "swerving": total_swerving,
            "abrupt_stopping": total_abrupt,
        },
        "vehicle_breakdown": breakdown,
        "cameras": per_camera,
    })
