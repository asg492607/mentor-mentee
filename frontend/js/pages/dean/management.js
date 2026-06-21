import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { DepartmentService, FacultyService, SettingsService } from '/js/services.js';
import { showToast } from '/js/components/toast.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/dean/management')}
      <div class="main-content">
        ${createHeader('Institution Management', user)}
        <div class="page-content">
          <div style="display:grid;grid-template-columns:1fr;gap:20px;">
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
          
          <div class="card">
            <div class="card-header">
              <h3>Manage Issue Sections</h3>
              <p style="color:var(--text-secondary);font-size:0.85rem;">Add or remove sections available for students and mentors to raise issues against.</p>
            </div>
            <div style="padding:16px;">
              <div id="sections-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
                <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
              </div>
              <div style="display:flex;gap:8px;max-width:400px;">
                <input type="text" id="new-section-name" class="form-input" placeholder="New Section Name" style="flex:1;">
                <button class="btn btn-primary" id="btn-add-section">Add Section</button>
              </div>
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
            const reqRole = d.type === 'Section' ? 'SECTION_HEAD' : 'HOD';
            const possibleHeads = faculty.filter(f => f.role === reqRole && (f.department === d.name || !f.department));
            const curHead = faculty.find(f => f.department === d.name && f.role === reqRole);
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
            await FacultyService.update(newHeadId, { role: newRole, department: deptName });
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

    // Sections management
    let sections = [];
    async function loadSections() {
      try {
        sections = await SettingsService.getSections();
        renderSections();
      } catch(err) {
        document.getElementById('sections-list').innerHTML = '<p class="text-danger">Failed to load sections</p>';
      }
    }

    function renderSections() {
      const list = document.getElementById('sections-list');
      if (!list) return;
      list.innerHTML = sections.map((sec, i) => `
        <span class="badge badge-info" style="display:flex;align-items:center;gap:6px;font-size:0.85rem;padding:6px 12px;">
          ${sec}
          <button class="btn-del-section" data-idx="${i}" style="background:none;border:none;color:currentColor;cursor:pointer;opacity:0.7;padding:0;">✕</button>
        </span>
      `).join('');

      list.querySelectorAll('.btn-del-section').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if(!confirm('Delete this section?')) return;
          const idx = parseInt(e.currentTarget.dataset.idx);
          const removed = sections.splice(idx, 1);
          renderSections();
          try {
            await SettingsService.updateSections(sections);
            showToast('Section deleted', 'success');
          } catch(err) {
            sections.splice(idx, 0, removed[0]); // revert
            renderSections();
            showToast('Error deleting section', 'error');
          }
        });
      });
    }

    const btnAddSec = document.getElementById('btn-add-section');
    if (btnAddSec) {
      btnAddSec.addEventListener('click', async () => {
        const input = document.getElementById('new-section-name');
        const name = input.value.trim();
        if (!name) return;
        if (sections.includes(name)) {
          showToast('Section already exists', 'warning');
          return;
        }
        btnAddSec.disabled = true;
        sections.push(name);
        renderSections();
        try {
          await SettingsService.updateSections(sections);
          showToast('Section added', 'success');
          input.value = '';
        } catch(err) {
          sections.pop(); // revert
          renderSections();
          showToast('Error adding section', 'error');
        } finally {
          btnAddSec.disabled = false;
        }
      });
    }

    loadSections();

  } catch (err) {
    (container.querySelector('#dept-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error</h3><p>${err.message}</p></div>`;
  }
}

