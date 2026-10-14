import sys
import os
import traceback

try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'reunite_backend.settings')
    import django
    django.setup()
    print("Django setup OK")
    print("SECRET_KEY set:", bool(django.conf.settings.SECRET_KEY))
    print("DEBUG:", django.conf.settings.DEBUG)
    print("GEMINI_API_KEY set:", bool(django.conf.settings.GEMINI_API_KEY))
    print("GEMINI_MODEL:", django.conf.settings.GEMINI_MODEL)
    print("DATABASES:", django.conf.settings.DATABASES)
except Exception as e:
    print("ERROR:", repr(e))
    traceback.print_exc()
    sys.exit(1)
