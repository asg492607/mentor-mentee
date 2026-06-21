import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { showModal } from '/js/components/modal.js';
import { IssueService, NotificationService } from '/js/services.js';

function fmt(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'; }

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/mentor/issues')}
      <div class="main-content">
        ${createHeader('Student Issues', user)}
        <div class="page-content">
          <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
            <button class="btn btn-primary" id="btn-raise-issue">+ Raise Issue</button>
          </div>
          <div id="esc-content">
            <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let issues = [];
  let students = [];
  try {
    const [all, sList] = await Promise.all([
      IssueService.getByMentor(user.id),
      import('/js/services.js').then(s => s.StudentService.getByMentor(user.id))
    ]);
    issues = all.filter(i => i.escalationLevel === 'MENTOR');
    students = sList;
  } catch (err) {
    (container.querySelector('#esc-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
    return;
  }

  function renderList() {
    const wrap = document.getElementById('esc-content');
    if (!issues.length) {
      wrap.innerHTML = `<div class="empty-state card" style="padding:48px;">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        <h3>No Open Issues</h3>
        <p>Your students have not reported any issues.</p>
      </div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="section-header" style="margin-bottom:16px;">
        <h2 class="section-title">Open Student Issues</h2>
        <span class="badge badge-warning">${issues.filter(e=>e.status!=='RESOLVED').length} Open</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${issues.map(issue => `
          <div class="card" style="padding:20px;border-left:3px solid ${issue.status==='RESOLVED'?'var(--success)':'var(--warning)'};" id="esc-${issue.id}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
              <div style="flex:1;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
                  <h3 style="font-size:0.95rem;font-weight:600;margin:0;">${issue.title}</h3>
                  <span class="badge ${issue.status==='RESOLVED'?'badge-success':'badge-warning'}">${issue.status}</span>
                  ${issue.priority ? `<span class="badge badge-danger">${issue.priority}</span>` : ''}
                </div>
                <p style="color:var(--text-secondary);font-size:0.825rem;margin-bottom:4px;">
                  <strong>Student:</strong> ${issue.studentName||'—'}
                </p>
                <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">${issue.description||''}</p>
                <p style="color:var(--text-muted);font-size:0.75rem;">Raised on ${fmt(issue.createdAt)}</p>
                ${issue.resolution ? `<p style="color:var(--success);margin-top:8px;font-size:0.825rem;"><strong>Resolution:</strong> ${issue.resolution}</p>` : ''}
                ${(issue.escalationHistory||[]).length > 0 ? `
                  <p style="color:var(--text-muted);font-size:0.75rem;margin-top:4px;">
                    Escalated from: ${issue.escalationHistory[issue.escalationHistory.length-1]?.from || 'MENTOR'}
                  </p>
                ` : ''}
              </div>
              ${issue.status !== 'RESOLVED' ? `
                <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
                  <button class="btn btn-sm btn-success res-btn" data-id="${issue.id}" data-sid="${issue.studentId}">✓ Resolve</button>
                  <button class="btn btn-sm btn-danger escalate-btn" data-id="${issue.id}" data-cat="${issue.category}">↑ Escalate</button>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.querySelectorAll('.res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showModal({
          title: 'Resolve issue',
          content: `
            <div class="form-group">
              <label class="form-label">Resolution notes</label>
              <textarea id="resolution-notes" class="form-textarea" style="min-height:120px;" placeholder="Write what was resolved and any follow-up required."></textarea>
            </div>
          `,
          confirmText: 'Resolve',
          onConfirm: async (close) => {
            const resolution = document.getElementById('resolution-notes').value.trim();
            if (!resolution) {
              showToast('Resolution notes are required', 'error');
              return;
            }
            try {
              await IssueService.resolve(btn.dataset.id, resolution);
              if (btn.dataset.sid) {
                await NotificationService.create({
                  userId: btn.dataset.sid, type:'ISSUE_RESOLVED',
                  title:'Issue Resolved', message:`Your issue has been resolved by your Mentor: ${resolution}`, relatedId:btn.dataset.id
                });
              }
              const issue = issues.find(i => i.id === btn.dataset.id);
              issue.status = 'RESOLVED';
              issue.resolution = resolution;
              close();
              showToast('Issue resolved!', 'success');
              renderList();
            } catch (err) { showToast(err.message, 'error'); }
          }
        });
      });
    });

    document.querySelectorAll('.escalate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        const isNonAcademic = ['Travel Section', 'Non-Teaching', 'Non-Academic Section'].includes(cat);
        const escalateTarget = isNonAcademic ? cat : 'HOD';

        showModal({
          title: `Escalate to ${escalateTarget}`,
          content: `
            <div class="form-group">
              <label class="form-label">Escalation reason</label>
              <textarea id="escalate-reason" class="form-textarea" style="min-height:120px;" placeholder="Explain why this issue requires further intervention."></textarea>
            </div>
          `,
          confirmText: 'Escalate',
          onConfirm: async (close) => {
            const reason = document.getElementById('escalate-reason').value.trim();
            if (!reason) { showToast('Escalation reason is required', 'error'); return; }
            try {
              await IssueService.escalate(btn.dataset.id, escalateTarget, reason, user.name);
              showToast(`Escalated to ${escalateTarget}`, 'info');
              issues = issues.filter(i => i.id !== btn.dataset.id);
              close();
              renderList();
            } catch (err) { showToast(err.message, 'error'); }
          }
        });
      });
    });
  }

  renderList();

  // Raise Issue Modal
  const modalHtml = `
    <div id="raise-issue-modal" class="modal-backdrop" style="display:none;z-index:9999;">
      <div class="modal">
        <div class="modal-header">
          <h3>Raise Issue</h3>
          <button class="btn btn-ghost btn-sm" id="close-issue-modal">✕</button>
        </div>
        <div class="modal-body">
          <form id="raise-issue-form">
            <div class="form-group">
              <label class="form-label">Student</label>
              <select id="issue-student" class="form-select" required>
                <option value="">Select Student</option>
                ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="issue-cat" class="form-select" required>
                <option>Academic</option><option>Attendance</option><option>Behavioral</option><option>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select id="issue-pri" class="form-select" required>
                <option>LOW</option><option>MEDIUM</option><option style="color:var(--danger);">HIGH</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Title</label>
              <input type="text" id="issue-title" class="form-input" required placeholder="Short title">
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea id="issue-desc" class="form-textarea" required style="min-height:80px;" placeholder="Details of the issue"></textarea>
            </div>
            <div class="modal-footer mt-4" style="border:none;padding:0;margin-top:24px;justify-content:flex-end;">
              <button type="button" class="btn btn-secondary" id="cancel-issue-modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-issue">Submit Issue</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', modalHtml);

  const issueModal = container.querySelector('#raise-issue-modal');
  container.querySelector('#btn-raise-issue').addEventListener('click', () => {
    issueModal.style.display = 'flex';
  });
  container.querySelector('#close-issue-modal').addEventListener('click', () => issueModal.style.display = 'none');
  container.querySelector('#cancel-issue-modal').addEventListener('click', () => issueModal.style.display = 'none');

  container.querySelector('#raise-issue-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#btn-submit-issue');
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      const sId = container.querySelector('#issue-student').value;
      const student = students.find(s => s.id === sId);
      const newIssueId = await IssueService.create({
        studentId: student.id, studentName: student.name, department: student.department,
        mentorId: user.id,
        title: container.querySelector('#issue-title').value.trim(),
        category: container.querySelector('#issue-cat').value,
        priority: container.querySelector('#issue-pri').value,
        description: container.querySelector('#issue-desc').value.trim()
      });
      showToast('Issue created successfully!', 'success');
      issueModal.style.display = 'none';
      e.target.reset();
      
      // reload issues
      const all = await IssueService.getByMentor(user.id);
      issues = all.filter(i => i.escalationLevel === 'MENTOR');
      renderList();
    } catch(err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Issue';
    }
  });
}

