import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

const MOCK = [
  { id:'d1', name:'Computer Science',       code:'CS',  hodName:'Dr. Sharma', students:120, mentors:6 },
  { id:'d2', name:'Information Technology', code:'IT',  hodName:'Dr. Patel',  students:100, mentors:5 },
  { id:'d3', name:'Electronics',            code:'EC',  hodName:'Dr. Singh',  students:130, mentors:7 },
  { id:'d4', name:'Mechanical',             code:'ME',  hodName:'Dr. Kumar',  students:130, mentors:6 },
];

export async function render(container) {
  const user = getUserProfile();
  let depts = MOCK;

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/departments')}
      <div class="main-content">
        ${createHeader('Departments', user)}
        <div class="page-content">
          <!-- Add Department -->
          <div class="card" style="padding:24px;margin-bottom:20px;">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Add New Department</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;">
              <div class="form-group" style="margin:0;">
                <label class="form-label">Department Name</label>
                <input type="text" id="d-name" class="form-input" placeholder="e.g. Computer Science">
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label">Code</label>
                <input type="text" id="d-code" class="form-input" placeholder="e.g. CS">
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label">HOD Name</label>
                <input type="text" id="d-hod" class="form-input" placeholder="Dr. Name">
              </div>
              <button class="btn btn-primary" id="btn-add-dept">Add Department</button>
            </div>
          </div>

          <!-- Departments Grid -->
          <div id="dept-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { logout } = await import('/js/auth.js'); await logout();
  });

  try {
    const d = await api.get('/api/admin/departments');
    if (d && d.length) depts = d;
  } catch {}

  function renderDepts() {
    const grid = document.getElementById('dept-grid');
    grid.innerHTML = depts.map(d => `
      <div class="card" style="padding:24px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="background:var(--accent-gradient);color:white;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;">${d.code}</span>
            </div>
            <h3 style="font-size:1rem;font-weight:700;margin:0;">${d.name}</h3>
            <p style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">HOD: ${d.hodName||'—'}</p>
          </div>
          <button class="btn btn-xs btn-danger delete-dept-btn" data-id="${d.id}">✕</button>
        </div>
        <div style="display:flex;gap:16px;">
          <div style="text-align:center;flex:1;background:var(--bg-secondary);border-radius:var(--radius-md);padding:10px;">
            <p style="font-size:1.25rem;font-weight:700;color:var(--info);">${d.students||0}</p>
            <p style="font-size:0.72rem;color:var(--text-muted);">Students</p>
          </div>
          <div style="text-align:center;flex:1;background:var(--bg-secondary);border-radius:var(--radius-md);padding:10px;">
            <p style="font-size:1.25rem;font-weight:700;color:var(--accent);">${d.mentors||0}</p>
            <p style="font-size:0.72rem;color:var(--text-muted);">Mentors</p>
          </div>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.delete-dept-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this department?')) return;
        try { await api.delete(`/api/admin/departments/${btn.dataset.id}`); } catch {}
        depts = depts.filter(d => d.id !== btn.dataset.id);
        showToast('Department deleted', 'success');
        renderDepts();
      });
    });
  }

  document.getElementById('btn-add-dept').addEventListener('click', async () => {
    const name    = document.getElementById('d-name').value.trim();
    const code    = document.getElementById('d-code').value.trim().toUpperCase();
    const hodName = document.getElementById('d-hod').value.trim();
    if (!name || !code) { showToast('Name and code are required', 'warning'); return; }
    const newDept = { id: Date.now().toString(), name, code, hodName, students:0, mentors:0 };
    try {
      const result = await api.post('/api/admin/departments', newDept);
      if (result?.id) newDept.id = result.id;
    } catch {}
    depts.push(newDept);
    showToast('Department added!', 'success');
    document.getElementById('d-name').value = '';
    document.getElementById('d-code').value = '';
    document.getElementById('d-hod').value  = '';
    renderDepts();
  });

  renderDepts();
}
