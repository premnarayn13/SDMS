import axios from 'axios';
const ACCESS_TOKEN_KEY = 'docmatrix_access_token';

const resolveApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_URL || '').trim();
  const normalizedConfigured = configured.replace(/\/+$/, '');

  if (!import.meta.env.DEV) {
    return (normalizedConfigured || 'https://docmatrix-api.onrender.com') + '/api';
  }

  if (normalizedConfigured) {
    return normalizedConfigured + '/api';
  }

  return 'http://localhost:8000/api';
};

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

import { tokenUtils, authSessionUtils } from './authApi';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const accessToken = await authSessionUtils.refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        tokenUtils.clearAll();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Documents API
export const documentsApi = {
  // Get documents with filters
  getDocuments: (params) => api.get('/documents', { params }),
  
  // Get single document
  getDocument: (id) => api.get(`/documents/${id}`),
  
  // Create document
  createDocument: (data) => api.post('/documents', data),
  
  // Update document
  updateDocument: (id, data) => api.put(`/documents/${id}`, data),
  
  // Delete document
  deleteDocument: (id, permanent = false) => 
    api.delete(`/documents/${id}`, { params: { permanent } }),
  
  // Rename document
  renameDocument: (id, newName) => 
    api.post(`/documents/${id}/rename`, { newName }),
  
  // Move document
  moveDocument: (id, targetFolderId) => 
    api.post(`/documents/${id}/move`, { targetFolderId }),
  
  // Duplicate document
  duplicateDocument: (id) => api.post(`/documents/${id}/duplicate`),
  
  // Toggle favorite
  toggleFavorite: (id) => api.post(`/documents/${id}/favorite`),
  
  // Restore from trash
  restoreDocument: (id) => api.post(`/documents/${id}/restore`),
  
  // Update content
  updateContent: (id, content) => 
    api.put(`/documents/${id}/content`, content, {
      headers: { 'Content-Type': 'text/plain' }
    }),
  
  // Add history
  addHistory: (id, action) => 
    api.post(`/documents/${id}/history`, null, { params: { action } }),
};

// Folders API
export const foldersApi = {
  // Get all folders
  getFolders: () => api.get('/folders'),
  
  // Create folder
  createFolder: (name, parentId = null) => 
    api.post('/folders', { name, parentId }),
};

// Upload API
export const uploadApi = {
  uploadFile: (file, parentId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) formData.append('parentId', parentId);
    
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// Sharing API
export const sharingApi = {
  addShare: (id, email, permission = 'viewer') =>
    api.post(`/documents/${id}/share`, { email, permission }),

  removeShare: (id, email) =>
    api.delete(`/documents/${id}/share/${encodeURIComponent(email)}`),

  generateShareLink: (id) =>
    api.post(`/v1/documents/${id}/share-link`)
};
// Tags API
export const tagsApi = {
  addTag: (id, tag) => api.post(`/documents/${id}/tags`, { tag }),
  
  removeTag: (id, tag) => api.delete(`/documents/${id}/tags/${tag}`),
};

// Trash API
export const trashApi = {
  getTrashCount: () => api.get('/trash/count'),
  
  restoreAll: () => api.post('/trash/restore-all'),
  
  emptyTrash: () => api.delete('/trash/empty'),
};

// User & Storage API
export const userApi = {
  getUser: () => api.get('/user'),
  
  getStorage: () => api.get('/storage'),
};

// Breadcrumb API
export const breadcrumbApi = {
  getBreadcrumb: (id) => api.get(`/breadcrumb/${id}`),
};

export default api;


