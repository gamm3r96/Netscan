/**
 * Scanner Module
 * Manages the scan workflow: input validation, API calls, progress, results
 */

import { api, APIError } from './api.js';
import { auth } from './auth.js';
import {
  showToast,
  updateProgress,
  setButtonLoading,
  showError,
  clearError,
  renderStats,
  renderHostDetails,
  renderPorts,
  debounce
} from './ui.js';

const SCAN_STEPS = [
  "Resolving hostname...",
  "Sending ICMP ping...",
  "Detecting OS fingerprint...",
  "Scanning common ports...",
  "Checking promiscuous mode...",
  "Testing DNS configuration...",
  "Analyzing results..."
];

class Scanner {
  constructor() {
    this.isScanning = false;
    this._initEventListeners();
    this._initInputValidation();
  }

  _initEventListeners() {
    const scanBtn = document.getElementById('scanBtn');
    const targetInput = document.getElementById('targetInput');
    
    // Scan button click
    scanBtn?.addEventListener('click', () => this.startScan());
    
    // Enter key in input
    targetInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.isScanning) {
        e.preventDefault();
        this.startScan();
      }
    });    
    // Auth state changes
    auth.subscribe('auth:login', () => {
      showToast('✓ Ready to scan', 'success');
    });
    
    auth.subscribe('auth:logout', () => {
      if (this.isScanning) {
        this._abortScan();
      }
    });
  }

  _initInputValidation() {
    const targetInput = document.getElementById('targetInput');
    if (!targetInput) return;
    
    // Real-time validation feedback
    const validate = debounce((value) => {
      if (!value) {
        targetInput.setCustomValidity('Please enter a target');
        return;
      }
      
      // Basic pattern check (IP or hostname)
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      const hostPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
      
      if (ipPattern.test(value) || hostPattern.test(value)) {
        targetInput.setCustomValidity('');
        targetInput.classList.remove('invalid');
      } else {
        targetInput.setCustomValidity('Enter valid IP or hostname');
        targetInput.classList.add('invalid');
      }
    }, 300);
    
    targetInput.addEventListener('input', (e) => validate(e.target.value));
  }

  async startScan() {
    const targetInput = document.getElementById('targetInput');
    const target = targetInput?.value.trim();
    
    // Validation
    if (!target) {
      showToast('Please enter a target to scan', 'warning');
      targetInput?.focus();
      return;
    }    
    if (!auth.isAuthenticated()) {
      showToast('Authentication required', 'warning');
      auth.showAuthModal();
      return;
    }
    
    // Prevent concurrent scans
    if (this.isScanning) {
      showToast('Scan already in progress', 'info');
      return;
    }
    
    this.isScanning = true;
    clearError();
    
    // UI updates
    const scanBtn = document.getElementById('scanBtn');
    const progressSection = document.getElementById('progressSection');
    const resultsSection = document.getElementById('resultsSection');
    
    setButtonLoading(scanBtn, true);
    progressSection?.classList.remove('hidden');
    resultsSection?.classList.add('hidden');
    
    // Reset progress
    updateProgress(0, SCAN_STEPS[0]);
    
    try {
      // Simulate progress steps (backend handles actual timing)
      const progressInterval = setInterval(() => {
        const currentStep = Math.floor((Date.now() % (SCAN_STEPS.length * 800)) / 800);
        const progress = Math.min(95, (currentStep + 1) * (100 / SCAN_STEPS.length));
        updateProgress(progress, SCAN_STEPS[currentStep]);
      }, 800);
      
      // Call backend API
      const result = await api.scan(target);
      
      clearInterval(progressInterval);
      updateProgress(100, 'Complete');
      
      // Render results
      renderStats(result);
      renderHostDetails(result);
      renderPorts(result.openPorts);
      
      // Show results
      resultsSection?.classList.remove('hidden');
            // Save to local history (mirror backend)
      this._addToHistory(result);
      
      showToast(`✓ Scan complete: ${result.openPorts?.length || 0} ports found`, 'success');
      
    } catch (error) {
      console.error('Scan failed:', error);
      
      if (error instanceof APIError) {
        if (error.status === 401) {
          auth.showAuthModal();
          showError('Please authenticate to continue scanning');
        } else if (error.status === 403) {
          showError(`Access denied: ${error.message}`);
        } else if (error.status === 429) {
          showError(error.message);
        } else {
          showError(error.message || 'Scan failed');
        }
      } else {
        showError('Network error. Please check your connection.');
      }
      
    } finally {
      // Cleanup
      this.isScanning = false;
      setButtonLoading(scanBtn, false);
      
      // Hide progress after delay
      setTimeout(() => {
        progressSection?.classList.add('hidden');
      }, 1000);
    }
  }

  _abortScan() {
    // In production: use AbortController to cancel fetch
    this.isScanning = false;
    setButtonLoading(document.getElementById('scanBtn'), false);
    showToast('⚠️ Scan cancelled', 'warning');
  }

  _addToHistory(result) {
    // Mirror backend history in localStorage for offline access
    try {
      const history = JSON.parse(localStorage.getItem('netscan_history') || '[]');
      const entry = {
        id: result.requestId || Date.now().toString(),
        target: result.target,
        ip: result.ip,        timestamp: result.timestamp,
        openPortsCount: result.openPorts?.length || 0,
        scanTime: result.scanTime,
        criticalCount: result.critical_count || 0,
        highCount: result.high_count || 0
      };
      
      history.unshift(entry);
      
      // Limit history size
      if (history.length > 100) {
        history.pop();
      }
      
      localStorage.setItem('netscan_history', JSON.stringify(history));
      
      // Trigger history reload if on that tab
      if (document.getElementById('tab-history')?.classList.contains('hidden') === false) {
        window.loadHistory?.();
      }
    } catch (e) {
      console.warn('Failed to save history locally:', e);
    }
  }
}

export const scanner = new Scanner();