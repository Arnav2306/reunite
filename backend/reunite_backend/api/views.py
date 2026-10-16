from django.http import JsonResponse
from django.db import connection

def health_check(request):
    return JsonResponse({
        'status': 'ok',
        'database': connection.vendor,
    })
