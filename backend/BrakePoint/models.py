from django.db import models
from django.contrib.auth.models import User

class SavedLocation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_locations')
    name = models.CharField(max_length=255)
    lat = models.FloatField()
    lng = models.FloatField()
    zoom = models.FloatField(default=17.0)
    bearing = models.FloatField(default=0.0)
    pitch = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.user.username})"

class Camera(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cameras')
    name = models.CharField(max_length=255, default='New Camera')
    lat = models.FloatField()
    lng = models.FloatField()
    location = models.CharField(max_length=500, blank=True, default='')
    polygon = models.JSONField(default=list, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.user.username}) at ({self.lat}, {self.lng})"
    
    @property
    def latest_video(self):
        """Get the most recent video for this camera"""
        return self.videos.order_by('-uploaded_at').first()
    
    @property
    def latest_upload(self):
        """Get the upload date of the most recent video in a clean format"""
        video = self.latest_video
        if video:
            return video.uploaded_at.strftime('%b %d, %Y at %I:%M %p')
        return None
    
    @property
    def total_videos(self):
        """Get total number of videos uploaded"""
        return self.videos.count()

class Video(models.Model):
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE, related_name='videos')
    filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    # Video metadata
    duration_seconds = models.FloatField(null=True, blank=True)
    fps = models.FloatField(null=True, blank=True)
    resolution = models.CharField(max_length=50, null=True, blank=True)  # e.g., "1920x1080"
    file_size_mb = models.FloatField(null=True, blank=True)
    thumbnail = models.TextField(null=True, blank=True)  # Base64-encoded JPEG thumbnail
    
    # Calibration data
    calibration_points = models.JSONField(default=list, blank=True)
    reference_points = models.JSONField(default=list, blank=True)
    reference_distance_meters = models.FloatField(null=True, blank=True)
    meter_per_pixel = models.FloatField(null=True, blank=True)
    
    # YOLO detection results
    vehicles = models.IntegerField(default=0)
    speeding_count = models.IntegerField(default=0)
    swerving_count = models.IntegerField(default=0)
    abrupt_stopping_count = models.IntegerField(default=0)
    vehicle_breakdown = models.JSONField(default=dict, blank=True)  # e.g., {"car": 10, "truck": 3}
    jeepney_hotspot = models.BooleanField(default=False)  # True if >15 jeepneys detected
    
    # Mask R-CNN traffic sign results
    signs = models.IntegerField(default=0)
    sign_classes = models.JSONField(default=list, blank=True)  # e.g., ["Stop Sign", "60kph Speed Limit"]
    sign_breakdown = models.JSONField(default=dict, blank=True)  # e.g., {"Stop Sign": 5, "60kph": 2}
    
    # Processing metadata
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processing_completed_at = models.DateTimeField(null=True, blank=True)
    processing_status = models.CharField(
        max_length=20, 
        default='pending',
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed')
        ]
    )
    processing_stage = models.CharField(
        max_length=20,
        default='',
        blank=True,
        choices=[
            ('', 'Not Started'),
            ('yolo', 'YOLO Detection'),
            ('mask-rcnn', 'Mask R-CNN Detection'),
            ('complete', 'Complete')
        ]
    )
    yolo_progress = models.IntegerField(default=0)  # 0-100
    maskrcnn_progress = models.IntegerField(default=0)  # 0-100
    error_message = models.TextField(blank=True, default='')
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.filename} - {self.camera.name} ({self.uploaded_at.strftime('%Y-%m-%d %H:%M')})"
    
    @property
    def occurrences(self):
        """Total aggressive behavior occurrences"""
        return self.speeding_count + self.swerving_count + self.abrupt_stopping_count
    
    @property
    def behaviors(self):
        """List of detected aggressive behaviors"""
        behaviors = []
        if self.speeding_count > 0:
            behaviors.append('Speeding')
        if self.swerving_count > 0:
            behaviors.append('Swerving')
        if self.abrupt_stopping_count > 0:
            behaviors.append('Abrupt Stopping')
        return behaviors if behaviors else ['No Data']
    
    @property
    def processing_time_seconds(self):
        """Calculate processing duration"""
        if self.processing_started_at and self.processing_completed_at:
            return (self.processing_completed_at - self.processing_started_at).total_seconds()
        return None
