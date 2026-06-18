/**
 * Docky Agent API Client
 * Provides methods to interact with the Docky AI agent backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = `${API_BASE_URL}/api/v1/agent`;
const AGENT_REQUEST_TIMEOUT_MS = 90000;

// Use same token keys as authApi for consistency
const ACCESS_TOKEN_KEY = 'docmatrix_access_token';
const REFRESH_TOKEN_KEY = 'docmatrix_refresh_token';

/**
 * Get fresh access token, refresh if needed
 */
async function getValidToken() {
  let token = localStorage.getItem(ACCESS_TOKEN_KEY);
  
  // If no token, user needs to login
  if (!token) {
    throw new Error('Please login to use Docky');
  }
  
  return token;
}

/**
 * Handle API errors and token refresh
 */
async function handleApiError(response, originalFetch) {
  if (response.status === 401) {
    // Token expired, try to refresh
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
          if (data.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
          }
          // Retry original request with new token
          return originalFetch();
        }
      } catch (err) {
        console.error('Token refresh failed:', err);
      }
    }
    throw new Error('Please login again - your session expired');
  }
  
  const error = await response.json().catch(() => ({ detail: 'Request failed' }));
  throw new Error(error.detail || `Request failed with status ${response.status}`);
}

/**
 * Send a chat message to Docky
 */
export async function sendChatMessage(message, isVoice = false) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message,
        is_voice: isVoice
      })
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Execute autonomous agent action (NEW - LLM-powered)
 * This is the upgraded version that uses the orchestrator
 */
export async function executeAutonomous(message, includeContext = true, options = {}) {
  const makeRequest = async () => {
    const token = await getValidToken();
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), AGENT_REQUEST_TIMEOUT_MS);

    const externalSignal = options.signal;
    const abortController = new AbortController();
    const relayAbort = () => abortController.abort();

    timeoutController.signal.addEventListener('abort', relayAbort, { once: true });
    if (externalSignal) {
      if (externalSignal.aborted) {
        abortController.abort();
      } else {
        externalSignal.addEventListener('abort', relayAbort, { once: true });
      }
    }
    
    let response;
    try {
      response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          include_context: includeContext,
          safe_mode: Boolean(options.safeMode),
          confirmed: Boolean(options.confirmed)
        }),
        signal: abortController.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new Error('Request interrupted. Listening for your next instruction.');
        }
        throw new Error('Docky took too long to respond. Please try a shorter command.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      timeoutController.signal.removeEventListener('abort', relayAbort);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', relayAbort);
      }
    }
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

export function getAgentRealtimeWebSocketUrl() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    throw new Error('Please login to use Docky');
  }

  const wsBase = API_BASE_URL
    .replace(/^http:\/\//i, 'ws://')
    .replace(/^https:\/\//i, 'wss://');

  return `${wsBase}/api/v1/agent/realtime/ws?token=${encodeURIComponent(token)}`;
}

/**
 * Process voice command
 */
export async function processVoiceCommand(transcript) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        transcript
      })
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Get chat history
 */
export async function getChatHistory(limit = 50) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/chat/history?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Clear chat history
 */
export async function clearChatHistory() {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/chat/history`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Search files using Docky
 */
export async function searchFiles(query, searchType = 'all', limit = 20) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query,
        search_type: searchType,
        limit
      })
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Get analytics
 */
export async function getAnalytics(period = '7d') {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/analytics?period=${period}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Get file intelligence (entities, keywords, etc.)
 */
export async function getFileIntelligence(fileId) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/file/${fileId}/intelligence`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Get similar files
 */
export async function getSimilarFiles(fileId, limit = 10) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/similar/${fileId}?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Get available commands
 */
export async function getAvailableCommands() {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/commands`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Batch move files
 */
export async function batchMoveFiles(fileIds, targetFolderId) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/batch/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        file_ids: fileIds,
        target_folder_id: targetFolderId
      })
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Batch tag files
 */
export async function batchTagFiles(fileIds, tags) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/batch/tag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        file_ids: fileIds,
        tags
      })
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

/**
 * Batch delete files
 */
export async function batchDeleteFiles(fileIds) {
  const makeRequest = async () => {
    const token = await getValidToken();
    
    const response = await fetch(`${API_BASE}/batch/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        file_ids: fileIds
      })
    });
    
    if (!response.ok) {
      return handleApiError(response, makeRequest);
    }
    
    return response.json();
  };
  
  return makeRequest();
}

