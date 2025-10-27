from django.urls import path
from . import views

urlpatterns = [
    path('api/login/', views.api_login, name='api_login'),
    path('api/signup/', views.api_signup, name='api_signup'),
    
    # API endpoints
    path('api/saved-locations/', views.saved_locations_api, name='saved_locations_api'),
    path('api/saved-locations/<int:location_id>/', views.saved_location_detail_api, name='saved_location_detail_api'),
]