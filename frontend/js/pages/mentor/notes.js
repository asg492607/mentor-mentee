import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK_STUDENTS = [
  { id:'s1', name:'Ravi Kumar' },
  { id:'s2', name:'Priya Singh' },
  { id:'s3', name:'Arun Mehta' },
];

const MOCK_ITEMS = [
  { id:'a1', studentId:'s1', studentName:'Ravi Kumar',  description:'Submit mini-project report', dueDate: new Date(Date.now()+86400000*3).toISOString(), status:'PENDING',     category:'Academic' },
  { id:'a2', studentId:'s2', studentName:'Priya Singh', description:'Complete resume draft',      dueDate: new Date(Date.now()+86400000*7).toISOString(), status:'IN_PROGRESS',  category:'Career' },
  { id:'a3', studentId:'s3', studentName:'Arun Mehta',  description:'Attend extra lab sessions',  dueDate: new Date(Date.now()-86400000).toISOString(),   status:'OVERDUE',      category:'Academic' },
];

function statusBadge(s) {
  const map = {PENDING:'badge-warning',IN_PROGRESS:'badge-info',COMPLETED:'badge-success',OVERDUE:'badge-danger'};
  return `<span class="badge ${map[s]||'badge-muted'}">${s.replace('_',' ')}</span>`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—';
}

export async function render(container) {
  const user = getUserProfile();
  let students = MOCK_STUDENTS;
  let items    = MOCK_ITEMS;

  try {
    const [s, a] = await Promise.allSettled([
      api.get('/api/mentor/students'),
      api.get('/api/mentor/action-items')
    ]);
    if (s.status === 'fulfilled') students = s.value;
    if (a.status === 'fulfilled') items    = a.value;
  } catch {}

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/notes')}
      <div class="main-content">
        ${createHeader('Notes & Action Items', user)}
        <div class="page-content">
          <!-- Create New Action Item -->
          <div class="card" style="padding:24px;margin-bottom:20px;">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Assign New Action Item</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Student</label>
                <select id="ai-student" class="form-select">
                  <option value="">Select student</option>
                  ${students.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Category</label>
                <select id="ai-category" class="form-select">
                  <option>Academic</option><option>Career</option><option>Internship</option><option>Personal</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" id="ai-due" class="form-input">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input type="text" id="ai-desc" class="form-input" placeholder="What should the student do?">
            </div>
            <button class="btn btn-primary" id="btn-create-ai">Assign Action Item</button>
          </div>

          <!-- Items by Student -->
          <div id="ai-list"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  document.getElementById('btn-create-ai').addEventListener('click', async () => {
    const studentId   = document.getElementById('ai-student').value;
    const description = document.getElementById('ai-desc').value.trim();
    const dueDate     = document.getElementById('ai-due').value;
    const category    = document.getElementById('ai-category').value;
    if (!studentId || !description) { showToast('Please select student and enter description', 'warning'); return; }

    const student = students.find(s => s.id === studentId);
    const newItem = { id: Date.now().toString(), studentId, studentName: student?.name||'', description, dueDate, category, status:'PENDING' };
    try { await api.post('/api/mentor/action-items', newItem); } catch {}
    items.push(newItem);
    showToast('Action item assigned!', 'success');
    document.getElementById('ai-desc').value = '';
    renderList();
  });

  function renderList() {
    const wrap = document.getElementById('ai-list');
    if (!items.length) {
      wrap.innerHTML = `<div class="empty-state card"><h3>No action items</h3><p>Assign tasks to your students above.</p></div>`;
      return;
    }

    // Group by student
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.studentId]) grouped[item.studentId] = { name: item.studentName, items: [] };
      grouped[item.studentId].items.push(item);
    });

    wrap.innerHTML = Object.entries(grouped).map(([sid, grp]) => `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <h3>${grp.name}</h3>
          <span style="color:var(--text-muted);font-size:0.8rem;">${grp.items.length} item(s)</span>
        </div>
        <table class="data-table">
          <thead><tr><th>Task</th><th>Category</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${grp.items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td><span class="badge badge-info">${item.category}</span></td>
                <td style="font-size:0.8rem;">${fmtDate(item.dueDate)}</td>
                <td>${statusBadge(item.status)}</td>
                <td>
                  ${item.status !== 'COMPLETED' ? `<button class="btn btn-xs btn-success mark-done-btn" data-id="${item.id}">Done</button>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    document.querySelectorAll('.mark-done-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { await api.put(`/api/mentor/action-items/${btn.dataset.id}`, { status:'COMPLETED' }); } catch {}
        const item = items.find(x => x.id === btn.dataset.id);
        if (item) item.status = 'COMPLETED';
        showToast('Marked as complete', 'success');
        renderList();
      });
    });
  }

  renderList();
}
