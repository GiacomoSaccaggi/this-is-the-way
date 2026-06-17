from django.db import models
from django.contrib.auth.models import User


class Map(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    grid_json = models.JSONField()  # {"width": N, "height": N, "walls": [[x,y],...], "start": [x,y], "end": [x,y]}
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Submission(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    pseudocode = models.TextField()
    generated_python = models.TextField(blank=True)
    telemetry = models.JSONField(null=True, blank=True)  # [[x,y], [x,y], ...]
    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user or 'anon'} → {self.map.slug} ({'✓' if self.success else '✗'})"
