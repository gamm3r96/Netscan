/**
 * NetScan Pro API Client
 * Handles all backend communication with auth, error handling & retries
 */

const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 120000,
  retries: parseInt(import.meta.env.VITE_API_RETRIES) || 2
};

class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

class APIClient {
  constructor() {
    this.token = null;
    this._loadToken();
  }

  _loadToken() {
    try {
      this.token = localStorage.getItem('netscan_token');
    } catch (e) {
      console.warn('Failed to load auth token:', e);
    }
  }

  _saveToken(token) {
    try {
      localStorage.setItem('netscan_token', token);
      this.token = token;
    } catch (e) {
      console.warn('Failed to save auth token:', e);
    }
  }

  _clearToken() {
    localStorage.removeItem('netscan_token');
    this.token = null;
  }

  setToken(token) {
    this._saveToken(token);  }

  clearToken() {
    this._clearToken();
  }

  isAuthenticated() {
    return !!this.token;
  }

  async _request(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers,
      signal: AbortSignal.timeout(API_CONFIG.timeout)
    };

    let lastError;
    
    for (let attempt = 0; attempt <= API_CONFIG.retries; attempt++) {
      try {
        const response = await fetch(url, config);
        
        // Handle auth errors
        if (response.status === 401) {
          this._clearToken();
          throw new APIError('Authentication required', 401);
        }
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || 60;
          throw new APIError(`Rate limited. Try again in ${retryAfter}s`, 429);
        }
        
        // Parse response
        const data = await response.json();
        
        if (!response.ok) {          throw new APIError(data.error || 'Request failed', response.status, data);
        }
        
        return data;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on auth errors or client errors
        if (error instanceof APIError && [400, 401, 403, 404].includes(error.status)) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < API_CONFIG.retries) {
          await new Promise(resolve => 
            setTimeout(resolve, 1000 * Math.pow(2, attempt))
          );
          continue;
        }
      }
    }
    
    throw lastError || new APIError('Network request failed');
  }

  // ── API Methods ─────────────────────────────────────

  async health() {
    return this._request('/api/health', { method: 'GET' });
  }

  async scan(target) {
    return this._request('/api/scan', {
      method: 'POST',
      body: JSON.stringify({ target })
    });
  }

  async getHistory(limit = 10) {
    return this._request(`/api/history?limit=${limit}`, { method: 'GET' });
  }

  async getScanDetail(scanId) {
    return this._request(`/api/history/${scanId}`, { method: 'GET' });
  }

  async getConfig() {
    return this._request('/api/config', { method: 'GET' });
  }}

export const api = new APIClient();
export { APIError };