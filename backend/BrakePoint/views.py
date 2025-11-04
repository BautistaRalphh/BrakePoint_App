from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib import messages
from django.contrib.auth import authenticate, login
from .models import SavedLocation, Camera
from .serializers import SavedLocationSerializer, SignupSerializer, CameraSerializer
import requests

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
        ser.save(user=user)
        return Response({"success": True, "camera": ser.data}, status=201)
    return Response({"success": False, "error": ser.errors}, status=400)

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

