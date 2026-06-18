import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService, NotificationService } from '/js/services.js';

const TYPES = ['Academic Issue','Career Guidance','Personal Concern','Internship','Project Guidance','Higher Studies'];

function statusBadge(s) {
  const cls = {REQUESTED:'badge-warning',APPROVED:'badge-success',REJECTED:'badge-danger',COMPLETED:'badge-muted',CANCELLED:'badge-muted'}[s] || 'badge-muted';
  return `<span class="badge ${cls}">${s}</span>`;
}
function fmt(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
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
            <button class="btn btn-primary" id="btn-new">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
              Request Meeting
            </button>
          </div>

          <div id="req-form" style="display:none;" class="inline-form mb-6">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">New Meeting Request</h3>
            <div class="form-group">
              <label class="form-label">Meeting Type</label>
              <select id="m-type" class="form-select">${TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea id="m-desc" class="form-textarea" placeholder="What would you like to discuss?"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Preferred Date (optional)</label>
              <input type="datetime-local" id="m-date" class="form-input">
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-primary" id="btn-submit">Submit Request</button>
              <button class="btn btn-secondary" id="btn-cancel">Cancel</button>
            </div>
          </div>

          <div id="meetings-wrap">
            <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const toggle = () => {
    const f = document.getElementById('req-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  };

  document.getElementById('btn-new').addEventListener('click', toggle);
  document.getElementById('btn-cancel').addEventListener('click', toggle);

  document.getElementById('btn-submit').addEventListener('click', async () => {
    const type        = document.getElementById('m-type').value;
    const description = document.getElementById('m-desc').value.trim();
    const preferredDate = document.getElementById('m-date').value || null;

    if (!description) { showToast('Please enter a description', 'warning'); return; }
    if (!user.mentorId) { showToast('You have no mentor assigned yet', 'error'); return; }

    try {
      const btn = document.getElementById('btn-submit');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';

      await MeetingService.create({
        studentId: user.id,
        studentName: user.name,
        mentorId: user.mentorId,
        type,
        description,
        preferredDate
      });

      await NotificationService.create({
        userId: user.mentorId,
        type: 'MEETING_REQUEST',
        title: 'New Meeting Request',
        message: `${user.name} has requested a meeting: ${type}`,
        relatedId: user.id
      });

      showToast('Meeting request sent!', 'success');
      document.getElementById('req-form').style.display = 'none';
      document.getElementById('m-desc').value = '';
      loadMeetings();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      const btn = document.getElementById('btn-submit');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Submit Request'; }
    }
  });

  async function loadMeetings() {
    const wrap = document.getElementById('meetings-wrap');
    try {
      const meetings = await MeetingService.getByStudent(user.id);

      if (!meetings.length) {
        wrap.innerHTML = `<div class="empty-state card" style="padding:48px;">
          <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          <h3>No meetings yet</h3>
          <p>Request your first meeting with your mentor.</p>
        </div>`;
        return;
      }

      wrap.innerHTML = `<div class="card">
        <table class="data-table">
          <thead><tr><th>Type</th><th>Description</th><th>Scheduled</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${meetings.map(m => `
              <tr>
                <td><strong>${m.type}</strong></td>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);">${m.description || '—'}</td>
                <td style="font-size:0.825rem;">${fmt(m.scheduledAt || m.preferredDate)}</td>
                <td>${statusBadge(m.status)}</td>
                <td>
                  ${m.status === 'APPROVED' ? `<button class="btn btn-sm btn-primary join-btn" data-id="${m.id}">Join</button>` : ''}
                  ${m.status === 'REQUESTED' ? `<button class="btn btn-sm btn-secondary cancel-btn" data-id="${m.id}">Cancel</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

      document.querySelectorAll('.join-btn').forEach(b => {
        b.addEventListener('click', () => navigateTo(`/meeting-room?id=${b.dataset.id}`));
      });

      document.querySelectorAll('.cancel-btn').forEach(b => {
        b.addEventListener('click', async () => {
          try {
            await MeetingService.update(b.dataset.id, { status: 'CANCELLED' });
            showToast('Meeting cancelled', 'info');
            loadMeetings();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });

    } catch (err) {
      wrap.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading meetings</h3><p>${err.message}</p></div>`;
    }
  }

  loadMeetings();
}
