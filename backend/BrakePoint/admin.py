from django.contrib import admin
from .models import SavedLocation, Camera

@admin.register(SavedLocation)
class SavedLocationAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'user', 'lat', 'lng', 'created_at']
    list_filter = ['user', 'created_at']
    search_fields = ['name', 'user__username']

@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'lat', 'lng', 'created_at']
    list_filter = ['user', 'created_at']
    search_fields = ['user__username']
