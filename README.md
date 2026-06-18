# DocMatrix (SDMS)

DocMatrix is a smart document management system for browsing, previewing, and working with files in one place. It combines a web-based file manager, multi-format viewer, and AI-assisted document tooling.

Repository: https://github.com/premnarayn13/AI-SmartDocumentManagmentSystem.git

## What It Supports

- Secure sign-in and user sessions
- Folder and file browsing
- PDF viewing with power tools and annotations
- DOCX and PPTX preview and editing workflows
- CSV viewing and basic row or cell operations
- Image, video, and audio inspection tools
- MEGA cloud storage integration
- Version history and file activity features

## Quick Start

1. Clone the repository.

```powershell
git clone https://github.com/premnarayn13/AI-SmartDocumentManagmentSystem.git
cd AI-SmartDocumentManagmentSystem/SDMS_Clone
```

2. Copy the backend environment file and add your values.

```powershell
Copy-Item backend/.env.example backend/.env
```

3. Start the app.

```powershell
./start-dev.ps1
```

4. Open the web app.

- http://localhost:3000

## Requirements

- Python 3.11 or newer
- Node.js 18 or newer
- npm

## Project Structure

```text
SDMS_Clone/
  backend/
  frontend/
  supabase/
  start-dev.ps1
```

## MEGA Storage

You can connect MEGA from the app settings. After connecting, the app can browse, upload, download, and delete files through that storage connection.

## Security Notes

- Do not commit real secrets, API keys, or credentials.
- Keep environment values in `backend/.env` and out of source control.

## License

See the license files included in this repository.
