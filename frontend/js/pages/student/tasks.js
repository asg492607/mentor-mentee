import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { TaskService, NotificationService } from '/js/services.js';
import { escapeHtml } from '/js/utils.js';
import { t, getLanguage } from '/js/i18n.js';

function statusCls(s) {
  return {
    PENDING: 'badge-warning',
    IN_PROGRESS: 'badge-info',
    COMPLETED: 'badge-success',
    OVERDUE: 'badge-danger'
  }[s] || 'badge-muted';
}

function categoryCls(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('acad')) return 'badge-info';
  if (c.includes('career') || c.includes('place')) return 'badge-accent';
  if (c.includes('project') || c.includes('research')) return 'badge-warning';
  if (c.includes('well') || c.includes('person')) return 'badge-success';
  return 'badge-muted';
}

function fmt(iso) {
  if (!iso) return '—';
  const lang = getLanguage();
  const locale = lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  try {
    return new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' });
  } catch {
    return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  }
}

function barClass(s) {
  return s === 'COMPLETED' ? 'fill-success' : s === 'OVERDUE' ? 'fill-danger' : '';
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/tasks')}
      <div class="main-content">
        ${createHeader(t('tasks.title', 'My Tasks & Action Items'), user)}
        <div class="page-content">
          
          <!-- Summary Metrics Cards -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;" id="tasks-stats-row">
            <div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:14px;border-left:4px solid var(--accent);">
              <div style="width:42px;height:42px;border-radius:12px;background:rgba(108,71,255,0.12);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
                <i class="ph ph-check-square-offset"></i>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">${t('tasks.stat_total', 'Total Tasks')}</div>
                <div style="font-size:1.4rem;font-weight:800;color:var(--text-primary);" id="stat-total-val">0</div>
              </div>
            </div>

            <div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:14px;border-left:4px solid #f59e0b;">
              <div style="width:42px;height:42px;border-radius:12px;background:rgba(245,158,11,0.12);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
                <i class="ph ph-hourglass-high"></i>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">${t('tasks.filter_pending', 'Pending')}</div>
                <div style="font-size:1.4rem;font-weight:800;color:var(--text-primary);" id="stat-pending-val">0</div>
              </div>
            </div>

            <div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:14px;border-left:4px solid #10b981;">
              <div style="width:42px;height:42px;border-radius:12px;background:rgba(16,185,129,0.12);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
                <i class="ph ph-check-circle"></i>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">${t('tasks.filter_completed', 'Completed')}</div>
                <div style="font-size:1.4rem;font-weight:800;color:var(--text-primary);" id="stat-completed-val">0</div>
              </div>
            </div>

            <div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:14px;border-left:4px solid #ef4444;">
              <div style="width:42px;height:42px;border-radius:12px;background:rgba(239,68,68,0.12);color:#ef4444;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
                <i class="ph ph-warning"></i>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">${t('tasks.filter_overdue', 'Overdue')}</div>
                <div style="font-size:1.4rem;font-weight:800;color:var(--text-primary);" id="stat-overdue-val">0</div>
              </div>
            </div>
          </div>

          <!-- Action & Filter Bar -->
          <div class="card" style="padding:16px 20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
              
              <!-- Search Box -->
              <div style="position:relative;flex:1;min-width:240px;max-width:380px;">
                <i class="ph ph-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1rem;"></i>
                <input 
                  type="text" 
                  id="task-search-input" 
                  class="form-input" 
                  style="padding-left:36px;border-radius:24px;font-size:0.85rem;" 
                  placeholder="${t('tasks.search_placeholder', 'Search tasks by description or category...')}"
                />
              </div>

              <!-- Filter Pills -->
              <div style="display:flex;gap:8px;flex-wrap:wrap;" id="filter-wrap">
                <button class="btn btn-sm btn-primary filt active" data-f="ALL">
                  ${t('tasks.filter_all', 'All')} <span class="badge" style="margin-left:4px;padding:2px 6px;font-size:0.72rem;background:rgba(255,255,255,0.25);" id="cnt-all">0</span>
                </button>
                <button class="btn btn-sm btn-secondary filt" data-f="PENDING">
                  ${t('tasks.filter_pending', 'Pending')} <span class="badge" style="margin-left:4px;padding:2px 6px;font-size:0.72rem;background:rgba(0,0,0,0.08);" id="cnt-pending">0</span>
                </button>
                <button class="btn btn-sm btn-secondary filt" data-f="IN_PROGRESS">
                  ${t('tasks.filter_in_progress', 'In Progress')} <span class="badge" style="margin-left:4px;padding:2px 6px;font-size:0.72rem;background:rgba(0,0,0,0.08);" id="cnt-inprogress">0</span>
                </button>
                <button class="btn btn-sm btn-secondary filt" data-f="COMPLETED">
                  ${t('tasks.filter_completed', 'Completed')} <span class="badge" style="margin-left:4px;padding:2px 6px;font-size:0.72rem;background:rgba(0,0,0,0.08);" id="cnt-completed">0</span>
                </button>
                <button class="btn btn-sm btn-secondary filt" data-f="OVERDUE">
                  ${t('tasks.filter_overdue', 'Overdue')} <span class="badge" style="margin-left:4px;padding:2px 6px;font-size:0.72rem;background:rgba(0,0,0,0.08);" id="cnt-overdue">0</span>
                </button>
              </div>

            </div>
          </div>

          <!-- Tasks List Display -->
          <div id="tasks-wrap">
            <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>

        </div>
      </div>
    </div>
  `;

  let tasks = [];
  let filter = 'ALL';
  let searchQuery = '';

  function updateCounts() {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'PENDING').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const overdue = tasks.filter(t => t.status === 'OVERDUE').length;

    const elTotal = document.getElementById('stat-total-val');
    const elPending = document.getElementById('stat-pending-val');
    const elCompleted = document.getElementById('stat-completed-val');
    const elOverdue = document.getElementById('stat-overdue-val');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending + inProgress;
    if (elCompleted) elCompleted.textContent = completed;
    if (elOverdue) elOverdue.textContent = overdue;

    const cntAll = document.getElementById('cnt-all');
    const cntPend = document.getElementById('cnt-pending');
    const cntInProg = document.getElementById('cnt-inprogress');
    const cntComp = document.getElementById('cnt-completed');
    const cntOver = document.getElementById('cnt-overdue');

    if (cntAll) cntAll.textContent = total;
    if (cntPend) cntPend.textContent = pending;
    if (cntInProg) cntInProg.textContent = inProgress;
    if (cntComp) cntComp.textContent = completed;
    if (cntOver) cntOver.textContent = overdue;
  }

  function renderTasks() {
    const wrap = document.getElementById('tasks-wrap');
    if (!wrap) return;

    // Auto-mark overdue
    tasks = tasks.map(t => {
      if (t.dueDate && t.status !== 'COMPLETED' && new Date(t.dueDate) < new Date()) {
        return { ...t, status: 'OVERDUE' };
      }
      return t;
    });

    updateCounts();

    let list = filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        (t.description || '').toLowerCase().includes(q) || 
        (t.category || '').toLowerCase().includes(q)
      );
    }

    if (!list.length) {
      wrap.innerHTML = `
        <div class="empty-state card" style="padding:54px 24px;text-align:center;">
          <div style="width:64px;height:64px;border-radius:20px;background:rgba(108,71,255,0.1);color:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:16px;">
            <i class="ph ph-clipboard-text"></i>
          </div>
          <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:6px;color:var(--text-primary);">${t('tasks.empty_title', 'No tasks found')}</h3>
          <p style="color:var(--text-secondary);font-size:0.88rem;max-width:480px;margin:0 auto;line-height:1.6;">
            ${t('tasks.empty_desc', 'Your faculty mentor will assign actionable tasks and follow-ups after your meetings.')}
          </p>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${list.map(t => `
          <div class="card task-card ${t.status === 'OVERDUE' ? 'border-danger' : ''}" style="padding:22px;transition:transform 0.2s ease,box-shadow 0.2s ease;${t.status === 'OVERDUE' ? 'border-left:4px solid #ef4444;' : ''}">
            <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;">
              
              <!-- Checkmark / Status Icon -->
              <div style="width:38px;height:38px;border-radius:10px;background:${t.status==='COMPLETED'?'rgba(16,185,129,0.15)':t.status==='OVERDUE'?'rgba(239,68,68,0.15)':'rgba(108,71,255,0.1)'};color:${t.status==='COMPLETED'?'#10b981':t.status==='OVERDUE'?'#ef4444':'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">
                <i class="ph ${t.status==='COMPLETED'?'ph-check-bold':t.status==='OVERDUE'?'ph-clock-countdown-bold':'ph-check-square'}"></i>
              </div>

              <!-- Main Task Info -->
              <div style="flex:1;min-width:260px;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
                  <h3 style="font-size:0.95rem;font-weight:700;margin:0;color:var(--text-primary);${t.status==='COMPLETED'?'text-decoration:line-through;color:var(--text-muted);':''}">
                    ${escapeHtml(t.description)}
                  </h3>
                  <span class="badge ${statusCls(t.status)}">
                    ${escapeHtml(t('status.' + t.status.toLowerCase(), t.status.replace('_', ' ')))}
                  </span>
                  ${t.category ? `<span class="badge ${categoryCls(t.category)}">${escapeHtml(t.category)}</span>` : ''}
                </div>

                <div style="display:flex;align-items:center;gap:18px;margin-bottom:12px;font-size:0.8rem;color:var(--text-muted);flex-wrap:wrap;">
                  <span><i class="ph ph-calendar" style="margin-right:4px;"></i> ${t('tasks.due', 'Due')}: <strong>${fmt(t.dueDate)}</strong></span>
                  ${t.status === 'OVERDUE' ? '<span style="color:#ef4444;font-weight:700;"><i class="ph ph-warning-circle"></i> Overdue Attention Needed</span>' : ''}
                </div>

                <!-- Progress Meter -->
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                    <div class="progress-bar-fill ${barClass(t.status)}" style="width:${t.progress||0}%;height:100%;border-radius:4px;background:${t.status==='COMPLETED'?'#10b981':t.status==='OVERDUE'?'#ef4444':'var(--accent)'};transition:width 0.3s ease;"></div>
                  </div>
                  <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);min-width:40px;">${t.progress||0}%</span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;margin-left:auto;">
                ${t.status !== 'COMPLETED' ? `
                  <button class="btn btn-sm btn-success done-btn" data-id="${t.id}" style="display:inline-flex;align-items:center;gap:6px;border-radius:8px;font-weight:600;">
                    <i class="ph ph-check"></i> ${t('tasks.btn_done', '✓ Done')}
                  </button>
                ` : `
                  <button class="btn btn-sm btn-secondary reopen-btn" data-id="${t.id}" style="display:inline-flex;align-items:center;gap:6px;border-radius:8px;font-weight:600;">
                    <i class="ph ph-arrow-counter-clockwise"></i> ${t('tasks.btn_reopen', 'Re-open')}
                  </button>
                `}
                ${t.status === 'PENDING' ? `
                  <button class="btn btn-sm btn-secondary start-btn" data-id="${t.id}" style="display:inline-flex;align-items:center;gap:6px;border-radius:8px;font-weight:600;">
                    <i class="ph ph-play"></i> ${t('tasks.btn_start', 'Start')}
                  </button>
                ` : ''}
              </div>

            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire Done Buttons
    wrap.querySelectorAll('.done-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.done-btn')?.dataset?.id;
        if (!id) return;
        try {
          await TaskService.markComplete(id);
          const item = tasks.find(x => x.id === id);
          if (item) {
            item.status = 'COMPLETED';
            item.progress = 100;
            if (item.mentorId) {
              await NotificationService.create({
                userId: item.mentorId,
                type: 'TASK_COMPLETED',
                title: '✅ Task Completed by Student',
                message: `${user.name} marked action item completed: ${item.description}`,
                relatedId: item.id
              }).catch(() => null);
            }
          }
          showToast(t('tasks.toast_completed', 'Task marked complete and mentor notified!'), 'success');
          renderTasks();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Wire Start Buttons
    wrap.querySelectorAll('.start-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.start-btn')?.dataset?.id;
        if (!id) return;
        try {
          await TaskService.update(id, { status: 'IN_PROGRESS', progress: 25 });
          const item = tasks.find(x => x.id === id);
          if (item) {
            item.status = 'IN_PROGRESS';
            item.progress = 25;
          }
          showToast(t('tasks.toast_started', 'Task marked in progress!'), 'info');
          renderTasks();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Wire Re-open Buttons
    wrap.querySelectorAll('.reopen-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget?.dataset?.id || e.target.closest('.reopen-btn')?.dataset?.id;
        if (!id) return;
        try {
          await TaskService.update(id, { status: 'IN_PROGRESS', progress: 50 });
          const item = tasks.find(x => x.id === id);
          if (item) {
            item.status = 'IN_PROGRESS';
            item.progress = 50;
          }
          showToast(t('tasks.toast_reopened', 'Task re-opened!'), 'info');
          renderTasks();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // Wire Search Input
  const searchInput = container.querySelector('#task-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderTasks();
    });
  }

  // Wire Filter Buttons
  container.querySelectorAll('.filt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.currentTarget || e.target.closest('.filt');
      container.querySelectorAll('.filt').forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-secondary');
      });
      if (targetBtn) {
        targetBtn.classList.remove('btn-secondary');
        targetBtn.classList.add('btn-primary', 'active');
        filter = targetBtn.dataset.f;
      }
      renderTasks();
    });
  });

  // Load from Firestore
  try {
    tasks = await TaskService.getByStudent(user.id);
  } catch (err) {
    showToast(t('common.retry', 'Error loading tasks: ') + err.message, 'error');
  }

  renderTasks();
}
