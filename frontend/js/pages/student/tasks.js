import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK = [
  { id:'1', description:'Submit mini-project report', dueDate: new Date(Date.now()+86400000*2).toISOString(), status:'PENDING', category:'Academic', progress:30 },
  { id:'2', description:'Complete resume draft', dueDate: new Date(Date.now()+86400000*5).toISOString(), status:'IN_PROGRESS', category:'Career', progress:60 },
  { id:'3', description:'Prepare for mid-semester viva', dueDate: new Date(Date.now()-86400000).toISOString(), status:'OVERDUE', category:'Academic', progress:10 },
  { id:'4', description:'Submit internship application', dueDate: new Date(Date.now()-86400000*4).toISOString(), status:'COMPLETED', category:'Internship', progress:100 },
];

function statusColor(s) {
  return { PENDING:'badge-warning', IN_PROGRESS:'badge-info', COMPLETED:'badge-success', OVERDUE:'badge-danger' }[s] || 'badge-muted';
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—';
}

function progressBar(pct, status) {
  const color = status === 'COMPLETED' ? 'fill-success' : status === 'OVERDUE' ? 'fill-danger' : '';
  return `<div class="progress-bar-wrap"><div class="progress-bar-fill ${color}" style="width:${pct}%"></div></div>`;
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/tasks')}
      <div class="main-content">
        ${createHeader('My Tasks', user)}
        <div class="page-content">
          <div class="section-header">
            <h2 class="section-title">Action Items</h2>
            <div style="display:flex;gap:8px;" id="filter-btns">
              ${['ALL','PENDING','IN_PROGRESS','COMPLETED','OVERDUE'].map((f,i) =>
                `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} filter-btn" data-filter="${f}">${f.replace('_',' ')}</button>`
              ).join('')}
            </div>
          </div>
          <div id="tasks-list"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  let currentFilter = 'ALL';
  let allTasks = MOCK;

  try { allTasks = await api.get('/api/student/tasks'); } catch {}

  function render_tasks() {
    const list = document.getElementById('tasks-list');
    const filtered = currentFilter === 'ALL' ? allTasks : allTasks.filter(t => t.status === currentFilter);

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state card"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg><h3>No tasks here</h3><p>Your mentor will assign tasks after meetings.</p></div>`;
      return;
    }

    list.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${filtered.map(t => `
          <div class="card" style="padding:20px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                  <h3 style="font-size:0.9rem;font-weight:600;margin:0;${t.status==='COMPLETED'?'text-decoration:line-through;color:var(--text-muted);':''}">${t.description}</h3>
                  <span class="badge ${statusColor(t.status)}">${t.status.replace('_',' ')}</span>
                  <span class="badge badge-info">${t.category||''}</span>
                </div>
                <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:10px;">Due: ${fmtDate(t.dueDate)}</p>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="flex:1;">${progressBar(t.progress||0, t.status)}</div>
                  <span style="font-size:0.75rem;color:var(--text-muted);width:36px;text-align:right;">${t.progress||0}%</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${t.status !== 'COMPLETED' ? `<button class="btn btn-xs btn-success complete-btn" data-id="${t.id}">✓ Done</button>` : ''}
                ${t.status === 'PENDING' ? `<button class="btn btn-xs btn-secondary start-btn" data-id="${t.id}">Start</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.querySelectorAll('.complete-btn').forEach(b => {
      b.addEventListener('click', async () => {
        try { await api.put(`/api/student/tasks/${b.dataset.id}`, { status:'COMPLETED', progress:100 }); } catch {}
        const t = allTasks.find(x => x.id === b.dataset.id);
        if (t) { t.status = 'COMPLETED'; t.progress = 100; }
        showToast('Task marked complete!', 'success');
        render_tasks();
      });
    });

    document.querySelectorAll('.start-btn').forEach(b => {
      b.addEventListener('click', async () => {
        try { await api.put(`/api/student/tasks/${b.dataset.id}`, { status:'IN_PROGRESS' }); } catch {}
        const t = allTasks.find(x => x.id === b.dataset.id);
        if (t) { t.status = 'IN_PROGRESS'; }
        render_tasks();
      });
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => { b.className = 'btn btn-sm btn-secondary filter-btn'; });
      btn.className = 'btn btn-sm btn-primary filter-btn';
      currentFilter = btn.dataset.filter;
      render_tasks();
    });
  });

  render_tasks();
}
