# File Fetching Troubleshooting Guide

## Issue Summary
After reconnecting a Google Drive, files are not fetching/opening in the DocMatrix application.

## Root Cause Analysis

### Primary Issue (FIXED ✅)
**Problem**: API base URL resolution was incorrect in development mode
- **Symptom**: Frontend running on `localhost:3001` calling `localhost:3001/api/v1/documents` instead of `localhost:8000/api/v1/documents`
- **Impact**: All document API calls were failing silently or returning wrong results
- **Fix Applied**: Updated `frontend/src/utils/documentApi.js` to properly resolve `http://localhost:8000` in dev mode

### Secondary Issue to Verify
**Problem**: MEGA Storage may be interfering with document listing
- **Check**: Verify MEGA Storage is not blocking the document fetch in AppContext.jsx

## How File Fetching Works

### Upload Flow
```
User connects Google Drive
  ↓
DocMatrix folder created on each Drive
  ↓
User uploads file
  ↓
File stored in Drive's DocMatrix folder
  ↓
File metadata saved to Supabase (file_metadata table)
  ↓
File appears in DocMatrix UI
```

### Display Flow  
```
User reconnects or app loads
  ↓
Frontend calls /api/v1/documents with user token
  ↓
Backend queries file_metadata table for user_id
  ↓
Files returned to frontend
  ↓
Frontend displays files in UI
```

## Testing Steps

### Step 1: Verify Backend API is Working
```bash
# Check backend health
curl -X GET http://localhost:8000/health

# Should return: {"status":"healthy","version":"2.0.0","environment":"development"}
```

### Step 2: Verify Frontend Can Reach Backend
```bash
# Open browser DevTools → Network tab
# Login to the app
# Check that API calls go to http://localhost:8000 (NOT http://localhost:3001)

# In browser console, verify:
console.log(import.meta.env.VITE_API_URL)  // Should be undefined or 'http://localhost:8000'
```

### Step 3: Authenticate and Connect Drive
1. Click **Login** on http://localhost:3001
2. Use your Google account credentials
3. Click **Settings** → **Connected Drives**
4. Click **+ Add Drive** and select your Google Drive
5. In browser DevTools, check Network tab for:
   - `POST /api/v1/auth/login` → 200 OK
   - `GET /api/v1/drives` → 200 OK
   - Verify response includes your drive with `folder_id` set to DocMatrix folder ID

### Step 4: Verify DocMatrix Folder Created
1. Open your Google Drive
2. Look for folder named **"DocMatrix"** at the root
3. If not present, try uploading a test file to trigger folder creation

### Step 5: Test Document Listing
In browser DevTools console:
```javascript
// Get auth token
const token = localStorage.getItem('access_token');

// Call documents endpoint
fetch('http://localhost:8000/api/v1/documents?view=all', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(d => console.log('Documents:', d))
.catch(e => console.error('Error:', e));
```

### Step 6: Test File Upload
1. Click **+ New** in DocMatrix
2. Select a file to upload
3. In DevTools Network tab, verify:
   - `POST /api/v1/documents/upload` → 200 OK
   - Response contains `id`, `drive_file_id`, `display_name`
4. Check Supabase dashboard → `file_metadata` table to confirm file is stored
5. After upload, file should appear in UI within 2-3 seconds

## Common Issues & Solutions

### Issue: Files don't appear after upload
**Possible Causes:**
1. **DocMatrix folder not created**
   - Solution: Upload a file manually to trigger creation
2. **MEGA Storage interfering**
   - Solution: Check AppContext.jsx loadCloudDocuments() for MEGA merge logic
3. **Supabase connection issue**
   - Solution: Check backend logs for Supabase errors
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### Issue: Redirect (307) when accessing documents
**Possible Causes:**
1. **Trailing slash in URL** (/api/v1/documents/ → redirects to /api/v1/documents)
   - Solution: Axios should auto-follow redirects (✅ Already handled)
2. **API base URL not configured**
   - Solution: Verify VITE_API_URL or default to localhost:8000 (✅ Already fixed)

### Issue: 401 Unauthorized when accessing documents
**Possible Causes:**
1. **No access token**
   - Solution: Refresh page and login again
2. **Token expired**
   - Solution: Refresh interceptor will auto-refresh (✅ Already implemented)
3. **Token invalid**
   - Solution: Clear localStorage and login again

### Issue: MEGA Storage button not working
**Possible Causes:**
1. **MEGA diagnostics interfering with document fetch**
   - Check: frontend/src/components/settings/SettingsPage.jsx
   - Verify: megaSettingsApi calls don't block documentOpsApi calls

## Environment Configuration

### Frontend (.env or .env.local)
```env
VITE_API_URL=http://localhost:8000
VITE_LEGACY_MODE=false
VITE_FORCE_CLOUD=true
```

### Backend (.env)
```env
DEBUG=true
DEMO_MODE=false
SUPABASE_URL=https://whydipakxluuygscfavm.supabase.co
FRONTEND_URL=http://localhost:3001  # Updated for port 3001
```

## Debug Logs to Check

### Backend Logs
```bash
# Watch for errors in terminal running `npm run dev` or `python run.py`
# Look for:
# - "DocMatrix folder" messages (folder creation)
# - "Failed to load cloud documents" (fetch errors)
# - "Supabase" connection issues
```

### Frontend Logs
Open DevTools Console:
```javascript
// Check for errors
console.log('Errors:', localStorage.getItem('debug_errors'));

// Check network requests
// Tab: Network → Filter: "documents" → Check status codes
```

## Quick Fixes Checklist

- [ ] Frontend rebuilt after API URL fix
- [ ] Backend running on port 8000
- [ ] Frontend running on port 3001 (or confirmed correct port in dev)
- [ ] User authenticated with Google OAuth
- [ ] Google Drive connected in Settings
- [ ] MEGA Storage not blocking document fetch
- [ ] Supabase connection verified
- [ ] DocMatrix folder exists in Google Drive
- [ ] Access token is valid (check localStorage)

## Validation Script

Run this Python script to validate the entire flow:

```python
import requests
import json
from datetime import datetime

API_BASE = "http://localhost:8000/api/v1"
TOKEN = "your-access-token-here"  # Get from browser localStorage

headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Test 1: Health check
print("[1] Health Check...")
r = requests.get("http://localhost:8000/health")
print(f"  Status: {r.status_code} {'✅' if r.status_code == 200 else '❌'}")

# Test 2: List documents
print("\n[2] List Documents...")
r = requests.get(f"{API_BASE}/documents?view=all", headers=headers)
print(f"  Status: {r.status_code} {'✅' if r.status_code == 200 else '❌'}")
if r.status_code == 200:
    data = r.json()
    print(f"  Found {data.get('total', 0)} documents")
    print(f"  Sample: {json.dumps(data.get('documents', [])[:1], indent=2)}")

# Test 3: List drives
print("\n[3] List Drives...")
r = requests.get(f"{API_BASE}/drives", headers=headers)
print(f"  Status: {r.status_code} {'✅' if r.status_code == 200 else '❌'}")
if r.status_code == 200:
    drives = r.json()
    for drive in drives:
        print(f"  Drive: {drive.get('name')} - Folder ID: {drive.get('folder_id')}")
```

## Files Modified

- `frontend/src/utils/documentApi.js` - Fixed API base URL resolution
- `frontend/.env` - Added VITE_API_URL if needed
- `backend/.env` - Updated FRONTEND_URL to match port

## Next Steps

1. **Clear browser cache** and refresh: `Ctrl+Shift+Del`
2. **Close all terminals** and restart:
   - Backend: `cd backend && python run.py`
   - Frontend: `cd frontend && npm run dev`
3. **Login and test** with the steps above
4. **Check browser DevTools** Network tab for any 4xx/5xx errors
5. **Report errors** with screenshot from DevTools

---

**Last Updated**: 2026-04-28
**Status**: ✅ API Base URL Fix Applied
**Testing**: Pending user verification
