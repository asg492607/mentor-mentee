// Admin — Department Management Page
// Allows the platform admin to create, rename, and delete academic departments.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { DepartmentService, StudentService, FacultyService, ClassService } from '/js/services.js';
import { escapeHtml } from '/js/utils.js';
import { parseImportFile } from '/js/excel-import.js';

const normalizeImportValue = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const structureFields = {
  schoolName: ['school', 'schoolname', 'college', 'collegename'],
  schoolCode: ['schoolcode', 'collegecode'],
  schoolHead: ['schoolhead', 'dean', 'schooldean'],
  departmentName: ['department', 'departmentname', 'dept', 'deptname', 'branch'],
  departmentCode: ['departmentcode', 'deptcode', 'branchcode'],
  departmentHead: ['departmenthead', 'hod', 'hodname'],
  classroom: ['class', 'classroom', 'classname', 'section', 'division'],
  classTeacherEmail: ['classteacheremail', 'teacheremail', 'facultyemail']
};
const structureKey = value => {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.entries(structureFields).find(([, aliases]) => aliases.includes(key))?.[0] || key;
};

function downloadStructureTemplate() {
  const csv = 'schoolName,schoolCode,schoolHead,departmentName,departmentCode,departmentHead,classroom,classTeacherEmail\nSchool of Engineering,SOE,Dean Name,Computer Engineering,CE,Dr. HOD,FY-CE-A,teacher@example.edu\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'university-structure-import-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/admin/departments')}
      <div class="main-content">
        ${createHeader('Institutions & Departments', user)}
        <div class="page-content">
          <div class="card" style="padding:24px;margin-bottom:20px;">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">University structure</h3>
            <p style="font-size:.82rem;color:var(--text-secondary);margin:-8px 0 16px;">Create schools first, then link departments, classrooms, teachers and students to the right school.</p>
            <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr 1fr auto;gap:12px;align-items:end;">
              <div class="form-group" style="margin:0;">
                <label class="form-label">Add</label>
                <select id="d-type" class="form-select">
                  <option value="School">School</option>
                  <option value="Department">Department</option>
                </select>
              </div>
              <div class="form-group" style="margin:0;"><label class="form-label">Name</label><input type="text" id="d-name" class="form-input" placeholder="School of Engineering"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Code</label><input type="text" id="d-code" class="form-input" placeholder="CS"></div>
              <div class="form-group" style="margin:0;display:none;" id="parent-school-group"><label class="form-label">School</label><select id="d-school" class="form-select"><option value="">Select School</option></select></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Head / HOD</label><input type="text" id="d-hod" class="form-input" placeholder="Dr. Name"></div>
              <button class="btn btn-primary" id="btn-add-dept">Add</button>
            </div>
          </div>

          <div class="card" style="padding:22px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:10px;"><div><h3 style="margin:0;">Bulk import university structure</h3><p style="margin:5px 0 0;color:var(--text-secondary);font-size:.84rem;">Build schools, departments, classrooms and optional class-teacher assignments from one CSV or Excel workbook. Existing matching records are reused.</p></div><button id="download-structure-template" class="btn btn-secondary btn-sm">Download template</button></div>
            <p style="margin:0 0 12px;color:var(--text-muted);font-size:.78rem;">Required schoolName and schoolCode for new schools. Add departmentName and departmentCode for departments; classroom and classTeacherEmail are optional. Repeat school/department columns for each classroom row.</p>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><input type="file" id="structure-import-file" accept=".csv,.xlsx,.xls" class="form-input" style="max-width:420px;"><button id="import-structure" class="btn btn-primary" disabled>Import ready rows</button></div>
            <div id="structure-import-preview" style="margin-top:14px;"></div>
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
            <input type="text" id="modal-new-hod-custom" class="form-input" placeholder="Enter HOD name" style="padding:10px;">
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
  let schools = [];
  let students = [];
  let faculty  = [];
  let allClasses = [];

  let activeChangeDeptId = null;
  let activeChangeDeptName = null;
  let activePreviousHodId = null;
  let referencesBackfilled = false;

  async function loadAll() {
    if (!referencesBackfilled) {
      await DepartmentService.backfillReferences();
      referencesBackfilled = true;
    }
    [depts, students, faculty, allClasses] = await Promise.all([
      DepartmentService.getAll(),
      StudentService.getAll(),
      FacultyService.getAll(),
      ClassService.getAll()
    ]);
    schools = depts.filter(item => ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
    renderSchoolOptions();
  }

  try { await loadAll(); } catch (err) { showToast('Error loading: ' + err.message, 'error'); return; }

  // Guard: if the user navigated away while loadAll() was in flight, the DOM is gone
  if (!container.querySelector('#btn-add-dept')) return;

  function renderSchoolOptions() {
    const select = container.querySelector('#d-school');
    if (!select) return;
    select.innerHTML = '<option value="">— Select School —</option>' +
      schools.map(school => `<option value="${escapeHtml(school.id)}">${escapeHtml(school.name)} (${escapeHtml(school.code || 'No code')})</option>`).join('');
    const isDepartment = container.querySelector('#d-type')?.value === 'Department';
    container.querySelector('#parent-school-group').style.display = isDepartment ? 'block' : 'none';
  }

  function renderDepts() {
    const grid = container.querySelector('#dept-grid');
    if (!depts.length) {
      grid.innerHTML = `<div class="empty-state card" style="grid-column:1/-1;padding:48px;"><h3>No schools or departments yet</h3><p>Add a school above to start building the university structure.</p></div>`;
      return;
    }

    const departmentRows = depts.filter(d => !['SCHOOL', 'COLLEGE'].includes(String(d.type || '').toUpperCase()));
    const schoolCards = schools.map(school => {
      const childCount = departmentRows.filter(dept => dept.schoolId === school.id).length;
      const studentCount = students.filter(student => student.schoolId === school.id).length;
      return `<div class="card" style="padding:18px 20px;grid-column:1/-1;border-left:4px solid var(--accent);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div><span class="badge badge-accent">SCHOOL</span><h3 style="margin:8px 0 3px;">${escapeHtml(school.name)}</h3>
          <span style="font-size:.8rem;color:var(--text-secondary);">${escapeHtml(school.code || '—')} · Head: ${escapeHtml(school.hodName || 'Unassigned')} · ${childCount} departments · ${studentCount} students</span></div>
          <div style="display:flex;gap:8px;"><button class="btn btn-sm btn-secondary edit-school" data-id="${escapeHtml(school.id)}">Edit school</button><button class="btn btn-sm btn-danger del-dept" data-id="${escapeHtml(school.id)}">Delete</button></div>
        </div></div>`;
    }).join('');

    grid.innerHTML = `${schoolCards}${departmentRows.map(d => {
      const school = schools.find(item => item.id === d.schoolId);
      const belongs = item => item.departmentId === d.id || (!item.departmentId && item.department === d.name);
      const studentCount = students.filter(belongs).length;
      const mentorCount  = faculty.filter(belongs).length;
      const deptClasses  = allClasses.filter(c => c.departmentId === d.id || (!c.departmentId && c.department === d.name));

      // Find current HOD faculty doc if any
      const curHodFaculty = faculty.find(f => f.id === d.hodId || (f.department === d.name && f.role === 'HOD'));

      return `
        <div class="card" style="padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <span class="badge badge-accent">DEPARTMENT</span>
                  <span style="background:var(--bg-glass-hover);color:var(--text-secondary);font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;">${escapeHtml(d.code||'—')}</span>
                </div>
                <h3 style="font-size:1rem;font-weight:700;margin:0 0 4px 0;">${escapeHtml(d.name)}</h3>
                <div style="font-size:.78rem;color:var(--text-muted);">${escapeHtml(school?.name || d.schoolName || 'School not linked')}</div>
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
                <button class="btn btn-xs btn-secondary edit-dept" data-id="${escapeHtml(d.id)}" style="margin-top:8px;">Edit department</button>
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
                  <span class="badge badge-info" style="display:inline-flex;align-items:center;gap:6px;font-size:0.78rem;padding:5px 8px;">
                    Class ${escapeHtml(c.className)}
                    <select class="class-teacher-select" data-id="${c.id}" aria-label="Class teacher for ${escapeHtml(c.className)}" style="max-width:160px;border:0;background:transparent;color:inherit;font-size:.72rem;">
                      <option value="">No class teacher</option>
                      ${faculty.filter(f => ['FACULTY','MENTOR','CLASS_TEACHER'].includes(String(f.role || '').toUpperCase()) && (f.departmentId ? f.departmentId === d.id : f.department === d.name && (!d.schoolId || !f.schoolId || d.schoolId === f.schoolId))).map(f => `<option value="${escapeHtml(f.id)}" ${c.classTeacherId === f.id ? 'selected' : ''}>${escapeHtml(f.name || 'Faculty')}</option>`).join('')}
                    </select>
                    <button class="btn-edit-class" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.className)}" title="Rename classroom" style="background:none;border:none;color:currentColor;cursor:pointer;padding:0;">✎</button>
                    <button class="btn-del-class" data-id="${c.id}" style="background:none;border:none;color:currentColor;cursor:pointer;opacity:0.7;padding:0;" title="Delete class">✕</button>
                  </span>
                `).join('') : '<span style="font-size:0.75rem;color:var(--text-muted);">No classes defined</span>'}
              </div>
              <div style="display:flex;gap:6px;">
                <input type="text" class="form-input new-dept-class-input" data-dept-id="${escapeHtml(d.id)}" placeholder="e.g. FY CSE A" style="font-size:0.8rem;padding:4px 8px;">
                <button class="btn btn-xs btn-primary btn-add-dept-class" data-dept-id="${escapeHtml(d.id)}">+ Add</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('')}`;

    attachDeptEventListeners();
  }

  function attachDeptEventListeners() {
    document.querySelectorAll('.class-teacher-select').forEach(select => {
      select.addEventListener('change', async event => {
        const target = event.currentTarget;
        try {
          await ClassService.assignTeacher(target.dataset.id, target.value || null);
          const record = allClasses.find(item => item.id === target.dataset.id);
          if (record) record.classTeacherId = target.value || null;
          showToast('Class teacher assignment saved.', 'success');
        } catch (error) {
          showToast('Could not assign class teacher: ' + error.message, 'error');
          renderDepts();
        }
      });
    });

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
          const eligibleFaculty = faculty.filter(f =>
            ['FACULTY', 'MENTOR', 'HOD'].includes(String(f.role || '').toUpperCase()) &&
            (f.departmentId ? f.departmentId === activeChangeDeptId : f.department === activeChangeDeptName && (!depts.find(item => item.id === activeChangeDeptId)?.schoolId || !f.schoolId || depts.find(item => item.id === activeChangeDeptId)?.schoolId === f.schoolId))
          );
          selEl.innerHTML = '<option value="">-- Choose from Registered Faculty --</option>' +
            eligibleFaculty.map(f => {
              return `<option value="${f.id}" data-name="${escapeHtml(f.name || '')}">
                ${escapeHtml(f.name || 'Faculty')} (${f.role}) — ${escapeHtml(f.department || 'No Dept')}
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
        const record = depts.find(item => item.id === id);
        if (!confirm(`Delete ${record?.name || 'this institution'}? This cannot be undone.`)) return;
        try {
          await DepartmentService.delete(id);
          await loadAll();
          showToast('School or department deleted', 'success');
          renderDepts();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    document.querySelectorAll('.edit-school').forEach(btn => btn.addEventListener('click', async () => {
      const school = schools.find(item => item.id === btn.dataset.id);
      if (!school) return;
      const name = prompt('School name', school.name);
      if (name === null || !name.trim()) return;
      const code = prompt('School code', school.code || '');
      if (code === null) return;
      const hodName = prompt('School head / dean', school.hodName || '');
      if (hodName === null) return;
      try {
        await DepartmentService.update(school.id, { name: name.trim(), code: code.trim().toUpperCase(), hodName: hodName.trim() });
        await loadAll(); renderDepts(); showToast('School updated.', 'success');
      } catch (error) { showToast(error.message, 'error'); }
    }));

    document.querySelectorAll('.edit-dept').forEach(btn => btn.addEventListener('click', async () => {
      const dept = depts.find(item => item.id === btn.dataset.id);
      if (!dept) return;
      const name = prompt('Department name', dept.name);
      if (name === null || !name.trim()) return;
      const code = prompt('Department code', dept.code || '');
      if (code === null) return;
      const choices = schools.map((school, index) => `${index + 1}. ${school.name}`).join('\n');
      const currentIndex = Math.max(0, schools.findIndex(school => school.id === dept.schoolId));
      const selected = prompt(`School number for this department:\n${choices}`, String(currentIndex + 1));
      if (selected === null) return;
      const school = schools[Number(selected) - 1];
      if (!school) return showToast('Choose a valid school number.', 'warning');
      try {
        await DepartmentService.update(dept.id, { name: name.trim(), code: code.trim().toUpperCase(), schoolId: school.id, schoolName: school.name, type: 'Department' });
        await loadAll(); renderDepts(); showToast('Department updated.', 'success');
      } catch (error) { showToast(error.message, 'error'); }
    }));

    document.querySelectorAll('.btn-edit-class').forEach(btn => btn.addEventListener('click', async () => {
      const classRecord = allClasses.find(item => item.id === btn.dataset.id);
      if (!classRecord) return;
      const className = prompt('Classroom name', classRecord.className || '');
      if (className === null || !className.trim()) return;
      try {
        await ClassService.update(classRecord.id, { className: className.trim() });
        await loadAll(); renderDepts(); showToast('Classroom updated.', 'success');
      } catch (error) { showToast(error.message, 'error'); }
    }));

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
        const deptId = e.currentTarget?.dataset?.deptId || e.target.closest('.btn-add-dept-class')?.dataset?.deptId;
        const dept = depts.find(item => item.id === deptId);
        if (!dept) return;
        const input = document.querySelector(`.new-dept-class-input[data-dept-id="${CSS.escape(deptId)}"]`);
        const className = input ? input.value.trim() : '';
        if (!className) {
          showToast('Please enter a class name (e.g. TY-CORE-1)', 'warning');
          return;
        }
        btn.disabled = true;
        try {
          const existing = allClasses.filter(c => c.departmentId === deptId || (!c.departmentId && c.department === dept.name));
          if (existing.some(c => (c.className || '').toLowerCase() === className.toLowerCase())) {
            showToast(`Class "${className}" already exists for ${dept.name}`, 'warning');
            btn.disabled = false;
            return;
          }
          const school = schools.find(item => item.id === dept.schoolId);
          await ClassService.create({ department: dept.name, departmentId: dept.id, schoolId: school?.id || dept.schoolId || null, schoolName: school?.name || dept.schoolName || null, className });
          showToast(`Class "${className}" added to ${dept.name}!`, 'success');
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

  container.querySelector('#d-type').addEventListener('change', renderSchoolOptions);
  container.querySelector('#btn-add-dept').addEventListener('click', async () => {
    const type    = container.querySelector('#d-type').value;
    const name    = container.querySelector('#d-name').value.trim();
    const code    = container.querySelector('#d-code').value.trim().toUpperCase();
    const hodName = container.querySelector('#d-hod').value.trim();
    const school = schools.find(item => item.id === container.querySelector('#d-school').value);
    if (!name || !code) { showToast('Name and code are required', 'warning'); return; }
    if (type === 'Department' && !school) { showToast('Select the school that owns this department.', 'warning'); return; }

    const btn = container.querySelector('#btn-add-dept');
    btn.disabled = true;
    try {
      const record = { type, name, code, hodName, ...(type === 'Department' ? { schoolId: school.id, schoolName: school.name } : {}) };
      const id = await DepartmentService.create(record);
      depts.push({ id, ...record });
      schools = depts.filter(item => ['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase()));
      showToast(`${type} added!`, 'success');
      container.querySelector('#d-name').value = '';
      container.querySelector('#d-code').value = '';
      container.querySelector('#d-hod').value  = '';
      container.querySelector('#d-school').value = '';
      renderSchoolOptions();
      renderDepts();
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });

  container.querySelector('#download-structure-template').addEventListener('click', downloadStructureTemplate);
  const structureFile = container.querySelector('#structure-import-file');
  const structurePreview = container.querySelector('#structure-import-preview');
  const structureImport = container.querySelector('#import-structure');
  let structureRows = [];
  let structureImporting = false;
  let structureImportProgress = '';
  const renderStructurePreview = () => {
    const ready = structureRows.filter(row => !row.validationError && !row.imported);
    const skipped = structureRows.filter(row => row.validationError || row.error);
    structureImport.disabled = structureImporting || ready.length === 0;
    structureImport.textContent = structureImporting ? structureImportProgress : ready.length ? `Import ${ready.length} ready row(s)` : 'Import ready rows';
    structurePreview.innerHTML = structureRows.length
      ? `<p style="margin:0 0 8px;font-weight:600;">${ready.length} ready · ${structureRows.filter(row => row.imported).length} imported · ${skipped.length} skipped / failed</p><div style="max-height:340px;overflow:auto;"><table class="data-table"><thead><tr><th>School</th><th>Department</th><th>Classroom</th><th>Class teacher</th><th>Status</th></tr></thead><tbody>${structureRows.slice(0, 300).map(row => `<tr><td>${escapeHtml(row.schoolName || '—')}</td><td>${escapeHtml(row.departmentName || '—')}</td><td>${escapeHtml(row.classroom || '—')}</td><td>${escapeHtml(row.classTeacherEmail || '—')}</td><td><span class="badge ${row.imported ? 'badge-success' : row.validationError || row.error ? 'badge-danger' : 'badge-info'}">${escapeHtml(row.imported ? 'Imported' : row.error || row.validationError || 'Ready')}</span></td></tr>`).join('')}</tbody></table></div>${structureRows.length > 300 ? `<p style="font-size:.75rem;color:var(--text-muted);">Showing first 300 of ${structureRows.length} rows.</p>` : ''}`
      : '';
  };

  structureFile.addEventListener('change', async () => {
    structureRows = [];
    structurePreview.innerHTML = '';
    structureImport.disabled = true;
    const file = structureFile.files?.[0];
    if (!file) return;
    try {
      const matrix = await parseImportFile(file);
      if (matrix.length < 2) throw new Error('The selected file has no structure rows.');
      const headers = matrix[0].map(structureKey);
      if (!headers.includes('schoolName')) throw new Error('The structure file must include a schoolName column.');
      const facultiesByEmail = new Map();
      const schoolCodesInFile = new Map();
      const departmentCodesInFile = new Map();
      faculty.forEach(member => {
        const key = String(member.email || '').trim().toLowerCase();
        if (!key) return;
        const values = facultiesByEmail.get(key) || [];
        values.push(member);
        facultiesByEmail.set(key, values);
      });
      structureRows = matrix.slice(1).map(cells => {
        const row = {};
        headers.forEach((header, index) => { row[header] = String(cells[index] ?? '').trim(); });
        const schoolName = row.schoolName || '';
        const schoolCode = String(row.schoolCode || '').trim().toUpperCase();
        const departmentName = row.departmentName || '';
        const departmentCode = String(row.departmentCode || '').trim().toUpperCase();
        const classroom = row.classroom || '';
        const classTeacherEmail = String(row.classTeacherEmail || '').trim().toLowerCase();
        const school = schools.find(item => normalizeImportValue(item.name) === normalizeImportValue(schoolName));
        const department = departmentName ? depts.find(item => normalizeImportValue(item.name) === normalizeImportValue(departmentName)
          && ((school && item.schoolId === school.id) || (!item.schoolId && normalizeImportValue(item.schoolName) === normalizeImportValue(schoolName)))) : null;
        const teacherMatches = classTeacherEmail ? facultiesByEmail.get(classTeacherEmail) || [] : [];
        let validationError = '';
        const schoolKey = normalizeImportValue(schoolName);
        const departmentKey = `${schoolKey}|${normalizeImportValue(departmentName)}`;
        if (schoolCodesInFile.has(schoolKey) && schoolCode && schoolCodesInFile.get(schoolKey) !== schoolCode) validationError = 'School code conflicts with another row in this file';
        else if (schoolCode) schoolCodesInFile.set(schoolKey, schoolCode);
        if (!validationError && departmentCodesInFile.has(departmentKey) && departmentCode && departmentCodesInFile.get(departmentKey) !== departmentCode) validationError = 'Department code conflicts with another row in this file';
        else if (!validationError && departmentCode) departmentCodesInFile.set(departmentKey, departmentCode);
        if (!validationError && !schoolName) validationError = 'School name is required';
        else if (!validationError && school && schoolCode && school.code && normalizeImportValue(schoolCode) !== normalizeImportValue(school.code)) validationError = 'School code conflicts with the existing record';
        else if (!validationError && !school && !schoolCode) validationError = 'School code is required for a new school';
        else if (!validationError && departmentName && !department && !departmentCode) validationError = 'Department code is required for a new department';
        else if (!validationError && classroom && !departmentName) validationError = 'A classroom must belong to a department';
        else if (!validationError && classTeacherEmail && !classroom) validationError = 'A class teacher requires a classroom';
        else if (!validationError && classTeacherEmail && teacherMatches.length !== 1) validationError = teacherMatches.length ? 'Teacher email is ambiguous' : 'Class teacher email was not found';
        else if (!validationError && classTeacherEmail && !['FACULTY', 'MENTOR', 'CLASS_TEACHER'].includes(String(teacherMatches[0]?.role || '').toUpperCase())) validationError = 'Selected user is not eligible as a class teacher';
        else if (!validationError && department && departmentCode && department.code && normalizeImportValue(departmentCode) !== normalizeImportValue(department.code)) validationError = 'Department code conflicts with the existing record';
        const teacher = teacherMatches[0] || null;
        if (!validationError && teacher) {
          const sameDept = department
            ? (teacher.departmentId ? teacher.departmentId === department.id : normalizeImportValue(teacher.department) === normalizeImportValue(department.name))
            : (!teacher.departmentId && normalizeImportValue(teacher.department) === normalizeImportValue(departmentName));
          const sameSchool = school
            ? (teacher.schoolId ? teacher.schoolId === school.id : !teacher.schoolName || normalizeImportValue(teacher.schoolName) === normalizeImportValue(school.name))
            : (!teacher.schoolId && normalizeImportValue(teacher.schoolName) === normalizeImportValue(schoolName));
          if (!sameDept || !sameSchool) validationError = 'Class teacher must belong to this department and school';
        }
        return {
          schoolName, schoolCode, schoolHead: String(row.schoolHead || '').trim(),
          departmentName, departmentCode, departmentHead: String(row.departmentHead || '').trim(),
          classroom, classTeacherEmail, validationError, error: '', imported: false
        };
      }).filter(row => row.schoolName || row.departmentName || row.classroom || row.classTeacherEmail);
      renderStructurePreview();
    } catch (error) {
      structurePreview.innerHTML = `<p class="text-danger">${escapeHtml(error.message || 'Could not read structure file.')}</p>`;
      showToast(error.message || 'Could not read structure file.', 'error');
    }
  });

  structureImport.addEventListener('click', async () => {
    const ready = structureRows.filter(row => !row.validationError && !row.imported);
    if (!ready.length) return;
    structureImporting = true;
    let imported = 0;
    for (let index = 0; index < ready.length; index++) {
      const row = ready[index];
      row.error = '';
      try {
        let school = schools.find(item => normalizeImportValue(item.name) === normalizeImportValue(row.schoolName));
        if (!school) {
          const record = { type: 'School', name: row.schoolName, code: row.schoolCode, hodName: row.schoolHead };
          const id = await DepartmentService.create(record);
          school = { id, ...record };
          depts.push(school);
          schools.push(school);
        }
        let department = row.departmentName ? depts.find(item => !['SCHOOL', 'COLLEGE'].includes(String(item.type || '').toUpperCase())
          && normalizeImportValue(item.name) === normalizeImportValue(row.departmentName)
          && (item.schoolId === school.id || (!item.schoolId && normalizeImportValue(item.schoolName) === normalizeImportValue(school.name)))) : null;
        if (row.departmentName && !department) {
          const record = { type: 'Department', name: row.departmentName, code: row.departmentCode, hodName: row.departmentHead, schoolId: school.id, schoolName: school.name };
          const id = await DepartmentService.create(record);
          department = { id, ...record };
          depts.push(department);
        }
        if (row.classroom) {
          if (!department) throw new Error('Department was not created or resolved');
          let classroom = allClasses.find(item => (item.departmentId === department.id || (!item.departmentId && normalizeImportValue(item.department) === normalizeImportValue(department.name)))
            && (!item.schoolId || item.schoolId === school.id)
            && (!item.schoolName || normalizeImportValue(item.schoolName) === normalizeImportValue(school.name))
            && normalizeImportValue(item.className) === normalizeImportValue(row.classroom));
          if (!classroom) {
            const record = { department: department.name, departmentId: department.id, schoolId: school.id, schoolName: school.name, className: row.classroom };
            const id = await ClassService.create(record);
            classroom = { id, ...record };
            allClasses.push(classroom);
          }
          if (row.classTeacherEmail) {
            const teacher = faculty.find(item => String(item.email || '').trim().toLowerCase() === row.classTeacherEmail);
            if (!teacher) throw new Error('Class teacher was not found');
            if (classroom.classTeacherId !== teacher.id) {
              await ClassService.assignTeacher(classroom.id, teacher.id);
              classroom.classTeacherId = teacher.id;
            }
          }
        }
        row.imported = true;
        imported++;
      } catch (error) {
        row.error = error.message || 'Could not import this structure row';
      }
      structureImportProgress = `Importing ${index + 1} / ${ready.length}…`;
      renderStructurePreview();
    }
    structureImporting = false;
    structureImportProgress = '';
    renderStructurePreview();
    await loadAll();
    renderDepts();
    showToast(`${imported} structure row(s) imported${ready.length - imported ? `, ${ready.length - imported} failed` : ''}.`, imported ? 'success' : 'error');
  });

  renderDepts();
}

