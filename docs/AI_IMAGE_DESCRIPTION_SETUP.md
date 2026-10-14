# REUNITE — AI Image Description Setup Guide

This document describes the dual-provider vision architecture used by Reunite for automatic found-item identification, how to configure API credentials safely, and how to troubleshoot live inference.

---

## 1. Architecture Overview

* **Primary Provider**: **Google Gemini (Vision)**
  * Default Model: `gemini-3.8-flash` (or `gemini-3.1-flash-lite`)
  * Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent`
  * System Prompt: Enforces strict physical-only observation; strictly prohibits hallucinating serial numbers, IMEIs, internal contents, or private owners.

* **Fallback Provider**: **OpenAI (Vision)**
  * Default Model: `gpt-4o-mini`
  * Endpoint: `https://api.openai.com/v1/chat/completions`
  * Activated automatically when:
    1. Gemini returns an HTTP 429 quota exhaustion or rate limit error.
    2. Gemini encounters an authentication, model, or service error (such as HTTP 503 high-demand).
    3. `GEMINI_API_KEY` is omitted or invalid, but `OPENAI_API_KEY` is present.

* **Manual Description Fallback**:
  * If both providers fail, time out, or are unconfigured, the application gracefully allows manual entry without losing the user's uploaded photo or blocking item submission.
  * AI suggestions are strictly advisory: student reporters and campus custodians review and edit all attributes before final database registration.

---

## 2. Environment Variables & Secret Configuration

Reunite loads environment variables from two locations in order of precedence:
1. `backend/.env`
2. `.env` (Project Root)

> **CRITICAL SECURITY RULE:** Never paste API keys into code files, Git commits, or client-side React code. All keys are read exclusively server-side in Django.

### Variable Names

| Variable | Description | Default | Required? |
|---|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio API Key | *(empty)* | Recommended (Primary) |
| `GEMINI_MODEL` | Gemini vision model identifier | `gemini-3.8-flash` | Optional |
| `OPENAI_API_KEY` | OpenAI API Secret Key | *(empty)* | Recommended (Fallback) |
| `OPENAI_MODEL` | OpenAI vision model identifier | `gpt-4o-mini` | Optional |

### Entering Secrets Locally

Create or edit `backend/.env` (or project root `.env`):

```bash
# AI Vision Services
GEMINI_API_KEY=AIzaSy...your-gemini-key...
GEMINI_MODEL=gemini-3.8-flash

OPENAI_API_KEY=sk-proj-...your-openai-key...
OPENAI_MODEL=gpt-4o-mini
```

---

## 3. Restarting the Backend

After modifying `.env`, restart the Django development or production server:

### Development:
```powershell
# Stop current server (Ctrl+C), then:
cd backend
python manage.py runserver
```

### Production / Gunicorn:
```bash
sudo systemctl restart gunicorn
# or on containerized platforms (Railway/Docker):
# Update environment variables in the dashboard; Railway will automatically redeploy.
```

---

## 4. Testing Real Inference (Live Diagnostic)

Run the safe, non-leaking diagnostic management command:

```powershell
cd backend
python manage.py test_ai_inference
```

To test with a specific photograph:
```powershell
python manage.py test_ai_inference --image "path/to/item_photo.jpg"
```

The tool reports:
* Configuration status (`[CONFIGURED]` or `[NOT SET]`) without printing raw keys.
* Which provider succeeded (`GEMINI` or `OPENAI`).
* Formatted structured attributes (category, title, color, confidence, risk tier).
* Fallback engagement if Gemini failed.

---

## 5. Troubleshooting & Error Categories

### Google Gemini Errors

1. **HTTP 429 Quota Exhausted / Rate Limit**:
   * *Cause*: Free-tier RPM/RPD limit reached or billing disabled on project.
   * *Resolution*: Enable billing or upgrade quota in [Google AI Studio](https://aistudio.google.com/), or let Reunite automatically engage the OpenAI fallback.
2. **HTTP 401 / 403 Authentication Failed**:
   * *Cause*: Invalid API key, key restricted by IP/referrer, or disabled project.
   * *Resolution*: Generate a fresh API key in [Google AI Studio](https://aistudio.google.com/app/apikey) without HTTP referrer restrictions (server requests use IP/no referrer).
3. **HTTP 404 Model Not Found**:
   * *Cause*: Model identifier deprecated or region-restricted.
   * *Resolution*: Ensure `GEMINI_MODEL=gemini-1.5-flash` (or `gemini-2.5-flash` / `gemini-2.0-flash`).

### OpenAI Errors

1. **HTTP 429 Insufficient Quota**:
   * *Cause*: Zero balance in OpenAI billing account or rate limit reached.
   * *Resolution*: Add credits at [OpenAI Billing](https://platform.openai.com/account/billing).
2. **HTTP 401 Unauthorized**:
   * *Cause*: Revoked or incorrect secret key.
   * *Resolution*: Issue a new secret key at [OpenAI API Keys](https://platform.openai.com/api-keys).

---

## 6. Official References

* **Google Gemini Image Understanding**:
  [https://ai.google.dev/gemini-api/docs/image-understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
* **Google Gemini API Keys**:
  [https://ai.google.dev/gemini-api/docs/api-key](https://ai.google.dev/gemini-api/docs/api-key)
* **OpenAI Vision Guide**:
  [https://developers.openai.com/api/docs/guides/images-vision](https://developers.openai.com/api/docs/guides/images-vision)
