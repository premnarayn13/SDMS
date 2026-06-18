// DOCKY TOKEN FIX - Paste this in browser console at http://localhost:3001

console.log('%c🔧 FIXING DOCKY TOKENS', 'color: #4F46E5; font-size: 20px; font-weight: bold;');
console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4F46E5;');

// Check old token
const oldToken = localStorage.getItem('access_token');
const newToken = localStorage.getItem('docmatrix_access_token');

console.log('\n📊 Token Status:');
console.log('Old key (access_token):', oldToken ? '✓ EXISTS (WRONG!)' : '✗ Not found');
console.log('Correct key (docmatrix_access_token):', newToken ? '✓ EXISTS' : '✗ Not found');

// Clean up old tokens
if (oldToken) {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  console.log('\n🗑️  Removed old tokens with wrong keys');
}

// Check if user needs to re-login
if (!newToken) {
  console.log('\n⚠️  No valid token found');
  console.log('👉 You need to LOGOUT and LOGIN again');
  console.log('\nSteps:');
  console.log('1. Refresh this page (Ctrl+Shift+R)');
  console.log('2. Logout (if you see the logout button)');
  console.log('3. Login with: naraynpremnl1304@gmail.com / test123');
} else {
  console.log('\n✅ Valid token exists!');
  console.log('👉 Now refresh the page: Ctrl+Shift+R');
  console.log('👉 Then click the purple Docky button and chat!');
}

console.log('\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4F46E5;');
console.log('%c✨ Token fix complete! Follow the steps above.', 'color: #10B981; font-weight: bold;');
