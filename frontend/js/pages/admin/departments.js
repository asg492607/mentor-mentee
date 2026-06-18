import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { DepartmentService, StudentService, FacultyService } from '/js/services.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/departments')}
      <div class="main-content">
        ${createHeader('Institutions & Departments', user)}
        <div class="page-content">
          <div class="card" style="padding:24px;margin-bottom:20px;">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Add New Institution / Department</h3>
            <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr auto;gap:12px;align-items:end;">
              <div class="form-group" style="margin:0;">
                <label class="form-label">Type</label>
                <select id="d-type" class="form-select">
                  <option value="Department">Department</option>
                  <option value="School">School</option>
                  <option value="College">College</option>
                </select>
              </div>
              <div class="form-group" style="margin:0;"><label class="form-label">Name</label><input type="text" id="d-name" class="form-input" placeholder="Computer Science"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Code</label><input type="text" id="d-code" class="form-input" placeholder="CS"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Head/Dean/HOD Name</label><input type="text" id="d-hod" class="form-input" placeholder="Dr. Name"></div>
              <button class="btn btn-primary" id="btn-add-dept">Add</button>
            </div>
          </div>

          <div id="dept-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
            <div style="grid-column:1/-1;display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let depts = [];
  let students = [];
  let faculty  = [];

  async function loadAll() {
    [depts, students, faculty] = await Promise.all([
      DepartmentService.getAll(),
      StudentService.getAll(),
      FacultyService.getAll()
    ]);
  }

  try { await loadAll(); } catch (err) { showToast('Error loading: ' + err.message, 'error'); return; }

  function renderDepts() {
    const grid = document.getElementById('dept-grid');
    if (!depts.length) {
      grid.innerHTML = `<div class="empty-state card" style="grid-column:1/-1;padding:48px;"><h3>No departments yet</h3><p>Add the first department above.</p></div>`;
      return;
    }

    grid.innerHTML = depts.map(d => {
      const studentCount = students.filter(s => s.department === d.name).length;
      const mentorCount  = faculty.filter(f => f.department === d.name).length;
      return `
        <div class="card" style="padding:24px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span class="badge badge-accent">${d.type||'Department'}</span>
                <span style="background:var(--bg-glass-hover);color:var(--text-secondary);font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;">${d.code||'—'}</span>
              </div>
              <h3 style="font-size:1rem;font-weight:700;margin:0 0 4px 0;">${d.name}</h3>
              <p style="color:var(--text-muted);font-size:0.8rem;">Head: ${d.hodName||'—'}</p>
            </div>
            <button class="btn btn-xs btn-danger del-dept" data-id="${d.id}">✕</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="text-align:center;background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;">
              <p style="font-size:1.4rem;font-weight:700;color:var(--info);">${studentCount}</p>
              <p style="font-size:0.72rem;color:var(--text-muted);">Students</p>
            </div>
            <div style="text-align:center;background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;">
              <p style="font-size:1.4rem;font-weight:700;color:var(--accent);">${mentorCount}</p>
              <p style="font-size:0.72rem;color:var(--text-muted);">Mentors</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.del-dept').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this department? This cannot be undone.')) return;
        try {
          await DepartmentService.delete(btn.dataset.id);
          depts = depts.filter(d => d.id !== btn.dataset.id);
          showToast('Department deleted', 'success');
          renderDepts();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  }

  document.getElementById('btn-add-dept').addEventListener('click', async () => {
    const type    = document.getElementById('d-type').value;
    const name    = document.getElementById('d-name').value.trim();
    const code    = document.getElementById('d-code').value.trim().toUpperCase();
    const hodName = document.getElementById('d-hod').value.trim();
    if (!name || !code) { showToast('Name and code are required', 'warning'); return; }

    const btn = document.getElementById('btn-add-dept');
    btn.disabled = true;
    try {
      const id = await DepartmentService.create({ type, name, code, hodName });
      depts.push({ id, type, name, code, hodName });
      showToast(`${type} added!`, 'success');
      document.getElementById('d-name').value = '';
      document.getElementById('d-code').value = '';
      document.getElementById('d-hod').value  = '';
      renderDepts();
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });

  renderDepts();
}
