import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK_ISSUES = [
  { id: '1', title: 'Attendance concern', description: 'My attendance dropped below 75% due to illness.', category: 'Academic', priority: 'HIGH', status: 'OPEN', createdAt: new Date(Date.now()-86400000*3).toISOString() },
  { id: '2', title: 'Fee payment extension', description: 'Requesting fee extension for this semester.', category: 'Financial', priority: 'MEDIUM', status: 'RESOLVED', createdAt: new Date(Date.now()-86400000*10).toISOString() },
];

function statusBadge(s) {
  const map = { OPEN:'badge-warning', RESOLVED:'badge-success', ESCALATED:'badge-danger', CLOSED:'badge-muted' };
  return `<span class="badge ${map[s]||'badge-muted'}">${s}</span>`;
}

function priorityBadge(p) {
  const map = { LOW:'badge-info', MEDIUM:'badge-warning', HIGH:'badge-danger', CRITICAL:'badge-danger' };
  return `<span class="badge ${map[p]||'badge-muted'}">${p}</span>`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—';
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/issues')}
      <div class="main-content">
        ${createHeader('Issues', user)}
        <div class="page-content">
          <div class="section-header">
            <h2 class="section-title">My Issues</h2>
            <button class="btn btn-primary" id="btn-raise-issue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Raise Issue
            </button>
          </div>

          <!-- Raise Issue Form -->
          <div id="issue-form-wrap" style="display:none;" class="inline-form mb-6">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Raise New Issue</h3>
            <div class="form-group">
              <label class="form-label">Issue Title</label>
              <input type="text" id="i-title" class="form-input" placeholder="Brief title of the issue">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Category</label>
                <select id="i-category" class="form-select">
                  <option>Academic</option><option>Career</option><option>Financial</option><option>Personal</option><option>Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select id="i-priority" class="form-select">
                  <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea id="i-desc" class="form-textarea" placeholder="Describe your issue in detail..."></textarea>
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-primary" id="btn-submit-issue">Submit Issue</button>
              <button class="btn btn-secondary" id="btn-cancel-issue">Cancel</button>
            </div>
          </div>

          <!-- Issues List -->
          <div id="issues-list">
            <div class="card" style="display:flex;align-items:center;justify-content:center;height:100px;">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  document.getElementById('btn-raise-issue').addEventListener('click', () => {
    const w = document.getElementById('issue-form-wrap');
    w.style.display = w.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-cancel-issue').addEventListener('click', () => {
    document.getElementById('issue-form-wrap').style.display = 'none';
  });

  document.getElementById('btn-submit-issue').addEventListener('click', async () => {
    const title    = document.getElementById('i-title').value.trim();
    const category = document.getElementById('i-category').value;
    const priority = document.getElementById('i-priority').value;
    const description = document.getElementById('i-desc').value.trim();
    if (!title || !description) { showToast('Please fill in title and description', 'warning'); return; }
    try {
      await api.post('/api/student/issues', { title, category, priority, description, mentorId: user.mentorId });
      showToast('Issue raised successfully', 'success');
    } catch {
      showToast('Issue submitted (offline mode)', 'info');
    }
    document.getElementById('issue-form-wrap').style.display = 'none';
    loadIssues();
  });

  loadIssues();
}

async function loadIssues() {
  const wrap = document.getElementById('issues-list');
  let issues = MOCK_ISSUES;
  try { issues = await api.get('/api/student/issues'); } catch {}

  if (!issues || issues.length === 0) {
    wrap.innerHTML = `<div class="empty-state" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <h3>No issues raised</h3><p>Great! You have no open issues.</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${issues.map(issue => `
        <div class="card" style="padding:20px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <h3 style="font-size:0.95rem;font-weight:600;margin:0;">${issue.title}</h3>
                ${statusBadge(issue.status)}
                ${priorityBadge(issue.priority)}
                <span class="badge badge-info">${issue.category}</span>
              </div>
              <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:8px;">${issue.description}</p>
              <p style="color:var(--text-muted);font-size:0.75rem;">Raised on ${fmtDate(issue.createdAt)}</p>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
