/**
 * Document API Client (v1 - Cloud/Drive)
 * API calls for document management with Google Drive backend
 */
import axios from 'axios';
import { tokenUtils, authSessionUtils } from './authApi';

const resolveApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_URL || '').trim();
  const normalizedConfigured = configured.replace(/\/+$/, '');

  // In production, use configured URL (or empty for same-origin)
  if (!import.meta.env.DEV) {
    return normalizedConfigured;
  }

  // In dev, if explicitly configured, use it
  if (normalizedConfigured) {
    return normalizedConfigured;
  }

  // In dev without explicit config, default to localhost:8000 for backend
  // (frontend is typically on 3000/3001, backend on 8000)
  if (typeof window !== 'undefined') {
    const localHosts = new Set(['localhost', '127.0.0.1']);
    if (localHosts.has(window.location.hostname)) {
      return 'http://localhost:8000';
    }
  }

  return normalizedConfigured;
};

const API_BASE_URL = resolveApiBaseUrl();
const API_V1 = `${API_BASE_URL}/api/v1`;

// Create axios instance with auth
const createAuthApi = (baseUrl) => {
  const instance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  instance.interceptors.request.use((config) => {
    const token = tokenUtils.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle token refresh on 401
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const accessToken = await authSessionUtils.refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          const status = refreshError?.response?.status;
          if (status === 400 || status === 401 || status === 403) {
            tokenUtils.clearAll();
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
};

const documentsApi = createAuthApi(`${API_V1}/documents`);
const foldersApi = createAuthApi(`${API_V1}/folders`);

/**
 * Document Operations API
 */
export const documentOpsApi = {
  // Upload file to Google Drive
  uploadFile: async (file, folderId = null, description = null, tags = [], driveId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);
    if (driveId) formData.append('drive_id', driveId);
    if (description) formData.append('description', description);
    if (tags.length) formData.append('tags', tags.join(','));

    const response = await documentsApi.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Get documents list
  getDocuments: async (params = {}) => {
    const response = await documentsApi.get('', { params });
    return response.data;
  },
  
  // Get single document
  getDocument: async (id) => {
    const response = await documentsApi.get(`/${id}`);
    return response.data;
  },
  
  // Download document
  downloadDocument: async (id) => {
    const token = tokenUtils.getAccessToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await axios.get(`${API_V1}/documents/${id}/download`, {
        headers,
        withCredentials: true,
        responseType: 'blob',
        timeout: 180000,
      });
      return response.data;
    } catch (primaryError) {
      // Fallback for legacy/local documents when v1 auth/cloud fetch fails.
      try {
        const legacyResponse = await axios.get(`/api/documents/${id}`, {
          withCredentials: true,
          timeout: 180000,
        });
        const legacyDoc = legacyResponse?.data || {};

        if (legacyDoc?.dataUrl) {
          const blob = await fetch(legacyDoc.dataUrl).then((res) => res.blob());
          return blob;
        }

        if (typeof legacyDoc?.content === 'string') {
          const type = legacyDoc?.mimeType || 'text/plain;charset=utf-8';
          return new Blob([legacyDoc.content], { type });
        }
      } catch {
        // Fall through to original error.
      }

      throw primaryError;
    }
  },
  
  // Get view URL
  getViewUrl: async (id) => {
    const response = await documentsApi.get(`/${id}/view-url`);
    return response.data.url;
  },
  
  // Update document
  updateDocument: async (id, data) => {
    const response = await documentsApi.patch(`/${id}`, data);
    return response.data;
  },
  
  // Toggle favorite
  toggleFavorite: async (id) => {
    const response = await documentsApi.post(`/${id}/favorite`);
    return response.data;
  },
  
  // Move to folder
  moveDocument: async (id, folderId) => {
    const response = await documentsApi.post(`/${id}/move`, { target_folder_id: folderId });
    return response.data;
  },

  // Duplicate document
  duplicateDocument: async (id) => {
    const response = await documentsApi.post(`/${id}/duplicate`);
    return response.data;
  },
  
  // Delete document (soft)
  deleteDocument: async (id, permanent = false, otp = null) => {
    const response = await documentsApi.delete(`/${id}`, {
      params: { permanent },
      data: otp ? { otp } : undefined,
    });
    return response.data;
  },
  
  // Restore from trash
  restoreDocument: async (id) => {
    const response = await documentsApi.post(`/${id}/restore`);
    return response.data;
  },
  
  // Share document
  shareDocument: async (id, email, permission = 'viewer') => {
    const response = await documentsApi.post(`/${id}/share`, { email, permission });
    return response.data;
  },
  
  // Remove share
  removeShare: async (id, email) => {
    const response = await documentsApi.delete(`/${id}/share/${encodeURIComponent(email)}`);
    return response.data;
  },
  
  // Add tag
  addTag: async (id, tag) => {
    const response = await documentsApi.post(`/${id}/tags/${encodeURIComponent(tag)}`);
    return response.data;
  },
  
  // Remove tag
  removeTag: async (id, tag) => {
    const response = await documentsApi.delete(`/${id}/tags/${encodeURIComponent(tag)}`);
    return response.data;
  },
  
  // Get versions
  getVersions: async (id) => {
    const response = await documentsApi.get(`/${id}/versions`);
    return response.data;
  },
  
  // Upload new version
  uploadVersion: async (id, file, description = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('change_description', description);

    const response = await documentsApi.post(`/${id}/versions`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

/**
 * Virtual Folder Operations API
 */
export const folderOpsApi = {
  // Get folders list
  getFolders: async (params = {}) => {
    const response = await foldersApi.get('', { params });
    return response.data;
  },
  
  // Create folder
  createFolder: async (
    name,
    parentId = null,
    driveId = null
) => {
    const response = await foldersApi.post('', {
        name,
        parent_id: parentId,
        drive_id: driveId
    });

    return response.data;
},
  
  // Get folder
  getFolder: async (id) => {
    const response = await foldersApi.get(`/${id}`);
    return response.data;
  },
  
  // Update folder
  updateFolder: async (id, data) => {
    const response = await foldersApi.patch(`/${id}`, data);
    return response.data;
  },

  // Move folder to new parent
  moveFolder: async (id, targetParentId = null) => {
    const response = await foldersApi.post(`/${id}/move`, { target_parent_id: targetParentId });
    return response.data;
  },
  
  // Delete folder
  deleteFolder: async (id, recursive = false) => {
    const response = await foldersApi.delete(`/${id}`, { params: { recursive } });
    return response.data;
  },
  // Get breadcrumbs
  getBreadcrumbs: async (id) => {
    const response = await foldersApi.get(`/${id}/breadcrumbs`);
    return response.data;
  },
  // Get full folder tree
  getFolderTree: async () => {
    const response = await foldersApi.get('/tree');
    return response.data;
  },
};

export default documentOpsApi;
