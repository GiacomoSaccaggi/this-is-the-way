from django.urls import path
from . import views

app_name = "core"

urlpatterns = [
    path("", views.hud, name="hud"),
    path("map/<slug:map_slug>/", views.hud, name="hud_map"),
    path("api/submit/", views.submit, name="submit"),
]
