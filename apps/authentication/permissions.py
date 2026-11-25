from rest_framework import permissions


class IsPremiumOrAdmin(permissions.BasePermission):
    message = "Upgrade to a Premium account to export PDF and Excel financial reports."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, "role", "STUDENT") in ("PREMIUM", "ADMIN") or request.user.is_superuser


class IsAdminRole(permissions.BasePermission):
    message = "Administrator privileges are required to access user management."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, "role", "STUDENT") == "ADMIN" or request.user.is_superuser