/**
 * UI Utilities Module
 * DOM manipulation, rendering helpers, and toast notifications
 */

// ── Toast Notifications ─────────────────────────────────────

const TOAST_TYPES = {
  info: { icon: 'ℹ️', class: 'toast-info' },
  success: { icon: '✓', class: 'toast-success' },
  warning: { icon: '⚠️', class: 'toast-warning' },
  error: { icon: '✗', class: 'toast-error' }
};

export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const config = TOAST_TYPES[type] || TOAST_TYPES.info;
  const toast = document.createElement('div');
  toast.className = `toast ${config.class}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${config.icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  // Close handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  // Auto-dismiss
  const timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);

  // Cancel auto-dismiss on hover
  toast.addEventListener('mouseenter', () => clearTimeout(timer));

  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });}

// ── HTML Escaping (XSS Prevention) ─────────────────────────

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Tab Navigation ─────────────────────────────────────

export function setupTabs(tabSelector = '.tab', panelSelector = '[role="tabpanel"]') {
  const tabs = document.querySelectorAll(tabSelector);
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update tab states
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      // Show/hide panels
      document.querySelectorAll(panelSelector).forEach(panel => {
        const isTarget = panel.id === `tab-${targetTab}`;
        panel.classList.toggle('hidden', !isTarget);
        panel.setAttribute('aria-hidden', !isTarget);
      });
      
      // Trigger load event for tab content if needed
      if (targetTab === 'history' && typeof window.loadHistory === 'function') {
        window.loadHistory();
      }
    });
  });
}

// ── Progress Bar Updates ─────────────────────────────────

export function updateProgress(percent, stepText = '') {
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  const step = document.getElementById('stepText');
  const bar = document.querySelector('.progress-bar');
    if (fill) {
    fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
  if (text) {
    text.textContent = `${Math.min(100, Math.max(0, percent))}%`;
  }
  if (step && stepText) {
    step.textContent = stepText;
  }
  if (bar) {
    bar.setAttribute('aria-valuenow', percent);
  }
}

// ── Button Loading State ─────────────────────────────────

export function setButtonLoading(button, loading = true) {
  if (!button) return;
  
  const text = button.querySelector('.btn-text');
  const loader = button.querySelector('.btn-loader');
  
  if (loading) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    text?.classList.add('hidden');
    loader?.classList.remove('hidden');
  } else {
    button.disabled = false;
    button.setAttribute('aria-busy', 'false');
    text?.classList.remove('hidden');
    loader?.classList.add('hidden');
  }
}

// ── Error Display ─────────────────────────────────

export function showError(message, sectionId = 'errorSection') {
  const section = document.getElementById(sectionId);
  if (!section) return;
  
  section.innerHTML = `
    <strong>⚠️ Error</strong>
    <p>${escapeHtml(message)}</p>
    <button class="btn btn-small btn-secondary" onclick="this.closest('.error').classList.add('hidden')">
      Dismiss
    </button>
  `;
  section.classList.remove('hidden');
    // Auto-hide after 10 seconds
  setTimeout(() => {
    section.classList.add('hidden');
  }, 10000);
}

export function clearError(sectionId = 'errorSection') {
  const section = document.getElementById(sectionId);
  section?.classList.add('hidden');
}

// ── Results Rendering Helpers ─────────────────────────

export function renderStats(stats) {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div class="stat-card" style="border-color: var(--color-primary)33">
      <div class="stat-value" style="color: var(--color-primary)">${stats.openPorts || 0}</div>
      <div class="stat-label">Open Ports</div>
    </div>
    <div class="stat-card" style="border-color: var(--color-success)33">
      <div class="stat-value" style="color: var(--color-success)">${stats.scanTime || '0'}s</div>
      <div class="stat-label">Scan Time</div>
    </div>
    <div class="stat-card" style="border-color: var(--risk-critical)33">
      <div class="stat-value" style="color: var(--risk-critical)">${stats.criticalCount || 0}</div>
      <div class="stat-label">Critical</div>
    </div>
    <div class="stat-card" style="border-color: var(--risk-high)33">
      <div class="stat-value" style="color: var(--risk-high)">${stats.highCount || 0}</div>
      <div class="stat-label">High Risk</div>
    </div>
  `;
}

export function renderHostDetails(host) {
  const card = document.getElementById('hostCard');
  if (!card) return;
  
  const details = [
    ['Target', host.target],
    ['IP Address', host.ip],
    ['OS Detected', host.os],
    ['TTL', host.ttl],
    ['Promisc Mode', host.promisc ? '⚠️ DETECTED' : '✅ Clean'],
    ['DNS Leaks', host.dnsLeak ? '⚠️ DETECTED' : '✅ Clean']
  ];
    card.innerHTML = `
    <div class="section-title">Host Details</div>
    ${details.map(([key, value]) => `
      <div class="row">
        <span class="row-key">${escapeHtml(key)}</span>
        <span class="row-val" style="color: ${String(value).includes('DETECTED') ? 'var(--risk-high)' : 'var(--color-text)'}">
          ${escapeHtml(value)}
        </span>
      </div>
    `).join('')}
  `;
}

export function renderPorts(ports) {
  const card = document.getElementById('portsCard');
  if (!card) return;
  
  if (!ports || ports.length === 0) {
    card.classList.add('hidden');
    return;
  }
  
  card.classList.remove('hidden');
  card.innerHTML = `
    <div class="section-title">Open Ports (${ports.length})</div>
    ${ports.map(port => `
      <div class="port-row">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="dot" style="background: var(--risk-${port.risk})"></div>
          <div>
            <div class="port-name">${escapeHtml(port.service)}</div>
            <div class="port-num">Port ${port.port}${port.version ? ` • ${escapeHtml(port.version)}` : ''}</div>
          </div>
        </div>
        <span class="badge" style="background: var(--risk-${port.risk})22; color: var(--risk-${port.risk})">
          ${escapeHtml(port.risk)}
        </span>
      </div>
    `).join('')}
  `;
}

// ── History Rendering ─────────────────────────────────

export function renderHistory(scans) {
  const list = document.getElementById('historyList');
  if (!list) return;
  
  if (!scans || scans.length === 0) {
    list.innerHTML = `      <div class="empty">
        <div class="empty-icon" aria-hidden="true">📋</div>
        <p>No scans yet. Run your first scan!</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = scans.map(scan => `
    <article class="card history-item" data-scan-id="${escapeHtml(scan.id)}">
      <header style="display:flex;justify-content:space-between;margin-bottom:4px">
        <strong style="font-size:15px">${escapeHtml(scan.target)}</strong>
        <time style="font-size:11px;color:var(--color-text-muted)">${escapeHtml(scan.timestamp)}</time>
      </header>
      <p style="font-size:12px;color:var(--color-text-secondary)">
        ${escapeHtml(scan.ip || 'N/A')} • ${scan.openPortsCount || 0} open ports • ${scan.scanTime || '0'}s
      </p>
      ${scan.criticalCount > 0 ? `<span class="badge" style="background:var(--risk-critical)22;color:var(--risk-critical)">⚠️ ${scan.criticalCount} critical</span>` : ''}
    </article>
  `).join('');
}

// ── Utility: Debounce ─────────────────────────────────

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}