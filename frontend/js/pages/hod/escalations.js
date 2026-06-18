import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK = [
  { id:'e1', title:'Attendance crisis',    student:'Arun Mehta',  mentor:'Dr. Shah',  reason:'Missed 8+ classes', status:'OPEN',     createdAt: new Date(Date.now()-86400000*2).toISOString() },
  { id:'e2', title:'Financial hardship',   student:'Raj Kumar',   mentor:'Dr. Gupta', reason:'Fee payment issue', status:'OPEN',     createdAt: new Date(Date.now()-86400000*5).toISOString() },
  { id:'e3', title:'Academic performance', student:'Meera Nair',  mentor:'Dr. Sharma',reason:'CGPA below 5.0',    status:'RESOLVED', createdAt: new Date(Date.now()-86400000*10).toISOString() },
];

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—';
}

export async function render(container) {
  const user = getUserProfile();
  let escalations = MOCK;

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/escalations')}
      <div class="main-content">
        ${createHeader('Escalations', user)}
        <div class="page-content">
          <div class="section-header" style="margin-bottom:16px;">
            <h2 class="section-title">Escalated Issues</h2>
            <span class="badge badge-warning">${escalations.filter(e=>e.status==='OPEN').length} Open</span>
          </div>
          <div id="esc-list"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  try { escalations = await api.get('/api/hod/escalations'); } catch {}

  function renderList() {
    const wrap = document.getElementById('esc-list');
    if (!escalations.length) {
      wrap.innerHTML = `<div class="empty-state card"><h3>No escalations</h3><p>All clear in your department.</p></div>`;
      return;
    }

    wrap.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
      ${escalations.map(e => `
        <div class="card" style="padding:20px;border-left:3px solid ${e.status==='OPEN'?'var(--warning)':'var(--success)'};">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <h3 style="font-size:0.95rem;font-weight:600;margin:0;">${e.title}</h3>
                <span class="badge ${e.status==='OPEN'?'badge-warning':'badge-success'}">${e.status}</span>
              </div>
              <p style="color:var(--text-secondary);font-size:0.825rem;margin-bottom:4px;">
                <strong>Student:</strong> ${e.student} &nbsp;|&nbsp; <strong>Mentor:</strong> ${e.mentor||'—'}
              </p>
              <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;"><strong>Reason:</strong> ${e.reason||'—'}</p>
              <p style="color:var(--text-muted);font-size:0.75rem;">Escalated on ${fmtDate(e.createdAt)}</p>
            </div>
            ${e.status === 'OPEN' ? `
              <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
                <button class="btn btn-sm btn-success resolve-esc-btn" data-id="${e.id}">✓ Resolve</button>
                <button class="btn btn-sm btn-danger escalate-to-dean-btn" data-id="${e.id}">↑ To Dean</button>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;

    document.querySelectorAll('.resolve-esc-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const resolution = prompt('Resolution notes:') || 'Resolved by HOD';
        try { await api.put(`/api/issues/${btn.dataset.id}`, { status:'RESOLVED', resolution }); } catch {}
        const e = escalations.find(x => x.id === btn.dataset.id);
        if (e) e.status = 'RESOLVED';
        showToast('Issue resolved!', 'success');
        renderList();
      });
    });

    document.querySelectorAll('.escalate-to-dean-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Why are you escalating to Dean?') || 'Requires Dean intervention';
        try { await api.put(`/api/issues/${btn.dataset.id}`, { escalationLevel:'DEAN', reason }); } catch {}
        showToast('Escalated to Dean', 'info');
      });
    });
  }

  renderList();
}
