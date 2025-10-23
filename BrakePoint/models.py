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
