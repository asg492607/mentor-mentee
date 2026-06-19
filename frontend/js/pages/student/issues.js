import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { IssueService, NotificationService } from '/js/services.js';

function statusBadge(s) {
  const cls = {OPEN:'badge-warning',RESOLVED:'badge-success',ESCALATED:'badge-danger',CLOSED:'badge-muted'}[s] || 'badge-muted';
  return `<span class="badge ${cls}">${s}</span>`;
}
function priorityBadge(p) {
  const cls = {LOW:'badge-info',MEDIUM:'badge-warning',HIGH:'badge-danger',CRITICAL:'badge-danger'}[p] || 'badge-muted';
  return `<span class="badge ${cls}">${p}</span>`;
}
function fmt(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—';
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/issues')}
      <div class="main-content">
        ${createHeader('Issues', user)}
        <div class="page-content">
          <div class="section-header">
            <h2 class="section-title">My Issues</h2>
            <button class="btn btn-primary" id="btn-raise">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Raise Issue
            </button>
          </div>

          <div id="issue-form" style="display:none;" class="inline-form mb-6">
            <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">Raise New Issue</h3>
            <div class="form-group"><label class="form-label">Title</label><input type="text" id="i-title" class="form-input" placeholder="Brief title"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Category</label>
                <select id="i-cat" class="form-select"><option>Exam Section</option><option>Student Section</option><option>Academic Section</option><option>Teaching (Mentor-mentee)</option><option>Non-Teaching</option><option>Travel Section</option><option>Non-Academic Section</option></select>
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select id="i-pri" class="form-select"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
              </div>
            </div>
            <div class="form-group"><label class="form-label">Description</label><textarea id="i-desc" class="form-textarea" placeholder="Describe your issue in detail..."></textarea></div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-primary" id="btn-submit-issue">Submit</button>
              <button class="btn btn-secondary" id="btn-cancel-issue">Cancel</button>
            </div>
          </div>

          <div id="issues-wrap">
            <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const toggle = () => {
    const f = document.getElementById('issue-form');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btn-raise').addEventListener('click', toggle);
  document.getElementById('btn-cancel-issue').addEventListener('click', toggle);

  document.getElementById('btn-submit-issue').addEventListener('click', async () => {
    const title    = document.getElementById('i-title').value.trim();
    const category = document.getElementById('i-cat').value;
    const priority = document.getElementById('i-pri').value;
    const description = document.getElementById('i-desc').value.trim();

    if (!title || !description) { showToast('Please fill in title and description', 'warning'); return; }

    const btn = document.getElementById('btn-submit-issue');
    btn.disabled = true;

    try {
      const { StudentService } = await import('/js/services.js');
      const freshUser = await StudentService.get(user.id);
      if (freshUser) {
        Object.assign(user, freshUser);
        localStorage.setItem('mentorOS_profile', JSON.stringify(user));
      }

      const id = await IssueService.create({
        title, category, priority, description,
        studentId: user.id,
        studentName: user.name,
        mentorId: user.mentorId || null,
        department: user.department || null
      });

      if (user.mentorId) {
        await NotificationService.create({
          userId: user.mentorId,
          type: 'ISSUE_RAISED',
          title: 'New Issue Raised',
          message: `${user.name} raised a ${priority} priority issue: ${title}`,
          relatedId: id
        });
      }

      showToast('Issue submitted successfully', 'success');
      document.getElementById('issue-form').style.display = 'none';
      document.getElementById('i-title').value = '';
      document.getElementById('i-desc').value = '';
      loadIssues();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  async function loadIssues() {
    const wrap = document.getElementById('issues-wrap');
    try {
      const issues = await IssueService.getByStudent(user.id);

      if (!issues.length) {
        wrap.innerHTML = `<div class="empty-state card" style="padding:48px;">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          <h3>No issues raised</h3><p>Everything looks good!</p></div>`;
        return;
      }

      wrap.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
        ${issues.map(i => `
          <div class="card" style="padding:20px;border-left:3px solid ${i.status==='OPEN'?'var(--warning)':i.status==='RESOLVED'?'var(--success)':'var(--danger)'};">
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <div style="flex:1;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
                  <h3 style="font-size:0.9rem;font-weight:600;margin:0;">${i.title}</h3>
                  ${statusBadge(i.status)}
                  ${priorityBadge(i.priority)}
                  <span class="badge badge-info">${i.category}</span>
                  ${i.escalationLevel ? `<span class="badge badge-muted" title="Currently handled by">@ ${i.escalationLevel}</span>` : ''}
                </div>
                <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:6px;">${i.description}</p>
                <p style="color:var(--text-muted);font-size:0.75rem;">Raised on ${fmt(i.createdAt)}</p>
                ${i.status === 'ESCALATED' ? `<p style="color:var(--danger);font-size:0.78rem;margin-top:6px;">⚠ Your issue has been escalated to <strong>${i.escalationLevel}</strong> for further review.</p>` : ''}
                ${i.resolution ? `<p style="color:var(--success);font-size:0.825rem;margin-top:8px;"><strong>Resolution:</strong> ${i.resolution}</p>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error loading issues</h3><p>${err.message}</p></div>`;
    }
  }

  loadIssues();
}
