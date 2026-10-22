from rest_framework.permissions import BasePermission
from .models import User


class IsStudent(BasePermission):
    """Allow only users with role 'student'."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'student'


class IsCustodian(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'custodian'


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (getattr(request.user, 'role', '') in ['admin', 'superadmin'] or getattr(request.user, 'is_superuser', False))
        )


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (getattr(request.user, 'role', '') == 'superadmin' or getattr(request.user, 'is_superuser', False))
        )


class IsStaff(BasePermission):
    """Custodian, Admin, or SuperAdmin"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (getattr(request.user, 'role', '') in ['custodian', 'admin', 'superadmin'] or getattr(request.user, 'is_staff', False))
        )


class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return hasattr(obj, 'user') and obj.user == request.user


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return getattr(obj, 'user', None) == request.user
