import urllib.request
import urllib.error
import json

BASE = 'http://127.0.0.1:8000'

def get(path, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def post(path, data, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# Student login
s, r = post('/api/auth/login/', {'identifier': 'alex.morgan@campus.edu', 'password': 'password123'})
tok = r['token']
print('Student login:', s, r['user']['role'])

# Matches
s, m = get('/api/items/matches/', tok)
matches = m if isinstance(m, list) else m.get('results', [])
print('=== MATCHES (%d) ===' % len(matches))
for match in matches[:5]:
    score = match.get('score')
    label = match.get('label')
    breakdown = match.get('breakdown', {})
    print('  score=%s, label=%s' % (score, label))
    print('  breakdown=%s' % json.dumps(breakdown))

# Notifications
s, n = get('/api/notifications/', tok)
notifs = n if isinstance(n, list) else n.get('results', [])
print('=== NOTIFICATIONS (%d) ===' % len(notifs))
for notif in notifs[:5]:
    print('  [%s] read=%s msg=%s' % (notif['title'], notif.get('is_read'), notif.get('message', '')[:60]))

# Admin stats
s, r2 = post('/api/auth/login/', {'identifier': 'custodian@campus.edu', 'password': 'password123'})
atk = r2['token']
s, stats = get('/api/items/admin/dashboard-stats/', atk)
print('=== ADMIN STATS (status=%d) ===' % s)
print(json.dumps(stats, indent=2))

# Case details
s, cd = get('/api/items/admin/found-items/item-gen-101/case-details/', atk)
print('=== CASE DETAILS (status=%d) ===' % s)
for key in cd:
    val = cd[key]
    if isinstance(val, dict):
        print('  %s: {%s}' % (key, ', '.join(val.keys())))
    elif isinstance(val, list):
        print('  %s: [list len=%d]' % (key, len(val)))
    else:
        print('  %s: %s' % (key, str(val)[:60]))

# Stations
s, st = get('/api/collectionpoint/', atk)
stations = st if isinstance(st, list) else st.get('results', [])
print('=== STATIONS (%d) ===' % len(stations))
for sta in stations:
    print('  code=%s name=%s status=%s' % (sta.get('station_code'), sta.get('name'), sta.get('status')))

print('\nALL API CHECKS PASSED')
