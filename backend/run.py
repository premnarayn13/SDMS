"""
DocMatrix API - Development Server
Runs the new main application with all cloud features
"""
import uvicorn
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the backend directory
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

if __name__ == "__main__":
    # Use main_new for cloud features, main for legacy-only mode
    # Set LEGACY_MODE=true to use original local file storage
    use_legacy = os.getenv("LEGACY_MODE", "false").lower() == "true"
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    module = "app.main:app" if use_legacy else "app.main_new:app"
    
    print(f"🚀 Starting DocMatrix API...")
    print(f"📦 Module: {module}")
    print(f"🔗 API Docs: http://localhost:8000/docs")
    if use_legacy:
        print(f"⚠️  Running in LEGACY MODE (local storage, no auth)")
    else:
        if demo_mode:
            print(f"🎭 DEMO MODE enabled - Using in-memory storage")
            print(f"   📧 OTP Code for all emails: 123456")
        else:
            print(f"☁️  CLOUD MODE - Using Supabase")
    
    uvicorn.run(module, host="0.0.0.0", port=8000, reload=True)
