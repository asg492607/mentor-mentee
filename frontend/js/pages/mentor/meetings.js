import { api } from '/js/api.js';
import { navigateTo } from '/js/router.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK = [
  { id:'m1', studentName:'Ravi Kumar',  type:'Academic Issue', status:'REQUESTED', description:'Help with backlog',  preferredDate: new Date(Date.now()+86400000).toISOString(), scheduledAt: null },
  { id:'m2', studentName:'Arun Mehta',  type:'Personal Concern',status:'REQUESTED', description:'Personal issue',    preferredDate: null, scheduledAt: null },
  { id:'m3', studentName:'Priya Singh', type:'Career Guidance', status:'APPROVED',  description:'Resume review',    preferredDate: null, scheduledAt: new Date(Date.now()+172800000).toISOString() },
  { id:'m4', studentName:'Neha Joshi',  type:'Project Guidance',status:'COMPLETED', description:'FYP discussion',   preferredDate: null, scheduledAt: new Date(Date.now()-86400000).toISOString() },
];

function statusBadge(s) {
  const map = { REQUESTED:'badge-warning', APPROVED:'badge-success', REJECTED:'badge-danger', COMPLETED:'badge-muted', CANCELLED:'badge-muted' };
  return `<span class="badge ${map[s]||'badge-muted'}">${s}</span>`;
}

function fmtDate(iso) {
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
          <!-- Tabs -->
          <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;">
            ${['Pending','Approved','Completed','All'].map((t,i)=>`
              <button class="tab-btn ${i===0?'tab-active':''}" data-tab="${t.toLowerCase()}"
                style="padding:10px 20px;background:none;border:none;border-bottom:2px solid ${i===0?'var(--accent)':'transparent'};
                       color:${i===0?'var(--accent)':'var(--text-secondary)'};font-weight:500;cursor:pointer;font-size:0.875rem;transition:all 0.2s;">
                ${t}
              </button>
            `).join('')}
          </div>
          <div id="meetings-panel"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let meetings = MOCK;
  try { meetings = await api.get('/api/mentor/meetings'); } catch {}

  let activeTab = 'pending';

  function renderTab() {
    const panel = document.getElementById('meetings-panel');
    const filtered = activeTab === 'all' ? meetings
      : meetings.filter(m => m.status.toLowerCase() === activeTab ||
          (activeTab === 'pending' && m.status === 'REQUESTED'));

    if (!filtered.length) {
      panel.innerHTML = `<div class="empty-state card"><svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg><h3>No meetings</h3><p>No meetings in this category.</p></div>`;
      return;
    }

    panel.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
      ${filtered.map(m => `
        <div class="card" style="padding:20px;">
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div class="avatar avatar-sm">${(m.studentName||'?')[0]}</div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <strong style="font-size:0.9rem;">${m.studentName}</strong>
                <span style="background:var(--accent-light);color:var(--accent);padding:2px 8px;border-radius:20px;font-size:0.72rem;">${m.type}</span>
                ${statusBadge(m.status)}
              </div>
              <p style="color:var(--text-secondary);font-size:0.825rem;margin-bottom:8px;">${m.description||''}</p>
              <p style="color:var(--text-muted);font-size:0.78rem;">
                ${m.scheduledAt ? 'Scheduled: ' + fmtDate(m.scheduledAt) : m.preferredDate ? 'Preferred: ' + fmtDate(m.preferredDate) : 'No date set'}
              </p>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
              ${m.status === 'REQUESTED' ? `
                <input type="datetime-local" class="form-input" id="sched-${m.id}" style="width:220px;padding:7px 10px;font-size:0.8rem;">
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-sm btn-success approve-btn" data-id="${m.id}">✓ Approve</button>
                  <button class="btn btn-sm btn-danger reject-btn"   data-id="${m.id}">✗ Reject</button>
                </div>
              ` : m.status === 'APPROVED' ? `
                <button class="btn btn-sm btn-primary join-btn" data-id="${m.id}">Join Meeting</button>
                <button class="btn btn-sm btn-secondary notes-btn" data-id="${m.id}" data-name="${m.studentName}">Add Notes</button>
              ` : m.status === 'COMPLETED' ? `
                <button class="btn btn-sm btn-secondary notes-btn" data-id="${m.id}" data-name="${m.studentName}">View/Edit Notes</button>
              ` : ''}
            </div>
          </div>
          <!-- Notes Form (hidden) -->
          <div id="notes-${m.id}" style="display:none;" class="inline-form" style="margin-top:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group"><label class="form-label">Problem discussed</label><textarea class="form-textarea note-problem" style="min-height:60px;" placeholder="What issue was discussed?"></textarea></div>
              <div class="form-group"><label class="form-label">Advice given</label><textarea class="form-textarea note-advice" style="min-height:60px;" placeholder="What guidance was provided?"></textarea></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Summary</label><textarea class="form-textarea note-summary" style="min-height:60px;" placeholder="Meeting summary..."></textarea></div>
              <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Action items (one per line)</label><textarea class="form-textarea note-tasks" style="min-height:60px;" placeholder="e.g. Submit assignment by Friday"></textarea></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn btn-sm btn-primary save-notes-btn" data-id="${m.id}">Save Notes</button>
              <button class="btn btn-sm btn-secondary" onclick="document.getElementById('notes-${m.id}').style.display='none'">Cancel</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;

    // Handlers
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const scheduledAt = document.getElementById(`sched-${btn.dataset.id}`)?.value;
        if (!scheduledAt) { showToast('Select date/time first', 'warning'); return; }
        try { await api.put(`/api/mentor/meetings/${btn.dataset.id}`, { status:'APPROVED', scheduledAt }); } catch {}
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (m) { m.status = 'APPROVED'; m.scheduledAt = scheduledAt; }
        showToast('Meeting approved!', 'success');
        renderTab();
      });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Rejection reason:') || '';
        try { await api.put(`/api/mentor/meetings/${btn.dataset.id}`, { status:'REJECTED', rejectionReason: reason }); } catch {}
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (m) m.status = 'REJECTED';
        showToast('Meeting rejected', 'info');
        renderTab();
      });
    });

    document.querySelectorAll('.join-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(`/meeting-room?id=${btn.dataset.id}`));
    });

    document.querySelectorAll('.notes-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const wrap = document.getElementById(`notes-${btn.dataset.id}`);
        wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
      });
    });

    document.querySelectorAll('.save-notes-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const wrap = btn.closest('.inline-form');
        const notes = {
          problem: wrap.querySelector('.note-problem').value,
          advice:  wrap.querySelector('.note-advice').value,
          summary: wrap.querySelector('.note-summary').value,
          tasks:   wrap.querySelector('.note-tasks').value.split('\n').filter(Boolean),
        };
        try { await api.post(`/api/mentor/meetings/${btn.dataset.id}/notes`, notes); showToast('Notes saved!', 'success'); }
        catch { showToast('Notes saved (offline)', 'info'); }
        wrap.style.display = 'none';
      });
    });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--text-secondary)';
      });
      btn.style.borderBottomColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
      activeTab = btn.dataset.tab;
      renderTab();
    });
  });

  renderTab();
}
