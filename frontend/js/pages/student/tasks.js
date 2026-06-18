import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { TaskService } from '/js/services.js';

function statusCls(s) { return {PENDING:'badge-warning',IN_PROGRESS:'badge-info',COMPLETED:'badge-success',OVERDUE:'badge-danger'}[s]||'badge-muted'; }
function fmt(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'; }
function barClass(s) { return s==='COMPLETED'?'fill-success':s==='OVERDUE'?'fill-danger':''; }

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
            <div style="display:flex;gap:6px;flex-wrap:wrap;" id="filter-wrap">
              ${['ALL','PENDING','IN_PROGRESS','COMPLETED','OVERDUE'].map((f,i)=>
                `<button class="btn btn-sm ${i===0?'btn-primary':'btn-secondary'} filt" data-f="${f}">${f.replace('_',' ')}</button>`
              ).join('')}
            </div>
          </div>
          <div id="tasks-wrap">
            <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let tasks = [];
  let filter = 'ALL';

  function renderTasks() {
    const wrap = document.getElementById('tasks-wrap');
    let list = filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter);

    // Auto-mark overdue
    list = list.map(t => {
      if (t.dueDate && t.status !== 'COMPLETED' && new Date(t.dueDate) < new Date()) {
        return { ...t, status: 'OVERDUE' };
      }
      return t;
    });

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state card" style="padding:48px;">
        <svg viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
        <h3>No tasks found</h3>
        <p>Your mentor will assign tasks after meetings.</p>
      </div>`;
      return;
    }

    wrap.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
      ${list.map(t => `
        <div class="card" style="padding:20px;">
          <div style="display:flex;align-items:flex-start;gap:16px;">
            <div style="flex:1;">
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
                <h3 style="font-size:0.9rem;font-weight:600;margin:0;${t.status==='COMPLETED'?'text-decoration:line-through;color:var(--text-muted);':''}">${t.description}</h3>
                <span class="badge ${statusCls(t.status)}">${t.status.replace('_',' ')}</span>
                ${t.category ? `<span class="badge badge-info">${t.category}</span>` : ''}
              </div>
              <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:10px;">Due: ${fmt(t.dueDate)}</p>
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="flex:1;" class="progress-bar-wrap">
                  <div class="progress-bar-fill ${barClass(t.status)}" style="width:${t.progress||0}%"></div>
                </div>
                <span style="font-size:0.75rem;color:var(--text-muted);min-width:36px;">${t.progress||0}%</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
              ${t.status !== 'COMPLETED' ? `<button class="btn btn-xs btn-success done-btn" data-id="${t.id}">✓ Done</button>` : ''}
              ${t.status === 'PENDING'   ? `<button class="btn btn-xs btn-secondary start-btn" data-id="${t.id}">Start</button>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;

    document.querySelectorAll('.done-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await TaskService.markComplete(btn.dataset.id);
          const t = tasks.find(x => x.id === btn.dataset.id);
          if (t) { t.status = 'COMPLETED'; t.progress = 100; }
          showToast('Task marked complete!', 'success');
          renderTasks();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    document.querySelectorAll('.start-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await TaskService.update(btn.dataset.id, { status: 'IN_PROGRESS', progress: 10 });
          const t = tasks.find(x => x.id === btn.dataset.id);
          if (t) { t.status = 'IN_PROGRESS'; t.progress = 10; }
          renderTasks();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  }

  // Load from Firestore
  try {
    tasks = await TaskService.getByStudent(user.id);
  } catch (err) {
    showToast('Error loading tasks: ' + err.message, 'error');
  }

  document.querySelectorAll('.filt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filt').forEach(b => b.className = 'btn btn-sm btn-secondary filt');
      btn.className = 'btn btn-sm btn-primary filt';
      filter = btn.dataset.f;
      renderTasks();
    });
  });

  renderTasks();
}
