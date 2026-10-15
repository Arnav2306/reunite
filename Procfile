web: gunicorn --chdir backend reunite_backend.wsgi:application --bind 0.0.0.0:$PORT
release: python backend/manage.py migrate --no-input
