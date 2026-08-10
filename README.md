# 📄 DocMatrix — AI-Powered Smart Document Management System

DocMatrix is an enterprise-grade AI-powered document management system featuring **Google Document AI OCR**, **Grounded Document Intelligence Chat with Romeo AI**, and **Docky Autonomous Assistant** for intelligent drive management.

---

## 🌟 Key Features

- **🤖 Document AI Intelligence**: High-accuracy OCR, entity extraction, risk assessment, and executive summarization powered by Google Document AI, Gemini 2.0 Flash, and Groq fallback.
- **💬 Grounded Chat with Romeo AI**: Conversational Q&A grounded strictly in document contents with page-level citations and zero vector retention.
- **⚡ Docky Autonomous Agent**: 9-stage NLP agent pipeline capable of performing file searches, tagging, organization, conversions, and drive operations via natural language.
- **☁️ Multi-Drive & Storage Integration**: Native integration with Supabase Cloud Storage, Google Drive, and virtual folder hierarchies.
- **🔒 Enterprise Security**: End-to-end JWT authentication, encrypted file metadata, and ephemeral cloud sessions.

---

## 🏗️ Tech Stack & Architecture

- **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons (Deployable on **Vercel**)
- **Backend**: Python 3.10+, FastAPI, Uvicorn, PyMuPDF, pdf2image, PyTesseract, Groq SDK, Google Cloud DocumentAI (Deployable on **Render**)
- **Database & Auth**: Supabase PostgreSQL + Auth & Storage

---

## 🚀 Production Deployment Guide

### 1. Frontend Deployment (Vercel)

1. Push your repository to GitHub.
2. Import the project into **Vercel** and set the Root Directory to `frontend`.
3. Add the following Environment Variable in Vercel:
   ```env
   VITE_API_URL=https://your-backend-name.onrender.com
   ```
4. Click **Deploy**. Vercel handles SPA routes via `vercel.json`.

---

### 2. Backend Deployment (Render)

1. Create a new **Web Service** on **Render** linked to your GitHub repository.
2. Set the Root Directory to `backend`.
3. Set the following build settings:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python run.py` (or `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main_new:app`)
4. Configure Environment Variables in Render Dashboard:
   ```env
   ENVIRONMENT=production
   DEBUG=false
   FRONTEND_URL=https://your-frontend-name.vercel.app
   ALLOWED_ORIGINS=https://your-frontend-name.vercel.app
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   JWT_SECRET_KEY=your-jwt-secret-key
   GROQ_API_KEY=your-groq-api-key
   GEMINI_API_KEY=your-gemini-api-key
   ```
5. Click **Deploy Web Service**.

---

## 💻 Local Development Setup

### Backend
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python run.py
```
Backend runs locally at: `http://localhost:8000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs locally at: `http://localhost:3000`

---

## 🔒 Security & Privacy
- Ephemeral AI sessions with zero vector database retention.
- Full CORS origin validation and token authorization on all endpoints.
