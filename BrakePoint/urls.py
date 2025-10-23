from django.urls import path
from . import views

urlpatterns = [
    path('', views.HomeView.as_view(), name='home'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('signup/', views.SignupView.as_view(), name='signup'),
    path('examine/', views.ExamineView.as_view(), name='examine'),
    path('logout/', views.logout_view, name='logout'),
    
    # API endpoints for saved locations
    path('api/saved-locations/', views.saved_locations_api, name='saved_locations_api'),
    path('api/saved-locations/<int:location_id>/', views.delete_saved_location_api, name='delete_saved_location_api'),
]