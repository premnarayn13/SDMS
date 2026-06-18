export const ADMIN_SESSION_KEY = 'docmatrix_admin_prime_session';

export const ADMIN_CREDENTIALS = {
  adminId: 'DOCMATRIX-OMEGA',
  password: 'DMX@UltraControl2026!',
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export function validateAdminLogin(adminId, password) {
  const normalizedAdminId = String(adminId || '').trim().toUpperCase();
  return (
    normalizedAdminId === ADMIN_CREDENTIALS.adminId &&
    String(password || '') === ADMIN_CREDENTIALS.password
  );
}

export function createAdminSession() {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(payload));
  return payload;
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function getAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.exp || Date.now() > Number(parsed.exp)) {
      clearAdminSession();
      return null;
    }
    return parsed;
  } catch {
    clearAdminSession();
    return null;
  }
}

export function isAdminAuthenticated() {
  return !!getAdminSession();
}
