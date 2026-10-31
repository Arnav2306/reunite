from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import uuid

class UserManager(BaseUserManager):
    def _create_user(self, email, password, **extra_fields):
        if not email and not extra_fields.get('mobile_number'):
            raise ValueError('Either email or mobile number must be set')
        if email:
            email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'superadmin')
        if not email:
            raise ValueError('Superuser must have an email.')
        if extra_fields.get('is_staff') is not True or extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_staff=True and is_superuser=True.')
        return self._create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('custodian', 'Custodian'),
        ('admin', 'Admin'),
        ('superadmin', 'Super Admin'),
    ]
    id = models.BigAutoField(primary_key=True)
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    email = models.EmailField('email address', unique=True, null=True, blank=True)
    personal_email = models.EmailField(blank=True, null=True)
    mobile_number = models.CharField(max_length=20, blank=True, null=True, unique=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=12, choices=ROLE_CHOICES, default='student')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'auth_user'
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = 'superadmin'
            self.is_staff = True
        elif self.role in ['admin', 'superadmin', 'custodian']:
            self.is_staff = True
        elif self.role == 'student' and not self.is_superuser:
            self.is_staff = False
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"
