
# DocMatrix Frontend (React + Vite)

Modern React frontend for DocMatrix, featuring cloud, AI, analytics, and advanced UI/UX.

---

## Features (2026)

- Connects to FastAPI backend (local/cloud)
- Supabase and Google Drive BYOS support
- OAuth 2.0, email, OTP, JWT authentication
- File/folder management: create, rename, move, duplicate, delete, restore, favorite, tag, share
- Batch operations: move, tag, delete, share, favorite
- File viewer/editor: text, images, PDFs, Office docs, with undo/redo, find, preview
- Drag & drop upload, multi-file support
- Powerful search: fuzzy, tag, content-based
- Analytics: usage, storage, recent activity
- Activity log, version history, audit trail
- User preferences: view, sort, theme, notifications
- Modern UI: responsive, dark mode, keyboard shortcuts, context menus
- Offline support: browser localStorage fallback
- API proxying for local/cloud dev (Vite config)

---

## Project Structure

```
frontend/
├── public/
├── src/
│   ├── components/   # UI components
│   ├── context/      # App state management
│   ├── hooks/        # Custom React hooks
│   ├── utils/        # API, helpers
│   ├── App.jsx       # Main App
│   ├── main.jsx      # Entry point
│   └── index.css     # Tailwind styles
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Setup

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:3000
```

---

## API Integration

- Connects to backend at `http://localhost:8000` (configurable)
- Uses Axios for RESTful API calls
- Supports Supabase/Google Drive endpoints, JWT auth
- Proxy config in `vite.config.js` for local dev

---

## Technologies Used

- React 18, Vite, Tailwind CSS 3
- Axios, docx-preview, pdfjs, jszip, mammoth, papaparse, signature_pad
- Modern hooks/context for state management
- Vercel/Netlify ready (see `vercel.json`)

---

## Keyboard Shortcuts

| Shortcut | Action                       |
|----------|------------------------------|
| Ctrl+X   | Cut                          |
| Ctrl+C   | Copy                         |
| Ctrl+V   | Paste                        |
| Delete   | Move to trash / Delete       |
| F2       | Rename                       |
| Enter    | Open file/folder             |
| Escape   | Clear selection / Close modals|

---

## Offline & Cloud Modes

- **Offline**: Uses browser localStorage for all data
- **Cloud**: Uses backend API (Supabase, Google Drive, etc.)

---

## License

MIT License
