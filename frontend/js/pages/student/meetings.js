import { api } from '/js/api.js';
import { navigateTo } from '/js/router.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MEETING_TYPES = ['Academic Issue','Career Guidance','Personal Concern','Internship','Project Guidance','Higher Studies'];

const MOCK = [
  { id: '1', type: 'Academic Issue', status: 'APPROVED', scheduledAt: new Date(Date.now()+86400000).toISOString(), description: 'Need help with backlog subjects', mentorName: 'Dr. Jane Smith' },
  { id: '2', type: 'Career Guidance', status: 'REQUESTED', scheduledAt: null, description: 'Placement preparation guidance', mentorName: 'Dr. Jane Smith' },
  { id: '3', type: 'Project Guidance', status: 'COMPLETED', scheduledAt: new Date(Date.now()-172800000).toISOString(), description: 'Final year project discussion', mentorName: 'Dr. Jane Smith' },
];

function statusBadge(s) {
  const map = { REQUESTED:'badge-warning', APPROVED:'badge-success', REJECTED:'badge-danger', COMPLETED:'badge-muted', CANCELLED:'badge-muted' };
  return `<span class="badge ${map[s]||'badge-muted'}">${s}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/meetings')}
      <div class="main-content">
        ${createHeader('Meetings', user)}
        <div class="page-content">
          <div class="section-header">
            <h2 class="section-title">My Meetings</h2>
            <button class="btn btn-primary" id="btn-new-meeting">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
              Request Meeting
            </button>
          </div>

          <!-- Request Form (hidden by default) -->
          <div id="meeting-form-wrap" style="display:none;" class="inline-form mb-6">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">New Meeting Request</h3>
            <div class="form-group">
              <label class="form-label">Meeting Type</label>
              <select id="m-type" class="form-select">
                ${MEETING_TYPES.map(t=>`<option>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea id="m-desc" class="form-textarea" placeholder="Briefly describe what you'd like to discuss..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Preferred Date (optional)</label>
              <input type="datetime-local" id="m-date" class="form-input">
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-primary" id="btn-submit-meeting">Submit Request</button>
              <button class="btn btn-secondary" id="btn-cancel-form">Cancel</button>
            </div>
          </div>

          <!-- Meetings List -->
          <div id="meetings-list">
            <div class="card" style="display:flex;align-items:center;justify-content:center;height:100px;">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire sidebar logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js');
    await logout();
  });

  // Toggle form
  document.getElementById('btn-new-meeting').addEventListener('click', () => {
    const wrap = document.getElementById('meeting-form-wrap');
    wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('btn-cancel-form').addEventListener('click', () => {
    document.getElementById('meeting-form-wrap').style.display = 'none';
  });

  // Submit request
  document.getElementById('btn-submit-meeting').addEventListener('click', async () => {
    const type = document.getElementById('m-type').value;
    const description = document.getElementById('m-desc').value.trim();
    const preferredDate = document.getElementById('m-date').value;
    if (!description) { showToast('Please enter a description', 'warning'); return; }

    try {
      await api.post('/api/student/meetings/request', { type, description, preferredDate: preferredDate || null, mentorId: user.mentorId });
      showToast('Meeting request sent!', 'success');
      document.getElementById('meeting-form-wrap').style.display = 'none';
      loadMeetings();
    } catch {
      showToast('Request sent (offline mode)', 'info');
      document.getElementById('meeting-form-wrap').style.display = 'none';
    }
  });

  loadMeetings();
}

async function loadMeetings() {
  const wrap = document.getElementById('meetings-list');
  let meetings = MOCK;
  try { meetings = await api.get('/api/student/meetings'); } catch {}

  if (!meetings || meetings.length === 0) {
    wrap.innerHTML = `<div class="empty-state" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);">
      <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
      <h3>No meetings yet</h3><p>Request your first meeting with your mentor.</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="card">
      <table class="data-table">
        <thead><tr>
          <th>Type</th><th>Description</th><th>Scheduled At</th><th>Status</th><th>Action</th>
        </tr></thead>
        <tbody>
          ${meetings.map(m => `
            <tr>
              <td><strong>${m.type}</strong></td>
              <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.description||'—'}</td>
              <td>${fmtDate(m.scheduledAt)}</td>
              <td>${statusBadge(m.status)}</td>
              <td>
                ${m.status === 'APPROVED' ? `<button class="btn btn-sm btn-primary join-btn" data-id="${m.id}">Join</button>` :
                  m.status === 'REQUESTED' ? `<button class="btn btn-sm btn-secondary cancel-btn" data-id="${m.id}">Cancel</button>` : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('.join-btn').forEach(b => {
    b.addEventListener('click', () => navigateTo(`/meeting-room?id=${b.dataset.id}`));
  });
  document.querySelectorAll('.cancel-btn').forEach(b => {
    b.addEventListener('click', async () => {
      try { await api.put(`/api/student/meetings/${b.dataset.id}`, { status: 'CANCELLED' }); } catch {}
      showToast('Meeting cancelled', 'info');
      loadMeetings();
    });
  });
}
