from django.urls import path

from . import views

urlpatterns = [
    path("passages", views.passages),
    path("districts", views.districts),
    path("trades", views.trades),
    path("seats", views.seats),
    path("events", views.events),
    path("chat", views.chat),
    path("feedback", views.feedback),
]
