import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { DepartmentService, FacultyService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/management')}
      <div class="main-content">
        ${createHeader('Institution Management', user)}
        <div class="page-content">
          <div class="card">
            <div class="card-header">
              <h3>Departments & Sections</h3>
              <p style="color:var(--text-secondary);font-size:0.85rem;">Manage all departments and their HODs.</p>
            </div>
            <div id="dept-content" style="padding-top:16px;">
              <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const [departments, faculty] = await Promise.all([
      DepartmentService.getAll(),
      FacultyService.getAll()
    ]);

    const wrap = document.getElementById('dept-content');

    if (!departments.length) {
      wrap.innerHTML = `<div class="empty-state"><h3>No departments found</h3></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Head of Department</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${departments.map(d => {
            const possibleHeads = faculty.filter(f => f.department === d.name);
            const curHead = faculty.find(f => f.department === d.name && (f.role === 'HOD' || f.role === 'SECTION_HEAD'));
            const opts = '<option value="">Select Head</option>' + possibleHeads.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
            
            return `
            <tr>
              <td><strong>${d.name}</strong></td>
              <td><span class="badge ${d.type==='Section'?'badge-warning':'badge-info'}">${d.type}</span></td>
              <td>
                <select class="form-select head-select" data-dept="${d.name}" style="padding:4px;font-size:0.85rem;">
                  ${opts.replace(`value="${curHead?.id||''}"`, `value="${curHead?.id||''}" selected`)}
                </select>
                ${!curHead ? '<br><span style="color:var(--danger);font-size:0.75rem;">No HOD Assigned</span>' : ''}
              </td>
              <td>
                <button class="btn btn-sm btn-danger btn-del" data-id="${d.id}">Delete</button>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('.head-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const deptName = e.target.dataset.dept;
        const newHeadId = e.target.value;
        const oldHead = faculty.find(f => f.department === deptName && (f.role === 'HOD' || f.role === 'SECTION_HEAD'));
        
        if(!confirm('Are you sure you want to reassign the department head?')) {
          e.target.value = oldHead ? oldHead.id : '';
          return;
        }

        try {
          if (oldHead && oldHead.id !== newHeadId) {
            // Demote old head to Faculty
            await FacultyService.update(oldHead.id, { role: 'FACULTY' });
          }
          if (newHeadId) {
            // Promote new head
            const newHead = faculty.find(f => f.id === newHeadId);
            const newRole = departments.find(d => d.name === deptName).type === 'Section' ? 'SECTION_HEAD' : 'HOD';
            await FacultyService.update(newHeadId, { role: newRole });
          }
          showToast('Department Head updated successfully', 'success');
          render(container); // reload
        } catch(err) {
          showToast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if(!confirm('Are you sure you want to delete this department? All associated classes will remain orphaned.')) return;
        try {
          await DepartmentService.delete(e.target.dataset.id);
          showToast('Department deleted', 'success');
          render(container); // reload
        } catch(err) {
          showToast(err.message, 'error');
        }
      });
    });

  } catch (err) {
    document.getElementById('dept-content').innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error</h3><p>${err.message}</p></div>`;
  }
}
