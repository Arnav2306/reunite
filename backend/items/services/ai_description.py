import os
import json
import base64
import urllib.request
import urllib.error
from django.conf import settings

VALUABLE_CATEGORIES = {
    'electronics', 'smartphone', 'phone', 'laptop', 'tablet', 'smartwatch',
    'headphones', 'earphones', 'wallet', 'purse', 'identification card', 'id card',
    'credit card', 'debit card', 'jewellery', 'watch', 'helmets', 'helmet'
}

# Categories that require Vehicle Keys matching treatment
VEHICLE_KEY_CATEGORY_TERMS = {
    'vehicle keys', 'vehicle key', 'car key', 'motorcycle key', 'scooter key',
    'scooty key', 'scooty', 'key fob', 'remote key', 'smart key', 'proximity key'
}

def clean_json_text(text: str) -> str:
    t = text.strip()
    if t.startswith('```'):
        lines = t.split('\n')
        if lines and lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith('```'):
            lines = lines[:-1]
        t = '\n'.join(lines).strip()
    return t

def get_ai_configuration_status():
    """Returns safe boolean flags for provider configuration without revealing keys."""
    gemini_key = os.environ.get('GEMINI_API_KEY') or getattr(settings, 'GEMINI_API_KEY', '')
    openai_key = os.environ.get('OPENAI_API_KEY') or getattr(settings, 'OPENAI_API_KEY', '')
    gemini_model = os.environ.get('GEMINI_MODEL') or getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    openai_model = os.environ.get('OPENAI_MODEL') or getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')

    return {
        'primary_provider': 'gemini',
        'fallback_provider': 'openai',
        'gemini_configured': bool(gemini_key and gemini_key.strip()),
        'gemini_model': gemini_model,
        'openai_configured': bool(openai_key and openai_key.strip()),
        'openai_model': openai_model,
    }

def call_gemini_vision(gemini_key: str, encoded_image: str, content_type: str, prompt: str):
    """Calls Google Gemini Vision API."""
    model_name = os.environ.get('GEMINI_MODEL') or getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": content_type,
                            "data": encoded_image
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "response_mime_type": "application/json"
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            res_body = json.loads(resp.read().decode('utf-8'))
            candidate = res_body['candidates'][0]['content']['parts'][0]['text']
            cleaned = clean_json_text(candidate)
            parsed = json.loads(cleaned)
            return parsed, None, None
    except urllib.error.HTTPError as err:
        err_text = err.read().decode('utf-8', errors='ignore')[:300]
        if err.code == 429:
            category = 'quota_exhausted'
            msg = f"Gemini API quota or rate limit reached (HTTP 429): {err_text}"
        elif err.code in (401, 403):
            category = 'auth_invalid'
            msg = f"Gemini API authentication failed (HTTP {err.code}): verify your GEMINI_API_KEY."
        elif err.code == 404:
            category = 'model_unavailable'
            msg = f"Gemini model '{model_name}' not found (HTTP 404): check GEMINI_MODEL setting."
        elif err.code == 503:
            category = 'service_unavailable'
            msg = f"Gemini API temporarily unavailable (HTTP 503 - high demand): please try again or describe manually."
        else:
            category = 'http_error'
            msg = f"Gemini API returned HTTP {err.code}: {err_text}"
        return None, msg, category
    except urllib.error.URLError as url_err:
        return None, f"Network connection to Gemini API failed: {url_err.reason}", 'network_error'
    except TimeoutError:
        return None, "Gemini API request timed out (25s).", 'timeout'
    except (KeyError, json.JSONDecodeError, IndexError) as parse_err:
        return None, f"Gemini response could not be parsed: {str(parse_err)}", 'parse_error'
    except Exception as exc:
        return None, f"Gemini call error: {str(exc)}", 'unknown_error'

def call_openai_vision(openai_key: str, encoded_image: str, content_type: str, prompt: str):
    """Calls OpenAI Vision API as fallback."""
    model_name = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Analyze this found item photograph according to guidelines."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{encoded_image}"}
                    }
                ]
            }
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            res_body = json.loads(resp.read().decode('utf-8'))
            content = res_body['choices'][0]['message']['content']
            cleaned = clean_json_text(content)
            parsed = json.loads(cleaned)
            return parsed, None, None
    except urllib.error.HTTPError as err:
        err_text = err.read().decode('utf-8', errors='ignore')[:300]
        if err.code == 429:
            category = 'quota_exhausted'
            msg = f"OpenAI API quota or rate limit reached (HTTP 429): {err_text}"
        elif err.code in (401, 403):
            category = 'auth_invalid'
            msg = f"OpenAI API authentication failed (HTTP {err.code}): verify your OPENAI_API_KEY."
        elif err.code == 404:
            category = 'model_unavailable'
            msg = f"OpenAI model '{model_name}' not found (HTTP 404): check OPENAI_MODEL setting."
        else:
            category = 'http_error'
            msg = f"OpenAI API returned HTTP {err.code}: {err_text}"
        return None, msg, category
    except urllib.error.URLError as url_err:
        return None, f"Network connection to OpenAI API failed: {url_err.reason}", 'network_error'
    except TimeoutError:
        return None, "OpenAI API request timed out (25s).", 'timeout'
    except (KeyError, json.JSONDecodeError, IndexError) as parse_err:
        return None, f"OpenAI response could not be parsed: {str(parse_err)}", 'parse_error'
    except Exception as exc:
        return None, f"OpenAI call error: {str(exc)}", 'unknown_error'

def analyze_item_image(image_file):
    """
    Analyzes an uploaded found item image to generate a structured descriptive suggestion.
    Primary provider: Google Gemini (vision)
    Fallback provider: OpenAI (gpt-4o-mini)

    Adheres strictly to Reunite safety requirements:
    1. Describes only visible physical traits.
    2. Never invents serial numbers, IMEIs, internal marks, or private ownership facts.
    3. Categorizes risk tier into General (0) or Valuable (1).
    4. Provides confidence or uncertainty ('Unknown' / null if unidentifiable).
    5. Advisory only: Human review remains authoritative.
    6. Gracefully degrades if providers fail or keys are unconfigured.
    """
    gemini_key = os.environ.get('GEMINI_API_KEY') or getattr(settings, 'GEMINI_API_KEY', '')
    openai_key = os.environ.get('OPENAI_API_KEY') or getattr(settings, 'OPENAI_API_KEY', '')

    has_gemini = bool(gemini_key and gemini_key.strip())
    has_openai = bool(openai_key and openai_key.strip())

    if not has_gemini and not has_openai:
        return {
            'available': False,
            'provider': None,
            'detail': 'AI analysis is currently not configured (neither GEMINI_API_KEY nor OPENAI_API_KEY found). Please describe the item manually.',
            'suggestion': None
        }

    try:
        # Validate and read image
        if hasattr(image_file, 'seek'):
            image_file.seek(0)
        image_bytes = image_file.read()
        if hasattr(image_file, 'seek'):
            image_file.seek(0)

        if not image_bytes or len(image_bytes) < 32:
            return {
                'available': False,
                'provider': None,
                'detail': 'Invalid or empty image file uploaded. Please provide a valid photo.',
                'suggestion': None
            }

        encoded_image = base64.b64encode(image_bytes).decode('utf-8')
        raw_ct = getattr(image_file, 'content_type', '') or ''
        if raw_ct and raw_ct.startswith('image/'):
            content_type = raw_ct.lower()
        else:
            filename = getattr(image_file, 'name', '') or ''
            ext = filename.lower().split('.')[-1] if '.' in filename else ''
            if ext == 'png':
                content_type = 'image/png'
            elif ext == 'webp':
                content_type = 'image/webp'
            elif ext == 'gif':
                content_type = 'image/gif'
            else:
                content_type = 'image/jpeg'

        system_prompt = (
            "You are an AI assistant for a college campus Lost and Found recovery platform named Reunite. "
            "Your task is to inspect an uploaded photograph of a found item and generate structured physical attributes "
            "to assist campus custodians, staff, and students during item reporting and matching.\n\n"
            "STRICT RULES:\n"
            "1. ONLY describe physical attributes that are clearly and indisputably visible in the image.\n"
            "2. NEVER invent, guess, or hallucinate serial numbers, IMEI numbers, owner names, passwords, or hidden contents.\n"
            "3. If any detail cannot be determined with certainty, return null or 'Unknown'.\n"
            "4. Never claim that an item belongs to a specific person.\n"
            "5. AI is advisory only. Human review remains authoritative.\n"
            "6. Output MUST be a valid JSON object matching the following structure without markdown code fences:\n"
            "{\n"
            '  "category": "Electronics | Bottles & Containers | Stationery & Books | Keys & Badges | Vehicle Keys | '
            'Clothing & Accessories | Wallet & Cards | Bags & Luggage | Jewellery & Watches | Sports & Fitness | '
            'Documents & ID | Helmets & Riding Gear | Headphones & Earphones | Chargers & Cables | Other",\n'
            '  "item_name": "concise name of the item",\n'
            '  "primary_color": "primary visible color",\n'
            '  "secondary_colors": "secondary visible colors or null",\n'
            '  "brand": "visible brand or Unknown",\n'
            '  "model": "visible model or Unknown",\n'
            '  "material": "visible material or Unknown",\n'
            '  "visible_text": "any text clearly printed or engraved on the exterior or null",\n'
            '  "distinguishing_features": "stickers, scratches, dents, keychains, or unique visible marks or null",\n'
            '  "condition": "visible condition (e.g. New, Good, Scratched, Worn) or Unknown",\n'
            '  "approximate_description": "2-3 concise factual sentences describing what is visible",\n'
            '  "confidence": "High | Medium | Low"\n'
            "}"
        )

        parsed = None
        used_provider = None
        gemini_err = None
        openai_err = None

        # 1. Primary: Gemini
        if has_gemini:
            parsed, gemini_err, gemini_category = call_gemini_vision(gemini_key, encoded_image, content_type, system_prompt)
            if parsed:
                used_provider = 'gemini'

        # 2. Fallback: OpenAI if Gemini failed or unconfigured
        if not parsed and has_openai:
            parsed, openai_err, openai_category = call_openai_vision(openai_key, encoded_image, content_type, system_prompt)
            if parsed:
                used_provider = 'openai'

        # 3. If neither succeeded, return diagnostics
        if not parsed:
            diagnostic_parts = []
            if gemini_err:
                diagnostic_parts.append(f"Gemini (primary): {gemini_err}")
            elif not has_gemini:
                diagnostic_parts.append("Gemini (primary): Not configured (GEMINI_API_KEY missing).")

            if openai_err:
                diagnostic_parts.append(f"OpenAI (fallback): {openai_err}")
            elif not has_openai:
                diagnostic_parts.append("OpenAI (fallback): Not configured (OPENAI_API_KEY missing).")

            detail_msg = " | ".join(diagnostic_parts) + ". Manual description entry enabled."
            return {
                'available': False,
                'provider': None,
                'detail': detail_msg,
                'suggestion': None
            }

        # 4. Map parsed structured attributes cleanly
        cat_str = str(parsed.get('category', '')).lower()
        sub_str = str(parsed.get('subcategory', '')).lower()
        is_valuable = any(v in cat_str or v in sub_str for v in VALUABLE_CATEGORIES)
        risk_tier = 1 if is_valuable else 0

        primary_col = parsed.get('primary_color') or parsed.get('color') or 'Unknown'
        parsed['primary_color'] = primary_col
        parsed['color'] = primary_col
        parsed['apparent_color'] = primary_col
        parsed['secondary_colors'] = parsed.get('secondary_colors') or None
        parsed['brand'] = parsed.get('brand') or 'Unknown'
        parsed['visible_brand'] = parsed['brand']
        parsed['material'] = parsed.get('material') or 'Unknown'
        parsed['visible_text'] = parsed.get('visible_text') or parsed.get('text_visible_in_image') or None
        parsed['distinguishing_features'] = parsed.get('distinguishing_features') or None
        parsed['visible_characteristics'] = parsed.get('visible_features') or parsed.get('distinguishing_features') or ''
        parsed['condition'] = parsed.get('condition') or 'Unknown'
        parsed['confidence'] = parsed.get('confidence') or 'Medium'
        parsed['suggested_title'] = parsed.get('item_name') or parsed.get('suggested_title') or 'Found Item'
        parsed['suggested_category'] = parsed.get('category') or parsed.get('suggested_category') or 'General'

        desc = (parsed.get('approximate_description') or parsed.get('safe_description') or '').strip()
        if not desc:
            parts = []
            if parsed.get('primary_color') and parsed['primary_color'] != 'Unknown':
                parts.append(f"{parsed['primary_color']} in color")
            if parsed.get('brand') and parsed['brand'] != 'Unknown':
                parts.append(f"brand {parsed['brand']}")
            if parsed.get('material') and parsed['material'] != 'Unknown':
                parts.append(f"made of {parsed['material']}")
            if parsed.get('condition') and parsed['condition'] != 'Unknown':
                parts.append(f"condition {parsed['condition']}")
            if parsed.get('distinguishing_features'):
                parts.append(f"notable marks: {parsed['distinguishing_features']}")
            desc = f"Found {parsed['suggested_title']}" + (f", {', '.join(parts)}." if parts else ".")
        parsed['safe_description'] = desc
        parsed['risk_tier'] = risk_tier
        parsed['provider'] = used_provider

        success_msg = f"AI analysis completed successfully via {used_provider.capitalize()}."
        if used_provider == 'openai' and has_gemini:
            success_msg += " (Fallback used as Gemini was unavailable)."

        return {
            'available': True,
            'provider': used_provider,
            'detail': success_msg,
            'suggestion': parsed
        }

    except TimeoutError:
        return {
            'available': False,
            'provider': None,
            'detail': 'AI analysis timed out. Please describe the item manually and submit.',
            'suggestion': None
        }
    except Exception as exc:
        return {
            'available': False,
            'provider': None,
            'detail': f"AI analysis failed: {str(exc)}",
            'suggestion': None
        }


