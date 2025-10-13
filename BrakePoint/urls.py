from django.urls import path
from . import views

urlpatterns = [
    path('', views.LoginView.as_view(), name='home'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('signup/', views.SignupView.as_view(), name='signup'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('logout/', views.logout_view, name='logout'),
]