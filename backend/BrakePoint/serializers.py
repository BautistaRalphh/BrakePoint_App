from rest_framework import serializers
from .models import SavedLocation, Camera
from django.contrib.auth.models import User

class SavedLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedLocation
        fields = ['id','name','lat','lng','zoom','bearing','pitch']

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ['username','email','password']
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email',''),
            password=validated_data['password']
        )
        return user

class CameraSerializer(serializers.ModelSerializer):
    latest_upload = serializers.DateTimeField(required=False, allow_null=True)
    polygon = serializers.JSONField(required=False, allow_null=True)
    
    class Meta:
        model = Camera
        fields = ['id', 'name', 'lat', 'lng', 'location', 'latest_upload', 'vehicles', 'occurrences', 'behaviors', 'polygon', 'created_at']
        read_only_fields = ['id', 'created_at']