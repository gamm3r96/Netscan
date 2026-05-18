/**
 * Authentication Module
 * Manages token storage, validation, and UI state
 */

import { api } from './api.js';
import { showToast } from './ui.js';

const AUTH_EVENTS = {
  LOGIN: 'auth:login',
  LOGOUT: 'auth:logout',
  ERROR: 'auth:error'
};

class AuthManager {
  constructor() {
    this.subscribers = new Map();
    this._bindEvents();
  }

  _bindEvents() {
    // Listen for storage changes (sync across tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === 'netscan_token') {
        this._emit(AUTH_EVENTS.LOGIN, { token: e.newValue });
      }
    });
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push(callback);
    
    // Return unsubscribe function
    return () => {
      const list = this.subscribers.get(event);
      const idx = list.indexOf(callback);
      if (idx > -1) list.splice(idx, 1);
    };
  }

  _emit(event, data) {
    const callbacks = this.subscribers.get(event) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`Auth event handler error for ${event}:`, e);      }
    });
  }

  async login(token) {
    try {
      // Validate token by making a test request
      await api.getConfig();
      api.setToken(token);
      this._emit(AUTH_EVENTS.LOGIN, { token });
      showToast('✓ Authentication successful', 'success');
      return true;
    } catch (error) {
      api.clearToken();
      this._emit(AUTH_EVENTS.ERROR, { error });
      showToast(`✗ Authentication failed: ${error.message}`, 'error');
      return false;
    }
  }

  logout() {
    api.clearToken();
    this._emit(AUTH_EVENTS.LOGOUT);
    showToast('✓ Signed out', 'info');
  }

  isAuthenticated() {
    return api.isAuthenticated();
  }

  getToken() {
    return api.token;
  }

  showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal?.showModal) {
      modal.showModal();
    } else {
      // Fallback for browsers without <dialog> support
      modal?.classList.remove('hidden');
    }
  }

  hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal?.close) {
      modal.close();
    } else {
      modal?.classList.add('hidden');    }
  }
}

export const auth = new AuthManager();
export { AUTH_EVENTS };