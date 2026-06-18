import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, TaskService } from '/js/services.js';

function statusCls(s) { return {PENDING:'badge-warning',IN_PROGRESS:'badge-info',COMPLETED:'badge-success',OVERDUE:'badge-danger'}[s]||'badge-muted'; }
function fmt(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'; }

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/notes')}
      <div class="main-content">
        ${createHeader('Notes & Action Items', user)}
        <div class="page-content">
          <div class="card" style="padding:24px;margin-bottom:20px;" id="form-card">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Assign New Action Item</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Student</label>
                <select id="ai-student" class="form-select">
                  <option value="">Loading...</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Category</label>
                <select id="ai-cat" class="form-select">
                  <option>Academic</option><option>Career</option><option>Internship</option><option>Personal</option><option>Other</option>
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
            <button class="btn btn-primary" id="btn-create">Assign Action Item</button>
          </div>

          <div id="ai-list">
            <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let students = [];
  let items    = [];

  try {
    [students, items] = await Promise.all([
      StudentService.getByMentor(user.id),
      TaskService.getByMentor(user.id)
    ]);

    const sel = document.getElementById('ai-student');
    sel.innerHTML = `<option value="">Select student</option>` +
      students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  } catch (err) {
    showToast('Error loading data: ' + err.message, 'error');
  }

  document.getElementById('btn-create').addEventListener('click', async () => {
    const studentId   = document.getElementById('ai-student').value;
    const description = document.getElementById('ai-desc').value.trim();
    const dueDate     = document.getElementById('ai-due').value || null;
    const category    = document.getElementById('ai-cat').value;

    if (!studentId || !description) { showToast('Please select student and enter description', 'warning'); return; }

    const btn = document.getElementById('btn-create');
    btn.disabled = true;

    try {
      const student = students.find(s => s.id === studentId);
      const id = await TaskService.create({
        studentId, studentName: student?.name || '',
        mentorId: user.id, mentorName: user.name,
        description, dueDate, category
      });
      items.push({ id, studentId, studentName: student?.name || '', description, dueDate, category, status:'PENDING', progress:0 });
      showToast('Action item assigned!', 'success');
      document.getElementById('ai-desc').value = '';
      renderList();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally { btn.disabled = false; }
  });

  function renderList() {
    const wrap = document.getElementById('ai-list');
    if (!items.length) {
      wrap.innerHTML = `<div class="empty-state card" style="padding:48px;"><h3>No action items</h3><p>Assign tasks to your students above.</p></div>`;
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
          <thead><tr><th>Task</th><th>Category</th><th>Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${grp.items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td><span class="badge badge-info">${item.category}</span></td>
                <td style="font-size:0.8rem;">${fmt(item.dueDate)}</td>
                <td><span class="badge ${statusCls(item.status)}">${item.status.replace('_',' ')}</span></td>
                <td>
                  ${item.status !== 'COMPLETED' ? `<button class="btn btn-xs btn-success mark-done" data-id="${item.id}">Done</button>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    document.querySelectorAll('.mark-done').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await TaskService.markComplete(btn.dataset.id);
          const item = items.find(x => x.id === btn.dataset.id);
          if (item) { item.status = 'COMPLETED'; item.progress = 100; }
          showToast('Marked complete!', 'success');
          renderList();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  }

  renderList();
}
