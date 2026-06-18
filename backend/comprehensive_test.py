"""
Comprehensive Login Test
Simulates what the backend does during login
"""
import sys
sys.path.insert(0, 'D:\\SDMS\\SDMS_Clone\\backend')

from app.utils.security import password_handler
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

email = "naraynpremnl1304@gmail.com"
password = "Test@123"

print(f"🔍 Simulating login for: {email}")
print(f"   Password: {password}")

# Step 1: Find user
print(f"\n📊 Step 1: Finding user...")
result = supabase.table("users").select("*").eq("email", email).execute()

if not result.data:
    print("❌ User not found")
    sys.exit(1)

user = result.data[0]
print(f"✅ User found: {user['id']}")

# Step 2: Check auth provider
auth_provider = user.get("auth_provider", "email")
print(f"\n📊 Step 2: Auth provider check...")
print(f"   Provider: {auth_provider}")

if auth_provider == "google" and not user.get("password_hash"):
    print("❌ Google user without password hash")
    sys.exit(1)

# Step 3: Get password hash
password_hash = user.get("password_hash", "")
print(f"\n📊 Step 3: Password hash...")
print(f"   Hash exists: {bool(password_hash)}")
print(f"   Hash length: {len(password_hash)}")
print(f"   Hash: {password_hash[:30]}...")

# Step 4: Verify password
print(f"\n📊 Step 4: Verifying password...")
print(f"   Input password: '{password}'")
print(f"   Password length: {len(password)}")
print(f"   Password bytes: {password.encode('utf-8')}")

try:
    is_valid = password_handler.verify_password(password, password_hash)
    print(f"   Result: {is_valid}")
    
    if is_valid:
        print(f"\n✅ LOGIN WOULD SUCCEED!")
        print(f"   The backend SHOULD allow login with these credentials")
    else:
        print(f"\n❌ LOGIN WOULD FAIL!")
        print(f"   Password verification returned False")
        
except Exception as e:
    print(f"\n❌ VERIFICATION ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

# Step 5: Double-check with direct bcrypt
print(f"\n📊 Step 5: Double-check with direct bcrypt...")
import bcrypt
try:
    password_bytes = password.encode('utf-8')
    hash_bytes = password_hash.encode('utf-8')
    direct_result = bcrypt.checkpw(password_bytes, hash_bytes)
    print(f"   Direct bcrypt result: {direct_result}")
except Exception as e:
    print(f"   Direct bcrypt error: {str(e)}")
