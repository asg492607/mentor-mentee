import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { escapeHtml } from '/js/utils.js';

let events = [];

function formatTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—';
}

function renderRows(container, filter = '') {
  const needle = filter.trim().toLowerCase();
  const visible = events.filter(event => [
    event.eventType,
    event.actorName,
    event.actorId,
    event.actorRole,
    event.route,
    event.portalPage,
    event.peerIp,
    ...(event.reportedForwardedIps || []),
    event.userAgent,
    event.statusCode,
  ].join(' ').toLowerCase().includes(needle));

  const body = container.querySelector('#security-events-body');
  if (!body) return;
  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted);">No matching security events.</td></tr>';
    return;
  }

  body.innerHTML = visible.map(event => {
    const actor = event.actorName || (event.actorId ? `User ${event.actorId}` : 'Unauthenticated');
    const status = Number(event.statusCode) || 0;
    const statusColor = status >= 500 || status === 403 || status === 401 ? 'var(--danger)' : 'var(--success)';
    const eventBadge = event.eventType === 'suspicious_access' ? 'badge-danger' : 'badge-muted';
    const reportedIps = Array.isArray(event.reportedForwardedIps) && event.reportedForwardedIps.length
      ? event.reportedForwardedIps.join(', ')
      : '—';
    return `<tr>
      <td style="white-space:nowrap;">${escapeHtml(formatTime(event.createdAt))}</td>
      <td><strong>${escapeHtml(actor)}</strong><br><small>${escapeHtml(event.actorRole || '—')} · ${escapeHtml(event.actorId || '—')}</small></td>
      <td><span class="badge ${eventBadge}">${escapeHtml(event.eventType || 'api_access')}</span><br><small>${escapeHtml(event.portalPage || event.route || '—')}</small></td>
      <td><strong>${escapeHtml(event.method || '—')}</strong><br><small>${escapeHtml(event.route || '—')}</small></td>
      <td style="color:${statusColor};font-weight:700;">${escapeHtml(status || '—')}</td>
      <td><strong>${escapeHtml(event.peerIp || '—')}</strong><br><small>Forwarded (unverified): ${escapeHtml(reportedIps)}</small></td>
      <td><span class="badge badge-warning">${escapeHtml(event.vpnStatus || 'unknown')}</span><br><small>VPN/proxy detection not configured</small></td>
      <td style="max-width:260px;word-break:break-word;"><small>${escapeHtml(event.userAgent || '—')}</small></td>
    </tr>`;
  }).join('');
}

export async function render(container) {
  const user = getUserProfile();
  if (user?.role !== 'ADMIN') {
    container.innerHTML = '<div class="empty-state"><h2>Administrator access required</h2></div>';
    return;
  }

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/security-logs')}
      <div class="main-content">
        ${createHeader('Security Logs', user)}
        <div class="page-content">
          <div class="card" style="padding:22px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
              <div>
                <h2 style="margin:0;font-size:1.1rem;">Portal access activity</h2>
                <p style="margin:5px 0 0;color:var(--text-muted);font-size:.82rem;">Recent page views, API access, failed access attempts, source metadata, and device user agents.</p>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <input id="security-log-search" class="form-input" type="search" placeholder="Filter user, IP, route…" style="max-width:260px;">
                <button id="security-log-refresh" class="btn btn-secondary">Refresh</button>
              </div>
            </div>
            <div class="alert alert-info" style="margin-bottom:14px;">
              VPN/proxy status is recorded as unknown. The app does not use an IP intelligence provider. Forwarded IP headers are marked unverified; browser DevTools inspection cannot be reliably detected.
            </div>
            <div style="overflow:auto;">
              <table class="data-table" style="min-width:1100px;">
                <thead><tr><th>Time</th><th>Account</th><th>Event / page</th><th>Request</th><th>Status</th><th>IP metadata</th><th>VPN/proxy</th><th>Browser/device</th></tr></thead>
                <tbody id="security-events-body"><tr><td colspan="8" style="text-align:center;padding:28px;">Loading security events…</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const refresh = async () => {
    const body = container.querySelector('#security-events-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;">Loading security events…</td></tr>';
    try {
      events = await api.get('/admin/security-events?limit=200');
      renderRows(container, container.querySelector('#security-log-search')?.value || '');
    } catch (error) {
      body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--danger);">${escapeHtml(error.message || 'Unable to load security logs.')}</td></tr>`;
      showToast('Security logs could not be loaded.', 'error');
    }
  };

  container.querySelector('#security-log-refresh')?.addEventListener('click', refresh);
  container.querySelector('#security-log-search')?.addEventListener('input', event => renderRows(container, event.target.value));
  await refresh();
}
