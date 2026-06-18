const DRIVE_SETUP_PREFIX = 'drive_setup_completed:';

export const DRIVE_SETUP_IN_PROGRESS_KEY = 'drive_setup_in_progress';

const getUserEmail = (user) => (user?.email || '').trim().toLowerCase();

export const getDriveSetupStorageKey = (user) => {
  const email = getUserEmail(user);
  return email ? `${DRIVE_SETUP_PREFIX}${email}` : null;
};

export const isDriveSetupCompleted = (user) => {
  const key = getDriveSetupStorageKey(user);
  if (!key) return false;
  return localStorage.getItem(key) === 'true';
};

export const markDriveSetupCompleted = (user) => {
  const key = getDriveSetupStorageKey(user);
  if (!key) return;
  localStorage.setItem(key, 'true');
};