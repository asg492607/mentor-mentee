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

    <!-- Change HOD Modal -->
    <div id="change-hod-modal" class="modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);z-index:10000;align-items:center;justify-content:center;padding:16px;">
      <div class="modal card" style="max-width:540px;width:100%;padding:28px;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.35);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;border-bottom:1px solid var(--border);padding-bottom:14px;">
          <div>
            <h3 style="margin:0;font-size:1.15rem;font-weight:700;display:flex;align-items:center;gap:8px;">
              👑 Change Head of Department (HOD)
            </h3>
            <p id="modal-dept-sub" style="margin:4px 0 0 0;font-size:0.825rem;color:var(--text-secondary);">
              Update leadership for department
            </p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-close-hod-modal" style="font-size:1.2rem;padding:4px 8px;">✕</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="background:var(--bg-secondary);padding:14px;border-radius:10px;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
              <span style="color:var(--text-secondary);">Department:</span>
              <strong id="modal-dept-name">—</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
              <span style="color:var(--text-secondary);">Current HOD:</span>
              <strong id="modal-current-hod" style="color:var(--warning);">—</strong>
            </div>
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-weight:600;font-size:0.85rem;">Select Faculty Member to Appoint as HOD</label>
            <select id="modal-new-hod-select" class="form-select" style="width:100%;padding:10px;">
              <option value="">-- Choose from Registered Faculty --</option>
            </select>
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label" style="font-weight:600;font-size:0.85rem;">Or Enter Custom HOD Name</label>
            <input type="text" id="modal-new-hod-custom" class="form-input" placeholder="e.g. Dr. Jane Doe" style="padding:10px;">
          </div>

          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:12px;font-size:0.8rem;color:var(--text-secondary);line-height:1.45;">
            🛡️ <strong>Safe Transition Guarantee:</strong> Changing the HOD updates administrative roles without disrupting any student allocations, active mentorship pairs, or scheduled meetings. The previous HOD will smoothly revert to standard Faculty status.
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;border-top:1px solid var(--border);padding-top:16px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-hod-modal">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-save-new-hod" style="padding:8px 20px;font-weight:600;">
            Save &amp; Update HOD
          </button>
        </div>
      </div>
    </div>
  `;

  let depts = [];
  let students = [];
  let faculty  = [];
  let allClasses = [];

  let activeChangeDeptId = null;
  let activeChangeDeptName = null;
  let activePreviousHodId = null;

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

      // Find current HOD faculty doc if any
      const curHodFaculty = faculty.find(f => f.id === d.hodId || (f.department === d.name && f.role === 'HOD'));

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
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;">
                  <span style="color:var(--text-muted);font-size:0.8rem;">
                    Head: <strong style="color:var(--text-primary);">${escapeHtml(d.hodName || curHodFaculty?.name || 'Unassigned')}</strong>
                  </span>
                  <button class="btn btn-xs btn-secondary btn-open-change-hod" 
                    data-id="${d.id}" 
                    data-dept="${escapeHtml(d.name)}" 
                    data-hodname="${escapeHtml(d.hodName || curHodFaculty?.name || '')}"
                    data-hodid="${curHodFaculty?.id || d.hodId || ''}"
                    style="padding:2px 8px;font-size:0.75rem;border-radius:6px;gap:4px;display:inline-flex;align-items:center;">
                    🔄 Change HOD
                  </button>
                </div>
              </div>
              <button class="btn btn-xs btn-danger del-dept" data-id="${d.id}" title="Delete Department">✕</button>
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

    attachDeptEventListeners();
  }

  function attachDeptEventListeners() {
    // Open Change HOD Modal Listener
    document.querySelectorAll('.btn-open-change-hod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.currentTarget || e.target.closest('.btn-open-change-hod');
        activeChangeDeptId = targetBtn?.dataset?.id;
        activeChangeDeptName = targetBtn?.dataset?.dept;
        const curHodName = targetBtn?.dataset?.hodname || 'Unassigned';
        activePreviousHodId = targetBtn?.dataset?.hodid || null;

        const modal = document.getElementById('change-hod-modal');
        const deptNameEl = document.getElementById('modal-dept-name');
        const deptSubEl = document.getElementById('modal-dept-sub');
        const curHodEl = document.getElementById('modal-current-hod');
        const selEl = document.getElementById('modal-new-hod-select');
        const customInp = document.getElementById('modal-new-hod-custom');

        if (deptNameEl) deptNameEl.textContent = activeChangeDeptName || '—';
        if (deptSubEl) deptSubEl.textContent = `Update leadership for ${activeChangeDeptName}`;
        if (curHodEl) curHodEl.textContent = curHodName || 'Unassigned';
        if (customInp) customInp.value = '';

        // Populate faculty select
        if (selEl) {
          const eligibleFaculty = faculty.filter(f => f.role === 'FACULTY' || f.role === 'MENTOR' || f.role === 'HOD');
          selEl.innerHTML = '<option value="">-- Choose from Registered Faculty --</option>' +
            eligibleFaculty.map(f => {
              const isSameDept = f.department === activeChangeDeptName;
              return `<option value="${f.id}" data-name="${escapeHtml(f.name || '')}">
                ${escapeHtml(f.name || 'Faculty')} (${f.role}) — ${escapeHtml(f.department || 'No Dept')} ${isSameDept ? '⭐' : ''}
              </option>`;
            }).join('');
        }

        if (modal) modal.style.display = 'flex';
      });
    });

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

  // Modal event listeners
  const closeHodModal = () => {
    const modal = document.getElementById('change-hod-modal');
    if (modal) modal.style.display = 'none';
  };

  document.getElementById('btn-close-hod-modal')?.addEventListener('click', closeHodModal);
  document.getElementById('btn-cancel-hod-modal')?.addEventListener('click', closeHodModal);

  document.getElementById('btn-save-new-hod')?.addEventListener('click', async () => {
    const selEl = document.getElementById('modal-new-hod-select');
    const customInp = document.getElementById('modal-new-hod-custom');
    const selectedFacId = selEl?.value || null;
    const selectedFacName = selEl?.selectedOptions?.[0]?.dataset?.name || '';
    const customName = customInp?.value.trim() || '';

    const newHodName = customName || selectedFacName;
    if (!newHodName && !selectedFacId) {
      showToast('Please select a faculty member or enter a name for the new HOD', 'warning');
      return;
    }

    const btn = document.getElementById('btn-save-new-hod');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      await DepartmentService.changeHOD(
        activeChangeDeptId,
        activeChangeDeptName,
        selectedFacId,
        activePreviousHodId,
        newHodName
      );

      showToast(`HOD for "${activeChangeDeptName}" updated to ${newHodName} successfully!`, 'success');
      closeHodModal();
      await loadAll();
      renderDepts();
    } catch (err) {
      console.error('Change HOD error:', err);
      showToast('Failed to update HOD: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save & Update HOD';
    }
  });

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
