from django.shortcuts import render, redirect
from django.http import HttpResponse, JsonResponse
from django.views import View
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from .models import SavedLocation

# Login View
class LoginView(View):
    def get(self, request):
        return render(request, 'BrakePoint/login.html')
    
    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('dashboard')
        else:
            messages.error(request, 'Invalid username or password.')
            return render(request, 'BrakePoint/login.html')

# Signup View
class SignupView(View):
    def get(self, request):
        return render(request, 'BrakePoint/signup.html')
    
    def post(self, request):
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
        
        # Validation
        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'BrakePoint/signup.html')
        
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Username already exists.')
            return render(request, 'BrakePoint/signup.html')
        
        if User.objects.filter(email=email).exists():
            messages.error(request, 'Email already registered.')
            return render(request, 'BrakePoint/signup.html')
        
        # Create user
        user = User.objects.create_user(username=username, email=email, password=password)
        messages.success(request, 'Account created successfully! Please log in.')
        return redirect('login')

# Home View
class HomeView(View):
    def get(self, request):
        return render(request, 'BrakePoint/home.html')

# Dashboard View
class DashboardView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')
        return render(request, 'BrakePoint/dashboard.html')
    
# Examine View
class ExamineView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')
        return render(request, 'BrakePoint/examine.html')

# Logout View
def logout_view(request):
    logout(request)
    messages.info(request, 'You have been logged out.')
    return redirect('login')


# ============== API Endpoints for Saved Locations ==============

@login_required
@require_http_methods(["GET", "POST"])
def saved_locations_api(request):
    """
    GET: List all saved locations for authenticated user
    POST: Create a new saved location for authenticated user
    """
    if request.method == 'GET':
        locations = SavedLocation.objects.filter(user=request.user)
        data = [{
            'id': loc.id,
            'name': loc.name,
            'lat': loc.lat,
            'lng': loc.lng,
            'zoom': loc.zoom,
            'bearing': loc.bearing,
            'pitch': loc.pitch,
            'created_at': loc.created_at.isoformat()
        } for loc in locations]
        return JsonResponse({'locations': data})
    
    elif request.method == 'POST':
        try:
            body = json.loads(request.body)
            location = SavedLocation.objects.create(
                user=request.user,
                name=body.get('name', 'Unnamed Location'),
                lat=float(body['lat']),
                lng=float(body['lng']),
                zoom=float(body.get('zoom', 17.0)),
                bearing=float(body.get('bearing', 0.0)),
                pitch=float(body.get('pitch', 0.0))
            )
            return JsonResponse({
                'success': True,
                'location': {
                    'id': location.id,
                    'name': location.name,
                    'lat': location.lat,
                    'lng': location.lng,
                    'zoom': location.zoom,
                    'bearing': location.bearing,
                    'pitch': location.pitch,
                    'created_at': location.created_at.isoformat()
                }
            }, status=201)
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["DELETE"])
def delete_saved_location_api(request, location_id):
    """
    DELETE: Delete a saved location
    """
    try:
        location = SavedLocation.objects.get(id=location_id, user=request.user)
        location.delete()
        return JsonResponse({'success': True})
    except SavedLocation.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Location not found or access denied'}, status=404)
