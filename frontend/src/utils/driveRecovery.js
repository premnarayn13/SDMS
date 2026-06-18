import { driveSettingsApi } from './settingsApi';

const AUTH_ERROR_PATTERNS = [
  'invalid_grant',
  'invalid credentials',
  'credentials',
  'token',
  'reauthorize',
  'google drive',
  'unauthorized',
  'access denied',
  'auth'
];

export const extractErrorText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;

  const responseData = value?.response?.data;

  if (typeof responseData === 'string') return responseData;
  if (responseData?.detail) {
    return typeof responseData.detail === 'string'
      ? responseData.detail
      : JSON.stringify(responseData.detail);
  }

  return value?.message || '';
};

export const isDriveAuthError = (error, extraText = '') => {
  const status = error?.response?.status ?? error?.status;
  if (status === 401 || status === 403) return true;

  const text = `${extractErrorText(error)} ${extraText}`.toLowerCase();
  if (!text) return false;

  if (status === 404 && (text.includes('download') || text.includes('drive'))) {
    return true;
  }

  return AUTH_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
};

export const getDriveReauthorizeUrl = async (driveIdHint = null) => {
  try {
    if (driveIdHint) {
      const direct = await driveSettingsApi.reauthorizeDrive(driveIdHint);
      if (direct?.auth_url) return direct.auth_url;
    }
  } catch {
    // Continue to fallback discovery below
  }

  try {
    const status = await driveSettingsApi.getStatus();
    if (status?.id) {
      const byStatus = await driveSettingsApi.reauthorizeDrive(status.id);
      if (byStatus?.auth_url) return byStatus.auth_url;
    }
  } catch {
    // Continue
  }

  try {
    const all = await driveSettingsApi.getAllDrives();
    const drives = all?.drives || [];
    if (!drives.length) return null;

    const preferred = drives.find((drive) => drive?.is_primary) || drives[0];
    if (!preferred?.id) return null;

    const byList = await driveSettingsApi.reauthorizeDrive(preferred.id);
    return byList?.auth_url || null;
  } catch {
    return null;
  }
};
