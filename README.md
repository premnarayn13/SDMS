# DocMatrix (Smart Document Management System - SDMS)

DocMatrix is an enterprise-grade, AI-powered Smart Document Management System (SDMS) designed for browsing, previewing, managing, compressing, and collaborating on documents seamlessly. It combines a modern web file manager, dynamic multi-format viewers, Google Drive / MEGA cloud storage integrations, and AI agent assistance.

---

## ✨ Features & Capabilities

- 🔐 **Authentication & Security**: Multi-tier authentication (Supabase / Local DB) with session management and user permissions.
- 📁 **File & Folder Management**: Drag-and-drop uploads, virtual folder trees, move, rename, duplicate, trash/restore, and breadcrumbs.
- 📦 **ZIP Archive Tools (Compression & Extraction)**:
  - Compress single files or entire folders into `.zip` archives.
  - Right-click contextual **Extract ZIP** to unpack archives directly into your workspace.
- ☁️ **Cloud Storage Integrations**:
  - **Google Drive Integration**: Connect multiple Google Drive accounts with automatic token refresh and allocation limits.
  - **MEGA Storage**: Native MEGA cloud storage connection for direct upload/download.
- 📄 **Multi-Format Document Viewers & Power Tools**:
  - **PDF Power Tools**: Annotation, text extraction, page splitting, password protection, and merging.
  - **Office Documents**: Preview and edit DOCX, PPTX, XLSX, and CSV files in-browser.
  - **Media Workbench**: Image workbench, video playback, and audio inspection.
- 🤖 **Docky AI Agent Assistant**: Embedded AI chat agent for document summarization, search, and intelligent workflow assistance.
- 🔗 **Sharing & Collaboration**: Create public share links, manage file access, and inspect detailed version history & activity logs.

---

## 🚀 Quick Start

### Prerequisites
- **Python**: 3.10 or newer
- **Node.js**: 18.x or newer
- **npm**: 9.x or newer

### 1. Clone & Set Up

```powershell
git clone https://github.com/premnarayn13/SDMS.git
cd SDMS
```

### 2. Environment Configuration

Copy the example environment file for the backend and fill in your credentials:

```powershell
Copy-Item backend/.env.example backend/.env
```

### 3. Running Development Servers

Start both the FastAPI backend server and Vite frontend server:

```powershell
# Start Backend
cd backend
python run.py

# In a separate terminal, start Frontend
cd frontend
npm run dev
```

Open your browser at: `http://localhost:3000`

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Lucide Icons, JSZip, PDF.js, Mammoth.js, SheetJS
- **Backend**: Python, FastAPI, Uvicorn, Supabase Client, Google Drive API, PyPDF2
- **Database / Auth**: Supabase (PostgreSQL & Auth Services) / SQLite fallback

---

## 🛡️ License & Contributing

Contributions are welcome! Please ensure environment keys and credentials remain out of source control (`.env`).

### AI PDF Power Tools
Docky can now natively execute all of the PDF power tools directly via natural language commands (merging, splitting, watermarking, background colors, page numbering, and password protection).

### Native PDF Viewer
SDMS seamlessly falls back to the native browser PDF viewer for optimal performance and rendering of complex PDF documents.

### Interactive Voice Mode
Docky supports continuous voice listening and Text-to-Speech (TTS) for a fully hands-free document management experience.

### Document Analytics
Get insights into your document storage usage, file types, and history directly from the AI agent or dashboard.
