"""Test Gemini API - try multiple models with longer timeout."""
import os, json, urllib.request, urllib.error, pathlib, time

env_path = pathlib.Path('backend/.env')
for line in env_path.read_text(encoding='utf-8', errors='ignore').splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ[k.strip()] = v.strip()

key = os.environ.get('GEMINI_API_KEY', '')
print(f'Key configured: {bool(key)}, length={len(key)}')

# Try models from most-stable to newest
models_to_try = [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
]

for model in models_to_try:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    payload = {
        'contents': [{'parts': [{'text': 'Say OK'}]}],
        'generationConfig': {'temperature': 0.0}
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    print(f'Trying {model}...', end=' ', flush=True)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            body = json.loads(r.read())
            text = body['candidates'][0]['content']['parts'][0]['text']
            print(f'SUCCESS! Response: {text.strip()[:80]}')
            print(f'\n=== WORKING MODEL: {model} ===')
            break
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors='ignore')[:150]
        print(f'HTTP {e.code}')
        if e.code not in (503, 429):
            print(f'  Detail: {err}')
        time.sleep(2)
    except Exception as ex:
        print(f'Error: {type(ex).__name__}: {ex}')
        time.sleep(2)
