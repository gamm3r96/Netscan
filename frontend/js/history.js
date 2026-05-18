/**
 * History Module
 * Manages scan history display and local storage sync
 */

import { api } from './api.js';
import { renderHistory, showToast } from './ui.js';

class HistoryManager {
  constructor() {
    this._initEventListeners();
  }

  _initEventListeners() {
    // Clear history button
    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
      if (confirm('Clear all scan history? This cannot be undone.')) {
        localStorage.removeItem('netscan_history');
        this.render();
        showToast('✓ History cleared', 'success');
      }
    });
    
    // History item click (view details)
    document.getElementById('historyList')?.addEventListener('click', (e) => {
      const item = e.target.closest('.history-item');
      if (item?.dataset.scanId) {
        this.viewDetails(item.dataset.scanId);
      }
    });
  }

  async load() {
    try {
      // Try backend first if authenticated
      if (api.isAuthenticated()) {
        const response = await api.getHistory(20);
        this._renderScans(response.scans);
        return;
      }
      
      // Fallback to local storage
      this.loadLocal();
      
    } catch (error) {
      console.warn('Failed to load history from backend:', error);
      this.loadLocal();
    }
  }

  loadLocal() {
    try {
      const history = JSON.parse(localStorage.getItem('netscan_history') || '[]');
      this._renderScans(history);
    } catch (e) {
      console.error('Failed to parse local history:', e);
      renderHistory([]);
    }
  }

  _renderScans(scans) {
    renderHistory(scans);
    
    // Show/hide clear button
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !scans || scans.length === 0);
    }
  }

  async viewDetails(scanId) {
    showToast('Loading scan details...', 'info');
    
    try {
      // Try backend first
      if (api.isAuthenticated()) {
        const result = await api.getScanDetail(scanId);
        // Switch to scanner tab and display results
        this._displayResults(result);
        return;
      }
      
      // Fallback: find in local history
      const history = JSON.parse(localStorage.getItem('netscan_history') || '[]');
      const local = history.find(h => h.id === scanId);
      
      if (local) {
        showToast('Showing')