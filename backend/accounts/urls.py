from django.urls import path
from .views import (
    SignupView, LoginView, MeView, LogoutView,
    PasswordResetRequestView, PasswordResetConfirmView,
    AdminUserManagementView
)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('register/', SignupView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('users/', AdminUserManagementView.as_view(), name='admin_users'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('me/', MeView.as_view(), name='me'),
    path('logout/', LogoutView.as_view(), name='logout'),
]
