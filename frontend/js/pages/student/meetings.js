import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService, NotificationService } from '/js/services.js';

const TYPES = ['Academic Issue','Career Guidance','Personal Concern','Internship','Project Guidance','Higher Studies'];

function statusBadge(s) {
  const cls = {REQUESTED:'badge-warning',APPROVED:'badge-success',ONGOING:'badge-info',REJECTED:'badge-danger',COMPLETED:'badge-muted',CANCELLED:'badge-muted'}[s] || 'badge-muted';
  return `<span class="badge ${cls}">${s}</span>`;
}
function fmt(iso) {
  if (!iso) return 'Not Scheduled Yet';
  const d = new Date(iso);
  if (isNaN(d.valueOf()) || d.getFullYear() < 2020) return 'Not Scheduled Yet';
  return d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
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
    const f = container.querySelector('#req-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  };

  container.querySelector('#btn-new').addEventListener('click', toggle);
  container.querySelector('#btn-cancel').addEventListener('click', toggle);

  container.querySelector('#btn-submit').addEventListener('click', async () => {
    const type        = container.querySelector('#m-type').value;
    const description = container.querySelector('#m-desc').value.trim();
    const preferredDate = container.querySelector('#m-date').value || null;

    if (!description) { showToast('Please enter a description', 'warning'); return; }
    try {
      const btn = container.querySelector('#btn-submit');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';

      const { StudentService } = await import('/js/services.js');
      const freshUser = await StudentService.get(user.id);
      if (freshUser) {
        Object.assign(user, freshUser);
        localStorage.setItem('mentorOS_profile', JSON.stringify(user));
      }

      if (!user.mentorId) {
        showToast('You have no mentor assigned yet', 'error');
        return;
      }

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
      container.querySelector('#req-form').style.display = 'none';
      container.querySelector('#m-desc').value = '';
      loadMeetings();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      const btn = container.querySelector('#btn-submit');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Submit Request'; }
    }
  });

  async function loadMeetings() {
    const wrap = container.querySelector('#meetings-wrap');
    if (!wrap) return;
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

      wrap.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
        ${meetings.map(m => `
          <div class="card" style="padding:20px;" id="m-card-${m.id}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
              <div style="flex:1;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;">
                  <strong style="font-size:0.9rem;">${m.type}</strong>
                  ${statusBadge(m.status)}
                  ${m.status === 'ONGOING' ? '<span style="font-size:0.7rem;color:var(--info);font-weight:600;animation:pulse 1.5s ease-in-out infinite;">● LIVE</span>' : ''}
                </div>
                <p style="color:var(--text-secondary);font-size:0.825rem;margin-bottom:4px;">${m.description || ''}</p>
                <p style="color:var(--text-muted);font-size:0.78rem;">${m.scheduledAt ? 'Scheduled: ' + fmt(m.scheduledAt) : m.preferredDate ? 'Preferred: ' + fmt(m.preferredDate) : 'No date set'}</p>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
                ${(m.status === 'APPROVED' || m.status === 'ONGOING') ? `<button class="btn btn-sm btn-primary join-btn" data-id="${m.id}">Join Meeting</button>` : ''}
                ${m.status === 'REQUESTED' ? `<button class="btn btn-sm btn-secondary cancel-btn" data-id="${m.id}">Cancel</button>` : ''}
                ${m.status === 'COMPLETED' && m.notes ? `<button class="btn btn-sm btn-secondary view-notes-btn" data-id="${m.id}">View Notes</button>` : ''}
              </div>
            </div>
            ${m.status === 'COMPLETED' && m.notes ? `
            <div id="notes-panel-${m.id}" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
              <h4 style="font-size:0.85rem;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">Meeting Notes</h4>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${m.notes.problem ? `<div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;"><p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">Problem Discussed</p><p style="font-size:0.825rem;">${m.notes.problem}</p></div>` : ''}
                ${m.notes.advice ? `<div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;"><p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">Advice Given</p><p style="font-size:0.825rem;">${m.notes.advice}</p></div>` : ''}
                ${m.notes.summary ? `<div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;grid-column:1/-1;"><p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">Summary</p><p style="font-size:0.825rem;">${m.notes.summary}</p></div>` : ''}
                ${m.notes.tasks?.length ? `<div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;grid-column:1/-1;"><p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">Action Items</p>${m.notes.tasks.map(t => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="color:var(--accent);">→</span><p style="font-size:0.825rem;">${t}</p></div>`).join('')}</div>` : ''}
              </div>
            </div>` : ''}
          </div>
        `).join('')}
      </div>`;

      document.querySelectorAll('.view-notes-btn').forEach(b => {
        b.addEventListener('click', () => {
          const panel = document.getElementById(`notes-panel-${b.dataset.id}`);
          if (panel) {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            b.textContent = isHidden ? 'Hide Notes' : 'View Notes';
          }
        });
      });

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
