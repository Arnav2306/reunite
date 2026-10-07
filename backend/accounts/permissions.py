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
        return request.user.is_authenticated and request.user.role == 'admin'


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'superadmin'


class IsStaff(BasePermission):
    """Custodian, Admin, or SuperAdmin"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['custodian', 'admin', 'superadmin']


class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return hasattr(obj, 'user') and obj.user == request.user


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return getattr(obj, 'user', None) == request.user
