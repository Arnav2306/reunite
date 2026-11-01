from django.db import models
from django.db.models import Q
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import uuid

class UserManager(BaseUserManager):
    def _create_user(self, email, password, **extra_fields):
        if not email and not extra_fields.get('mobile_number') and not extra_fields.get('admin_id'):
            raise ValueError('Either email, mobile number, or admin_id must be set')
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

    def create_superuser(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'superadmin')
        if not email and not extra_fields.get('admin_id'):
            raise ValueError('Superuser must have an email or admin_id.')
        if extra_fields.get('is_staff') is not True or extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_staff=True and is_superuser=True.')
        return self._create_user(email, password, **extra_fields)

    def get_by_natural_key(self, username):
        if not username:
            raise self.model.DoesNotExist
        cleaned = str(username).strip()
        user = self.filter(
            Q(admin_id__iexact=cleaned)
            | Q(email__iexact=cleaned)
            | Q(personal_email__iexact=cleaned)
            | Q(mobile_number=cleaned)
        ).first()
        if not user:
            raise self.model.DoesNotExist
        return user

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('custodian', 'Custodian'),
        ('admin', 'Admin'),
        ('superadmin', 'Super Admin'),
    ]
    id = models.BigAutoField(primary_key=True)
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    admin_id = models.CharField(max_length=50, blank=True, null=True, unique=True, db_index=True)
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
        if self.admin_id:
            self.admin_id = self.admin_id.strip()
        if self.is_superuser or self.role == 'superadmin':
            self.role = 'superadmin'
            self.is_staff = True
            self.is_superuser = True
        elif self.role in ['admin', 'custodian']:
            self.is_staff = True
        elif self.role == 'student' and not self.is_superuser:
            self.is_staff = False
        super().save(*args, **kwargs)

    def __str__(self):
        identifier = self.admin_id or self.email or self.mobile_number or str(self.public_id)
        return f"{identifier} ({self.get_role_display()})"
