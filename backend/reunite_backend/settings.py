"""
Django settings for reunite_backend project.
"""

from pathlib import Path
import os
try:
    from dotenv import load_dotenv
    _base_dir_env = Path(__file__).resolve().parent.parent / '.env'
    _root_dir_env = Path(__file__).resolve().parent.parent.parent / '.env'
    if _base_dir_env.exists():
        load_dotenv(_base_dir_env)
    if _root_dir_env.exists():
        load_dotenv(_root_dir_env)
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

# ─────────────────────────────────────────────
# Security — load from environment in production
# ─────────────────────────────────────────────

# SECURITY WARNING: keep the secret key used in production secret!
# In production, set the DJANGO_SECRET_KEY environment variable.
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-h-*5bij6xj-riq$0^u5_@f1hmx2fc_ia56acpn$=*&z9g^^=o'
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS_ENV = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [h.strip() for h in ALLOWED_HOSTS_ENV.split(',') if h.strip()] or (
    ['*'] if DEBUG else []
)

# ─────────────────────────────────────────────
# AI Integration (optional — system degrades gracefully when not set)
# ─────────────────────────────────────────────

# Set GEMINI_API_KEY environment variable to enable AI image analysis.
# If not set, the AI analysis endpoint returns a safe fallback response.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-3.5-flash-lite')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

# ─────────────────────────────────────────────
# Application definition
# ─────────────────────────────────────────────

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'whitenoise.runserver_nostatic',
    'django.contrib.staticfiles',
    'cloudinary_storage',
    'cloudinary',
    'corsheaders',
    'reunite_backend.api',
    'rest_framework',
    'accounts',
    'items',
    'collectionpoint',
    'custody',
    'pickup',
    'notifications',
    'audit',
    'handovers',
    'rest_framework.authtoken',
]

# Custom user model
AUTH_USER_MODEL = 'accounts.User'

# Rest Framework defaults
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.BearerTokenAuthentication',
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ─────────────────────────────────────────────
# CORS & CSRF — configure for production deployment
# ─────────────────────────────────────────────
# In development, Vite proxy handles CORS transparently.
# In production, set CORS_ALLOWED_ORIGINS to the deployed frontend URL.
# Example: CORS_ALLOWED_ORIGINS=https://reunite.yourcollege.edu
_cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if _cors_origins_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
else:
    # In DEBUG mode, allow all origins for local development convenience
    CORS_ALLOW_ALL_ORIGINS = DEBUG

_csrf_origins_env = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
if _csrf_origins_env:
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_origins_env.split(',') if o.strip()]
elif CORS_ALLOWED_ORIGINS if '_cors_origins_env' in locals() and _cors_origins_env else False:
    CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS


ROOT_URLCONF = 'reunite_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'reunite_backend.wsgi.application'

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
# Default: SQLite for development.
# In production, DATABASE_URL must be configured with Railway PostgreSQL.
import sys
_is_collectstatic = 'collectstatic' in sys.argv
_is_test = 'test' in sys.argv

_database_url = os.environ.get('DATABASE_URL', '')
if _database_url:
    from urllib.parse import urlparse, unquote
    _parsed_db = urlparse(_database_url)
    if _parsed_db.scheme in ('postgres', 'postgresql'):
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': unquote(_parsed_db.path.lstrip('/') if _parsed_db.path else ''),
                'USER': unquote(_parsed_db.username or ''),
                'PASSWORD': unquote(_parsed_db.password or ''),
                'HOST': _parsed_db.hostname or 'localhost',
                'PORT': str(_parsed_db.port or 5432),
            }
        }
    else:
        if not DEBUG and not _is_collectstatic and not _is_test:
            from django.core.exceptions import ImproperlyConfigured
            raise ImproperlyConfigured(
                f"Invalid DATABASE_URL scheme '{_parsed_db.scheme}'. PostgreSQL is required in production (e.g. postgres://user:pass@host:5432/dbname)."
            )
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': str(BASE_DIR / 'db.sqlite3'),
            }
        }
else:
    _db_engine = os.environ.get('DB_ENGINE', 'django.db.backends.sqlite3')
    _db_name = os.environ.get('DB_NAME', str(BASE_DIR / 'db.sqlite3'))

    # Strictly reject container-local SQLite in production/staging to avoid data/account loss across restarts
    if not DEBUG and not _is_collectstatic and not _is_test:
        if _db_engine == 'django.db.backends.sqlite3':
            from django.core.exceptions import ImproperlyConfigured
            raise ImproperlyConfigured(
                "Production database configuration missing: DATABASE_URL must be configured with a PostgreSQL "
                "connection string in production/staging. Ephemeral container-local SQLite is strictly prohibited when DJANGO_DEBUG=False."
            )

    DATABASES = {
        'default': {
            'ENGINE': _db_engine,
            'NAME': _db_name,
            'USER': os.environ.get('DB_USER', ''),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }

# ─────────────────────────────────────────────
# Media & Static files
# ─────────────────────────────────────────────
STATIC_URL = 'static/'
STATIC_ROOT = os.environ.get('STATIC_ROOT', os.path.join(BASE_DIR, 'staticfiles'))

MEDIA_URL = os.environ.get('MEDIA_URL', '/media/')
MEDIA_ROOT = os.environ.get('MEDIA_ROOT', os.path.join(BASE_DIR, 'media'))

# Cloudinary Storage for media uploads (item images, etc.)
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY', '')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET', '')

# Local media storage is strictly disallowed in production/staging to prevent data loss across container restarts.
# In local development only, it can be explicitly chosen by setting USE_LOCAL_STORAGE=True alongside DJANGO_DEBUG=True.
USE_LOCAL_STORAGE = os.environ.get('USE_LOCAL_STORAGE', 'False').lower() in ('true', '1', 'yes')

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': CLOUDINARY_CLOUD_NAME,
        'API_KEY': CLOUDINARY_API_KEY,
        'API_SECRET': CLOUDINARY_API_SECRET,
        'PREFIX': 'reunite',
    }
    STORAGES = {
        'default': {
            'BACKEND': 'cloudinary_storage.storage.MediaCloudinaryStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }
elif (DEBUG and USE_LOCAL_STORAGE) or _is_collectstatic or _is_test:
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }
else:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        "Cloudinary configuration missing: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET "
        "must be set in environment variables. Container-local storage is not permitted in production/staging. "
        "For offline development only, set USE_LOCAL_STORAGE=True with DJANGO_DEBUG=True."
    )

# ─────────────────────────────────────────────
# Password validation
# ─────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# ─────────────────────────────────────────────
# Internationalization
# ─────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ─────────────────────────────────────────────
# Celery (optional — background task support)
# ─────────────────────────────────────────────
CELERY_BROKER_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = CELERY_BROKER_URL

# ─────────────────────────────────────────────
# Email
# ─────────────────────────────────────────────
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'Reunite Lost & Found <noreply@reunite.edu>')

