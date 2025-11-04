from django.urls import path
from . import views

urlpatterns = [
    path('api/csrf/', views.get_csrf_token, name='get_csrf_token'),
    path('api/check-auth/', views.check_auth, name='check_auth'),
    path('api/login/', views.api_login, name='api_login'),
    path('api/signup/', views.api_signup, name='api_signup'),
    
    # API endpoints
    path('api/saved-locations/', views.saved_locations_api, name='saved_locations_api'),
    path('api/saved-locations/<int:location_id>/', views.saved_location_detail_api, name='saved_location_detail_api'),
    
    # Camera endpoints
    path('api/cameras/', views.cameras_api, name='cameras_api'),
    path('api/cameras/<int:pk>/', views.camera_delete_api, name='camera_delete_api'),
    path('api/upload_and_process/', views.upload_and_process_video, name='upload_and_process'),
]