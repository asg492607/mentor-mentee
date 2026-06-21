import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { StudentService, ClassService, FacultyService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/management')}
      <div class="main-content">
        ${createHeader('Student Management', user)}
        <div class="page-content">
          <div class="card">
            <div class="card-header">
              <h3>Reallocate Students</h3>
              <p style="color:var(--text-secondary);font-size:0.85rem;">Change student classes or reassign mentors.</p>
            </div>
            <div id="mgt-content" style="padding-top:16px;">
              <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const [students, classes, faculty] = await Promise.all([
      StudentService.getByDepartment(user.department),
      ClassService.getByDepartment(user.department),
      FacultyService.getByDepartment(user.department)
    ]);

    const wrap = container.querySelector('#mgt-content');

    if (!students.length) {
      wrap.innerHTML = `<div class="empty-state"><h3>No students found</h3></div>`;
      return;
    }

    const classOpts = `<option value="">Unassigned</option>` + classes.map(c => `<option value="${c.className}">Class ${c.className}</option>`).join('');
    const mentorOpts = `<option value="">Unassigned</option>` + faculty.filter(f => f.role==='FACULTY'||f.role==='MENTOR').map(f => `<option value="${f.id}">${f.name}</option>`).join('');

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Current Class</th>
            <th>Reassign Class</th>
            <th>Current Mentor</th>
            <th>Reassign Mentor</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => {
            const curMentor = faculty.find(f => f.id === s.mentorId);
            return `
            <tr>
              <td>
                <strong>${s.name}</strong><br>
                <span style="font-size:0.75rem;color:var(--text-muted);">${s.enrollmentNumber || 'N/A'} (Yr ${s.year||'?'})</span>
              </td>
              <td>${s.class ? `Class ${s.class}` : '<span class="badge badge-warning">Unassigned</span>'}</td>
              <td>
                <select class="form-select class-select" data-id="${s.id}" style="padding:4px;font-size:0.85rem;">
                  ${classOpts.replace(`value="${s.class||''}"`, `value="${s.class||''}" selected`)}
                </select>
              </td>
              <td>${curMentor ? curMentor.name : '<span class="badge badge-warning">Unassigned</span>'}</td>
              <td>
                <select class="form-select mentor-select" data-id="${s.id}" style="padding:4px;font-size:0.85rem;">
                  ${mentorOpts.replace(`value="${s.mentorId||''}"`, `value="${s.mentorId||''}" selected`)}
                </select>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.class-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newClass = e.target.value || null;
        try {
          await StudentService.update(id, { class: newClass });
          showToast('Class updated successfully', 'success');
        } catch(err) {
          showToast('Error updating class', 'error');
        }
      });
    });

    container.querySelectorAll('.mentor-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newMentor = e.target.value || null;
        try {
          await StudentService.assignMentor(id, newMentor);
          showToast('Mentor updated successfully', 'success');
        } catch(err) {
          showToast('Error updating mentor', 'error');
        }
      });
    });

  } catch (err) {
    const wrap = container.querySelector('#mgt-content');
    if (wrap) wrap.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error</h3><p>${err.message}</p></div>`;
  }
}
