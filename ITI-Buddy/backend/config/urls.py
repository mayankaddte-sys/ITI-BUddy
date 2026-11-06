from django.conf import settings
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "ITI Buddy Administration"
admin.site.site_title = "ITI Buddy Admin"
admin.site.index_title = "Content, seats and events"

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/", include("buddy.urls")),
]
