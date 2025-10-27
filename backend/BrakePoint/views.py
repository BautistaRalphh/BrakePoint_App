from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login
from .models import SavedLocation
from .serializers import SavedLocationSerializer, SignupSerializer

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
@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"success": False, "error": "Invalid credentials"}, status=400)
    login(request, user)  # sets session cookie
    return Response({"success": True, "user": {"username": user.username}})

@api_view(['POST'])
@permission_classes([AllowAny])
def api_signup(request):
    ser = SignupSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response({"success": True})
    return Response({"success": False, "error": ser.errors}, status=400)