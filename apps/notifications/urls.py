from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, RegisterFCMTokenView

router = DefaultRouter()
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [
    
    path('register-fcm/',RegisterFCMTokenView.as_view(),name='register-fcm'),
    path('', include(router.urls)),
]