FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . /app/

# Collect static files
RUN python manage.py collectstatic --no-input

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate --no-input && gunicorn reunite_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120"]
