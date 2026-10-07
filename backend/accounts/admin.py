from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'mobile_number', 'name', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'mobile_number', 'name')
    ordering = ('email',)
    fieldsets = (
        (None, {'fields': ('email', 'mobile_number', 'password')}),
        ('Personal info', {'fields': ('name', 'personal_email')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'mobile_number', 'name', 'role', 'password'),
        }),
    )

