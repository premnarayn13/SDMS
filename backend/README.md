
# DocMatrix Backend

Production-ready FastAPI backend for DocMatrix, built around modular services for authentication, document lifecycle operations, cloud integrations, auditability, and AI-assisted workflows.

This backend supports cloud-first APIs under `/api/v1` while preserving legacy compatibility routes under `/api` for existing frontend flows.

## Table Of Contents

- Backend Overview
- Core Capabilities
- Runtime Modes
- Architecture
- Service Modules
- API Route Map
- Environment Configuration
- Local Setup
- Run, Debug, and Validation
- Deployment Notes
- Security Best Practices
- Troubleshooting
- Quick Start (Clone to Running)
- License And Dependency Notices

## Backend Overview

DocMatrix backend is designed to provide:

- Secure user authentication and token/session management
- Document and folder lifecycle management
- Versioning and secure sharing controls
- Storage integration with Supabase and Google Drive (BYOS style)
- Activity logging and user-centric telemetry endpoints
- AI agent endpoints and NLP-ready pipeline dependencies

## Core Capabilities

### Authentication And Account Security

- Register, verify email, login, refresh token, logout
- Google OAuth authorization and callback exchange
- Forgot password, reset password, change password
- Session listing and session revocation endpoints
- OTP-based verification flows for secure operations

### Document Operations

- Upload and metadata update
- Download stream and view URL generation
- Move, duplicate, favorite, restore, soft delete, permanent delete
- Version upload and version history retrieval
- Sharing and tag operations
- DOCX tools endpoints for encryption/decryption

### Folder And Activity Domains

- Folder create/list/update/delete and hierarchy support
- Activity and audit-oriented API surfaces
- User profile/preferences and storage usage endpoints

### AI Agent Domain

- Agent endpoint group under `/api/v1/agent`
- Groq-powered LLM integration support
- NLP stack dependencies for extraction and analysis workflows

## Runtime Modes

The backend runner supports multiple modes:

- Cloud mode (default): uses `app.main_new:app` with Supabase-first behavior
- Demo mode: enabled with `DEMO_MODE=true` for in-memory/testing flows
- Legacy mode: enabled with `LEGACY_MODE=true` and serves `app.main:app`

Startup entrypoint:

- `run.py` selects runtime app module based on environment flags

## Architecture

### Stack

- FastAPI
- Uvicorn
- Pydantic v2 + pydantic-settings
- Supabase Python SDK
- python-jose + passlib + cryptography
- httpx for provider/API integration
- msoffcrypto-tool for Office-compatible DOCX security
- Optional AI/NLP stack: spaCy, langdetect, scikit-learn, gensim, Groq SDK

### Application Composition

- API app module: `app/main_new.py`
- Legacy compatibility app module: `app/main.py`
- Service routers mounted under `/api/v1`
- Global exception handlers and CORS middleware configured centrally

## Service Modules

Available service routers and prefixes:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/drive`
- `/api/v1/documents`
- `/api/v1/folders`
- `/api/v1/activity`
- `/api/v1/agent`

Notable compatibility route family (legacy frontend support):

- `/api/documents`
- `/api/folders`
- additional legacy endpoints in `main_new.py`

## API Route Map

### Auth (selected)

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `POST /api/v1/auth/google/token`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/auth/me`

### Documents (selected)

- `POST /api/v1/documents/upload`
- `GET /api/v1/documents`
- `GET /api/v1/documents/{document_id}`
- `GET /api/v1/documents/{document_id}/download`
- `PATCH /api/v1/documents/{document_id}`
- `POST /api/v1/documents/{document_id}/versions`
- `GET /api/v1/documents/{document_id}/versions`
- `POST /api/v1/documents/{document_id}/share`
- `POST /api/v1/documents/tools/docx/encrypt`
- `POST /api/v1/documents/tools/docx/decrypt`

### Observability Endpoints

- `GET /health`
- `GET /` (root metadata)
- `GET /docs` and `GET /redoc` in debug mode

## Environment Configuration

Use `backend/.env.example` as your template.

Minimum recommended variables:

```env
DEBUG=true
ENVIRONMENT=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:8000/api/v1/drive/callback

RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=DocMatrix

FRONTEND_URL=http://localhost:3000

GROQ_API_KEY=gsk_your_groq_api_key_here
```

Important:

- Never commit real secrets.
- Rotate all keys if they are ever exposed.
- Keep service role credentials backend-only.

## Local Setup

### Prerequisites

- Python 3.11 or newer
- pip
- virtualenv (via built-in venv)

### Install

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### Configure

```bash
copy .env.example .env
```

Then edit `.env` with your real provider keys and URLs.

### Run

```bash
python run.py
```

Server endpoints:

- API root: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Run, Debug, and Validation

### Health Check

```bash
curl http://localhost:8000/health
```

### Validate OpenAPI

Open in browser:

- `http://localhost:8000/docs`

### Typical Local Pairing With Frontend

- Backend runs at `8000`
- Frontend dev server runs at `3000`
- Ensure frontend proxy routes `/api` and `/api/v1` point to backend

## Deployment Notes

- Configure strict CORS origins per environment.
- Disable debug mode in production.
- Use secure secret management on deployment platform.
- Add request logging and error monitoring for all critical paths.
- Keep provider redirect URIs aligned with deployed domains.

## Security Best Practices

- Enforce strong JWT secret values and key rotation.
- Restrict OAuth redirect URIs to trusted hosts.
- Validate file type and upload size server-side.
- Review dependency vulnerabilities regularly.
- Keep OTP and auth policies environment-driven.

## Troubleshooting

### 401/403 During Login

- Verify JWT secret and token settings.
- Verify frontend points to correct backend host and route prefix.
- Confirm whether demo mode or cloud mode is currently active.

### OAuth Redirect Errors

- Check `GOOGLE_REDIRECT_URI` and `GOOGLE_DRIVE_REDIRECT_URI`.
- Confirm configured URI exactly matches provider console.

### Upload Or DOCX Tool Errors

- Ensure dependencies are installed from `requirements.txt`.
- Check provider credentials and storage permissions.
- Validate source file is a valid `.docx` for DOCX-specific endpoints.

### CORS Errors

- Ensure frontend origin appears in allowed origins list.
- Confirm `FRONTEND_URL` is set correctly.

## Quick Start (Clone To Running)

```bash
git clone https://github.com/premnarayn13/AI-SmartDocumentManagmentSystem.git
cd AI-SmartDocumentManagmentSystem/backend

python -m venv .venv

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
copy .env.example .env

# edit .env with your values, then run
python run.py
```

Backend will be available at:

- `http://localhost:8000`

## License And Dependency Notices

Project licensing:

- A dedicated repository-level `LICENSE` file is currently not present.

Third-party dependencies:

- This backend uses open-source packages from PyPI.
- Each dependency remains under its own license terms.
- Verify compatibility before production or commercial distribution.

Recommendation:

- Add an explicit root license file (for example MIT, Apache-2.0, or GPL) to formalize distribution terms.
