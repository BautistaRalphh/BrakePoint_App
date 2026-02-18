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
    path('api/saved-locations/<int:pk>/behaviors/', views.saved_location_behaviors_api, name='saved_location_behaviors_api'),
    
    # Camera endpoints
    path('api/cameras/', views.cameras_api, name='cameras_api'),
    path('api/cameras/<int:pk>/', views.camera_delete_api, name='camera_delete_api'),
    path('api/cameras/<int:pk>/polygon/', views.camera_polygon_api, name='camera_polygon_api'),
    path('api/cameras/<int:pk>/calibration/', views.camera_calibration_api, name='camera_calibration_api'),
    path('api/cameras/<int:pk>/videos/', views.camera_videos_api, name='camera_videos_api'),
    path('api/upload_and_process/', views.upload_and_process_video, name='upload_and_process'),
    
    # Aggregation endpoints
    path('api/behavior-timeline/', views.behavior_timeline_api, name='behavior_timeline_api'),

    # Video endpoints
    path('api/videos/<int:pk>/', views.video_detail_api, name='video_detail_api'),
    path('api/videos/<int:pk>/progress/', views.video_progress_api, name='video_progress_api'),
]