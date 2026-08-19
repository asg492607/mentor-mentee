import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { DepartmentService, StudentService, FacultyService, ClassService } from '/js/services.js';
import { escapeHtml } from '/js/utils.js';

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

          <div id="dept-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
            <div style="grid-column:1/-1;display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let depts = [];
  let students = [];
  let faculty  = [];
  let allClasses = [];

  async function loadAll() {
    [depts, students, faculty, allClasses] = await Promise.all([
      DepartmentService.getAll(),
      StudentService.getAll(),
      FacultyService.getAll(),
      ClassService.getAll()
    ]);
  }

  try { await loadAll(); } catch (err) { showToast('Error loading: ' + err.message, 'error'); return; }

  // Guard: if the user navigated away while loadAll() was in flight, the DOM is gone
  if (!container.querySelector('#btn-add-dept')) return;

  function renderDepts() {
    const grid = container.querySelector('#dept-grid');
    if (!depts.length) {
      grid.innerHTML = `<div class="empty-state card" style="grid-column:1/-1;padding:48px;"><h3>No departments yet</h3><p>Add the first department above.</p></div>`;
      return;
    }

    grid.innerHTML = depts.map(d => {
      const studentCount = students.filter(s => s.department === d.name).length;
      const mentorCount  = faculty.filter(f => f.department === d.name).length;
      const deptClasses  = allClasses.filter(c => c.department === d.name);

      return `
        <div class="card" style="padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <span class="badge badge-accent">${escapeHtml(d.type||'Department')}</span>
                  <span style="background:var(--bg-glass-hover);color:var(--text-secondary);font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;">${escapeHtml(d.code||'—')}</span>
                </div>
                <h3 style="font-size:1rem;font-weight:700;margin:0 0 4px 0;">${escapeHtml(d.name)}</h3>
                <p style="color:var(--text-muted);font-size:0.8rem;">Head: ${escapeHtml(d.hodName||'—')}</p>
              </div>
              <button class="btn btn-xs btn-danger del-dept" data-id="${d.id}">✕</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
              <div style="text-align:center;background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;">
                <p style="font-size:1.4rem;font-weight:700;color:var(--info);">${studentCount}</p>
                <p style="font-size:0.72rem;color:var(--text-muted);">Students</p>
              </div>
              <div style="text-align:center;background:var(--bg-secondary);border-radius:var(--radius-md);padding:12px;">
                <p style="font-size:1.4rem;font-weight:700;color:var(--accent);">${mentorCount}</p>
                <p style="font-size:0.72rem;color:var(--text-muted);">Mentors</p>
              </div>
            </div>

            <!-- Classes section -->
            <div style="border-top:1px solid var(--border-color);padding-top:12px;margin-top:12px;">
              <label style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:8px;">Classes (${deptClasses.length})</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
                ${deptClasses.length ? deptClasses.map(c => `
                  <span class="badge badge-info" style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;padding:4px 8px;">
                    Class ${escapeHtml(c.className)}
                    <button class="btn-del-class" data-id="${c.id}" style="background:none;border:none;color:currentColor;cursor:pointer;opacity:0.7;padding:0;" title="Delete class">✕</button>
                  </span>
                `).join('') : '<span style="font-size:0.75rem;color:var(--text-muted);">No classes defined</span>'}
              </div>
              <div style="display:flex;gap:6px;">
                <input type="text" class="form-input new-dept-class-input" data-dept="${escapeHtml(d.name)}" placeholder="e.g. TY-CORE-1" style="font-size:0.8rem;padding:4px 8px;">
                <button class="btn btn-xs btn-primary btn-add-dept-class" data-dept="${escapeHtml(d.name)}">+ Add</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.del-dept').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const targetBtn = e.currentTarget || e.target.closest('.del-dept');
        const id = targetBtn?.dataset?.id;
        if (!id) return;
        if (!confirm('Delete this department? This cannot be undone.')) return;
        try {
          await DepartmentService.delete(id);
          depts = depts.filter(d => d.id !== id);
          showToast('Department deleted', 'success');
          renderDepts();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    document.querySelectorAll('.btn-del-class').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const targetBtn = e.currentTarget || e.target.closest('.btn-del-class');
        const id = targetBtn?.dataset?.id;
        if (!id) return;
        if (!confirm('Delete this class?')) return;
        try {
          await ClassService.delete(id);
          showToast('Class deleted', 'success');
          await loadAll();
          renderDepts();
        } catch(err) {
          showToast('Error deleting class: ' + err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.btn-add-dept-class').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const deptName = e.currentTarget?.dataset?.dept || e.target.closest('.btn-add-dept-class')?.dataset?.dept;
        if (!deptName) return;
        const input = document.querySelector(`.new-dept-class-input[data-dept="${CSS.escape(deptName)}"]`);
        const className = input ? input.value.trim() : '';
        if (!className) {
          showToast('Please enter a class name (e.g. TY-CORE-1)', 'warning');
          return;
        }
        btn.disabled = true;
        try {
          const existing = allClasses.filter(c => c.department === deptName);
          if (existing.some(c => (c.className || '').toLowerCase() === className.toLowerCase())) {
            showToast(`Class "${className}" already exists for ${deptName}`, 'warning');
            btn.disabled = false;
            return;
          }
          await ClassService.create({ department: deptName, className });
          showToast(`Class "${className}" added to ${deptName}!`, 'success');
          await loadAll();
          renderDepts();
        } catch(err) {
          showToast('Error adding class: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  container.querySelector('#btn-add-dept').addEventListener('click', async () => {
    const type    = container.querySelector('#d-type').value;
    const name    = container.querySelector('#d-name').value.trim();
    const code    = container.querySelector('#d-code').value.trim().toUpperCase();
    const hodName = container.querySelector('#d-hod').value.trim();
    if (!name || !code) { showToast('Name and code are required', 'warning'); return; }

    const btn = container.querySelector('#btn-add-dept');
    btn.disabled = true;
    try {
      const id = await DepartmentService.create({ type, name, code, hodName });
      depts.push({ id, type, name, code, hodName });
      showToast(`${type} added!`, 'success');
      container.querySelector('#d-name').value = '';
      container.querySelector('#d-code').value = '';
      container.querySelector('#d-hod').value  = '';
      renderDepts();
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });

  renderDepts();
}
