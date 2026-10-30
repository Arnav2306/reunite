from django.http import JsonResponse
from django.db import connection

def health_check(request):
    try:
        connection.ensure_connection()
        db_status = 'ok'
    except Exception:
        return JsonResponse({
            'status': 'degraded',
            'database': getattr(connection, 'vendor', 'unknown'),
            'database_status': 'unavailable',
        }, status=503)

    return JsonResponse({
        'status': 'ok',
        'database': connection.vendor,
        'database_status': db_status,
    })
