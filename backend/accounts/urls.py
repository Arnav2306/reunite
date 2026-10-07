from django.urls import path
from .views import SignupView, LoginView, MeView, LogoutView

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('register/', SignupView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('me/', MeView.as_view(), name='me'),
    path('logout/', LogoutView.as_view(), name='logout'),
]
