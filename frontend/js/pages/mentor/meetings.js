import { getUserProfile } from '/js/auth.js';
import { navigateTo } from '/js/router.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { MeetingService, NotificationService, TaskService } from '/js/services.js';

function statusBadge(s) {
  const cls = {REQUESTED:'badge-warning',APPROVED:'badge-success',REJECTED:'badge-danger',COMPLETED:'badge-muted',CANCELLED:'badge-muted'}[s]||'badge-muted';
  return `<span class="badge ${cls}">${s}</span>`;
}
function fmt(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/meetings')}
      <div class="main-content">
        ${createHeader('Meetings', user)}
        <div class="page-content">
          <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;" id="tab-bar">
            ${['Pending','Approved','Completed','All'].map((t,i) =>
              `<button class="tab-btn ${i===0?'tab-active':''}" data-tab="${t.toLowerCase()}"
                style="padding:10px 20px;background:none;border:none;border-bottom:2px solid ${i===0?'var(--accent)':'transparent'};
                color:${i===0?'var(--accent)':'var(--text-secondary)'};font-weight:500;cursor:pointer;font-size:0.875rem;transition:all 0.2s;">
                ${t}
              </button>`
            ).join('')}
          </div>
          <div id="meetings-panel">
            <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let meetings = [];
  let activeTab = 'pending';

  try {
    meetings = await MeetingService.getByMentor(user.id);
  } catch (err) {
    showToast('Error loading meetings: ' + err.message, 'error');
  }

  function renderTab() {
    const panel = document.getElementById('meetings-panel');
    let list = meetings;
    if (activeTab === 'pending')   list = meetings.filter(m => m.status === 'REQUESTED');
    if (activeTab === 'approved')  list = meetings.filter(m => m.status === 'APPROVED');
    if (activeTab === 'completed') list = meetings.filter(m => m.status === 'COMPLETED');

    if (!list.length) {
      panel.innerHTML = `<div class="empty-state card" style="padding:48px;">
        <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
        <h3>No meetings in this category</h3>
      </div>`;
      return;
    }

    panel.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
      ${list.map(m => `
        <div class="card" style="padding:20px;" id="card-${m.id}">
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div class="avatar avatar-sm">${(m.studentName||'?')[0]}</div>
            <div style="flex:1;">
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;">
                <strong style="font-size:0.9rem;">${m.studentName || '—'}</strong>
                <span class="badge badge-accent">${m.type}</span>
                ${statusBadge(m.status)}
              </div>
              <p style="color:var(--text-secondary);font-size:0.825rem;margin-bottom:6px;">${m.description || ''}</p>
              <p style="color:var(--text-muted);font-size:0.78rem;">
                ${m.scheduledAt ? 'Scheduled: ' + fmt(m.scheduledAt) : m.preferredDate ? 'Preferred: ' + fmt(m.preferredDate) : 'No date set'}
              </p>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
              ${m.status === 'REQUESTED' ? `
                <input type="datetime-local" class="form-input sched-i" data-id="${m.id}" style="width:210px;padding:7px 10px;font-size:0.8rem;">
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-sm btn-success appr-btn" data-id="${m.id}" data-sid="${m.studentId}">✓ Approve</button>
                  <button class="btn btn-sm btn-danger  rej-btn"  data-id="${m.id}" data-sid="${m.studentId}">✗ Reject</button>
                </div>
              ` : m.status === 'APPROVED' ? `
                <button class="btn btn-sm btn-primary join-btn" data-id="${m.id}">Join Meeting</button>
                <button class="btn btn-sm btn-secondary note-btn" data-id="${m.id}">Add Notes</button>
              ` : m.status === 'COMPLETED' ? `
                <button class="btn btn-sm btn-secondary note-btn" data-id="${m.id}">View Notes</button>
              ` : ''}
            </div>
          </div>

          <!-- Notes form (hidden) -->
          <div id="notes-${m.id}" style="display:none;" class="inline-form" style="margin-top:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group"><label class="form-label">Problem Discussed</label><textarea class="form-textarea np" style="min-height:60px;" placeholder="What was discussed?">${m.notes?.problem||''}</textarea></div>
              <div class="form-group"><label class="form-label">Advice Given</label><textarea class="form-textarea na" style="min-height:60px;" placeholder="Guidance provided?">${m.notes?.advice||''}</textarea></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Summary</label><textarea class="form-textarea ns" style="min-height:60px;" placeholder="Meeting summary...">${m.notes?.summary||''}</textarea></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Action Items (one per line)</label><textarea class="form-textarea nt" style="min-height:60px;" placeholder="Task 1&#10;Task 2">${(m.notes?.tasks||[]).join('\n')}</textarea></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn btn-sm btn-primary save-note-btn" data-id="${m.id}" data-sid="${m.studentId}">Save Notes</button>
              <button class="btn btn-sm btn-secondary" onclick="document.getElementById('notes-${m.id}').style.display='none'">Cancel</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;

    // Approve
    document.querySelectorAll('.appr-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const scheduledAt = document.querySelector(`.sched-i[data-id="${btn.dataset.id}"]`)?.value;
        if (!scheduledAt) { showToast('Select date/time first', 'warning'); return; }
        try {
          await MeetingService.update(btn.dataset.id, { status:'APPROVED', scheduledAt });
          if (btn.dataset.sid) {
            await NotificationService.create({
              userId: btn.dataset.sid, type:'MEETING_APPROVED',
              title:'Meeting Approved!', message:`Scheduled for ${fmt(scheduledAt)}`, relatedId:btn.dataset.id
            });
          }
          meetings.find(m => m.id === btn.dataset.id).status = 'APPROVED';
          showToast('Meeting approved!', 'success'); renderTab();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // Reject
    document.querySelectorAll('.rej-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Rejection reason:') || 'Unavailable at that time';
        try {
          await MeetingService.update(btn.dataset.id, { status:'REJECTED', rejectionReason:reason });
          meetings.find(m => m.id === btn.dataset.id).status = 'REJECTED';
          showToast('Meeting rejected', 'info'); renderTab();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // Join
    document.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(`/meeting-room?id=${btn.dataset.id}`));
    });

    // Notes panel toggle
    document.querySelectorAll('.note-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = document.getElementById(`notes-${btn.dataset.id}`);
        w.style.display = w.style.display === 'none' ? 'block' : 'none';
      });
    });

    // Save notes
    document.querySelectorAll('.save-note-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = document.getElementById(`card-${btn.dataset.id}`);
        const notes = {
          problem: card.querySelector('.np')?.value || '',
          advice:  card.querySelector('.na')?.value || '',
          summary: card.querySelector('.ns')?.value || '',
          tasks:   card.querySelector('.nt')?.value?.split('\n').filter(Boolean) || []
        };
        try {
          await MeetingService.addNotes(btn.dataset.id, notes);
          // Create action items from tasks list
          if (btn.dataset.sid && notes.tasks.length) {
            for (const desc of notes.tasks) {
              await TaskService.create({
                studentId: btn.dataset.sid,
                mentorId: user.id,
                description: desc,
                category: 'Meeting Action',
                dueDate: null
              });
            }
          }
          showToast('Notes saved!', 'success');
          document.getElementById(`notes-${btn.dataset.id}`).style.display = 'none';
          meetings.find(m => m.id === btn.dataset.id).status = 'COMPLETED';
          renderTab();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => { b.style.borderBottomColor='transparent'; b.style.color='var(--text-secondary)'; });
      btn.style.borderBottomColor = 'var(--accent)'; btn.style.color = 'var(--accent)';
      activeTab = btn.dataset.tab; renderTab();
    });
  });

  renderTab();
}
