// HOD � Escalations Page
// Displays issues escalated to the HOD level; allows resolution and escalation to Dean.
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { showModal } from '/js/components/modal.js';
import { IssueService, NotificationService, FacultyService, StudentService } from '/js/services.js';
import { escapeHtml } from '/js/utils.js';

function fmt(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'; }


async function notifyDeans(issueId, title, message) {
  try {
    if (user?.department) {
      students = await StudentService.getByDepartment(user.department).catch(() => []);
    }
    const allFaculty = await FacultyService.getAll();
    const deans = (allFaculty || []).filter(f => (f.role || '').toUpperCase() === 'DEAN');
    for (const dean of deans) {
      const targetUid = dean.id || dean.uid;
      if (targetUid) {
        await NotificationService.create({
          userId: targetUid,
          type: 'ISSUE_ESCALATED',
          title: title,
          message: message,
          relatedId: issueId
        });
      }
    }
  } catch (err) {
    console.warn('[HOD Escalations] Failed to notify Dean(s):', err);
  }
}

function openRaiseIssueModal(user, dept, students, onIssueCreated) {
  const studentsSorted = [...(students || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  showModal({
    title: 'Raise & Escalate Issue',
    size: 'lg',
    content: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">
          Log a student grievance or departmental concern, with the option to immediately escalate it to the Dean for university-level review.
        </p>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">Student (Optional - Select Student or Department-Wide)</label>
          <select id="hod-esc-modal-student" class="form-select">
            <option value="">-- Department-Wide / General Concern (No specific student) --</option>
            ${studentsSorted.map(s => `
              <option value="${s.id}">
                ${escapeHtml(s.name)} ${s.enrollmentNumber ? '(' + escapeHtml(s.enrollmentNumber) + ')' : ''} ${s.class ? '- Class ' + escapeHtml(s.class) : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">Issue Title <span style="color:var(--danger);">*</span></label>
          <input type="text" id="hod-esc-modal-title" class="form-input" placeholder="e.g. Critical attendance penalty appeal / Equipment shortage in IoT lab / Fee barrier">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-weight:600; font-size:0.85rem;">Category</label>
            <select id="hod-esc-modal-cat" class="form-select">
              <option value="Academic">Academic</option>
              <option value="Examination">Examination / Backlog</option>
              <option value="Accounts & Fees">Accounts &amp; Fees</option>
              <option value="Discipline & Conduct">Discipline &amp; Conduct</option>
              <option value="Hostel & Campus">Hostel &amp; Campus</option>
              <option value="Laboratory & Infrastructure">Laboratory &amp; Infrastructure</option>
              <option value="Placements & Internships">Placements &amp; Internships</option>
              <option value="Mentorship & Faculty">Mentorship &amp; Faculty</option>
              <option value="General Grievance">General Grievance</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-weight:600; font-size:0.85rem;">Priority</label>
            <select id="hod-esc-modal-pri" class="form-select">
              <option value="HIGH" selected>High (Urgent Attention)</option>
              <option value="CRITICAL">Critical (Immediate Policy/Administrative Action)</option>
              <option value="MEDIUM">Medium (Standard Review)</option>
              <option value="LOW">Low (Informational)</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0; background:linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.06)); padding:14px; border-radius:12px; border:1px solid rgba(99,102,241,0.25);">
          <label class="form-label" style="font-weight:700; font-size:0.88rem; color:var(--text); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <i class="ph ph-shield-warning" style="color:var(--accent);"></i> Escalation Routing
          </label>
          <div style="display:flex; gap:20px; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; font-weight:600;">
              <input type="radio" name="hod-esc-target-level" value="DEAN" checked id="hod-esc-target-dean">
              🎓 Escalate to Dean Immediately
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; font-weight:600;">
              <input type="radio" name="hod-esc-target-level" value="HOD" id="hod-esc-target-hod">
              🏛️ Retain at Department / HOD Level
            </label>
          </div>
        </div>

        <div class="form-group" id="hod-esc-dean-reason-wrap" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">
            Escalation Reason / Notes for Dean <span style="color:var(--danger);">*</span>
          </label>
          <textarea id="hod-esc-modal-dean-reason" class="form-textarea" style="min-height:80px;" placeholder="Explain why Dean-level review, executive exception, or institutional sanction is necessary..."></textarea>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-weight:600; font-size:0.85rem;">Description &amp; Details <span style="color:var(--danger);">*</span></label>
          <textarea id="hod-esc-modal-desc" class="form-textarea" style="min-height:90px;" placeholder="Provide comprehensive details, background, observations, and expected resolution..."></textarea>
        </div>
      </div>
    `,
    confirmText: 'Submit & Escalate',
    cancelText: 'Cancel',
    onConfirm: async (close) => {
      const title = document.getElementById('hod-esc-modal-title')?.value.trim();
      const desc = document.getElementById('hod-esc-modal-desc')?.value.trim();
      const cat = document.getElementById('hod-esc-modal-cat')?.value || 'General Grievance';
      const pri = document.getElementById('hod-esc-modal-pri')?.value || 'HIGH';
      const studentId = document.getElementById('hod-esc-modal-student')?.value || null;
      const targetLevel = document.querySelector('input[name="hod-esc-target-level"]:checked')?.value || 'DEAN';
      const isDeanEscalation = targetLevel === 'DEAN';
      const deanReason = document.getElementById('hod-esc-modal-dean-reason')?.value.trim();

      if (!title) {
        return showToast('Issue title is required', 'error');
      }
      if (!desc) {
        return showToast('Issue description is required', 'error');
      }
      if (isDeanEscalation && !deanReason) {
        return showToast('Please provide an escalation reason for the Dean', 'error');
      }

      const selectedStudent = studentId ? students.find(s => s.id === studentId) : null;

      const issuePayload = {
        title,
        description: desc,
        category: cat,
        priority: pri,
        department: dept || user.department || '',
        studentId: selectedStudent?.id || null,
        studentName: selectedStudent?.name || (studentId ? 'Department Student' : 'Department Wide'),
        studentEnrollment: selectedStudent?.enrollmentNumber || null,
        mentorId: selectedStudent?.mentorId || null,
        raisedBy: user.id || user.uid,
        raisedByName: user.name,
        raisedByRole: 'HOD',
        status: isDeanEscalation ? 'ESCALATED' : 'OPEN',
        escalationLevel: targetLevel,
        escalationHistory: isDeanEscalation ? [{
          from: 'HOD',
          to: 'DEAN',
          reason: deanReason,
          escalatedBy: user.name,
          byRole: 'HOD',
          at: new Date().toISOString()
        }] : []
      };

      try {
        const newIssueId = await IssueService.create(issuePayload);

        // Notify Dean if escalated
        if (isDeanEscalation) {
          await notifyDeans(
            newIssueId,
            `New Issue Escalated by HOD (${user.department || dept})`,
            `HOD ${user.name} raised and escalated an issue: "${title}". Reason: ${deanReason}`
          );
        }

        // Notify Student if selected
        if (selectedStudent?.id) {
          await NotificationService.create({
            userId: selectedStudent.id,
            type: 'ISSUE_RAISED',
            title: 'Department Issue Logged',
            message: `HOD ${user.name} logged an issue regarding "${title}". ${isDeanEscalation ? 'Escalated to Dean.' : ''}`,
            relatedId: newIssueId
          });
        }

        // Notify Mentor if student has an assigned mentor
        if (selectedStudent?.mentorId) {
          await NotificationService.create({
            userId: selectedStudent.mentorId,
            type: 'ISSUE_RAISED',
            title: `Issue Logged for Mentee (${selectedStudent.name})`,
            message: `HOD logged an issue for your mentee: "${title}". ${isDeanEscalation ? 'Escalated to Dean.' : ''}`,
            relatedId: newIssueId
          });
        }

        showToast(isDeanEscalation ? 'Issue raised and escalated to Dean successfully!' : 'Issue logged successfully!', 'success');
        close();
        if (onIssueCreated) onIssueCreated();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Attach dynamic toggle listeners inside modal
  setTimeout(() => {
    const deanRadio = document.getElementById('hod-esc-target-dean');
    const hodRadio = document.getElementById('hod-esc-target-hod');
    const reasonWrap = document.getElementById('hod-esc-dean-reason-wrap');
    const confirmBtn = document.getElementById('custom-modal-confirm');

    if (deanRadio && hodRadio && reasonWrap) {
      deanRadio.addEventListener('change', () => {
        if (deanRadio.checked) {
          reasonWrap.style.display = 'block';
          if (confirmBtn) confirmBtn.textContent = 'Submit & Escalate';
        }
      });
      hodRadio.addEventListener('change', () => {
        if (hodRadio.checked) {
          reasonWrap.style.display = 'none';
          if (confirmBtn) confirmBtn.textContent = 'Submit Issue';
        }
      });
    }
  }, 50);
}

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/hod/escalations')}
      <div class="main-content">
        ${createHeader('Escalations', user)}
        <div class="page-content">
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
    let hodIssues = [];
    try {
      hodIssues = await IssueService.getEscalated('HOD');
    } catch (e) {
      console.warn('Could not fetch issues escalated to HOD:', e);
    }

    let deptIssues = [];
    if (user?.department) {
      try {
        deptIssues = await IssueService.getByDepartment(user.department);
      } catch (e) {
        console.warn('Could not fetch department issues:', e);
      }
    }

    const extra = (deptIssues || []).filter(i => i.status === 'ESCALATED' && !hodIssues.find(x => x.id === i.id));
    const combined = [...hodIssues, ...extra];

    if (user?.department) {
      const userDept = String(user.department).trim().toLowerCase();
      issues = combined.filter(i => !i.department || String(i.department).trim().toLowerCase() === userDept || i.escalationLevel === 'HOD');
    } else {
      issues = combined;
    }
  } catch (err) {
    (container.querySelector('#esc-content') || {}).innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
    return;
  }

  function renderList() {
    const wrap = document.getElementById('esc-content');
    if (!wrap) return;
    if (!issues.length) {
      wrap.innerHTML = `<div class="empty-state card" style="padding:48px;">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        <h3>No escalations</h3>
        <p>All issues are being resolved at mentor level.</p>
      </div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="section-header" style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 class="section-title" style="margin:0;">Escalated Issues</h2>
          <p style="color:var(--text-muted);font-size:0.8rem;margin:2px 0 0;">Department escalations requiring HOD resolution or escalation to the Dean</p>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-primary" id="btn-hod-esc-raise" style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
            <i class="ph ph-plus-circle"></i> Raise &amp; Escalate Issue
          </button>
          <span class="badge badge-warning">${issues.filter(e=>e.status!=='RESOLVED').length} Open</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${issues.map(issue => `
          <div class="card" style="padding:20px;border-left:3px solid ${issue.status==='RESOLVED'?'var(--success)':'var(--warning)'};" id="esc-${issue.id}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
              <div style="flex:1;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
                  <h3 style="font-size:0.95rem;font-weight:600;margin:0;">${escapeHtml(issue.title)}</h3>
                  <span class="badge ${issue.status==='RESOLVED'?'badge-success':'badge-warning'}">${escapeHtml(issue.status)}</span>
                  ${issue.priority ? `<span class="badge badge-danger">${escapeHtml(issue.priority)}</span>` : ''}
                </div>
                <p style="color:var(--text-secondary);font-size:0.825rem;margin-bottom:4px;">
                  <strong>Student:</strong> ${escapeHtml(issue.studentName||'—')}
                </p>
                <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">${escapeHtml(issue.description||'')}</p>
                <p style="color:var(--text-muted);font-size:0.75rem;">Raised on ${fmt(issue.createdAt)}</p>
                ${issue.resolution ? `<p style="color:var(--success);margin-top:8px;font-size:0.825rem;"><strong>Resolution:</strong> ${escapeHtml(issue.resolution)}</p>` : ''}
                ${(issue.escalationHistory||[]).length > 0 ? `
                  <p style="color:var(--text-muted);font-size:0.75rem;margin-top:4px;">
                    Escalated from: ${escapeHtml(issue.escalationHistory[issue.escalationHistory.length-1]?.from || 'MENTOR')}
                  </p>
                ` : ''}
              </div>
              ${issue.status !== 'RESOLVED' ? `
                ${issue.status !== 'RESOLVED' && issue.escalationLevel !== 'DEAN' ? `
                <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
                  <button class="btn btn-sm btn-success res-btn" data-id="${issue.id}" data-sid="${issue.studentId}">✓ Resolve</button>
                  <button class="btn btn-sm btn-danger dean-btn" data-id="${issue.id}">↗ To Dean</button>
                </div>
              ` : issue.escalationLevel === 'DEAN' && issue.status !== 'RESOLVED' ? `
                <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;align-items:flex-end;">
                  <span class="badge badge-accent" style="display:inline-flex;align-items:center;gap:4px;"><i class="ph ph-shield-check"></i> Escalated to Dean</span>
                  <span style="font-size:0.75rem;color:var(--text-muted);"><i class="ph ph-clock"></i> Awaiting Dean Review</span>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.querySelectorAll('.res-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const issueId = e.currentTarget?.dataset?.id || btn.dataset.id;
        const studentId = e.currentTarget?.dataset?.sid || btn.dataset.sid;
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
            const resolution = document.getElementById('resolution-notes')?.value.trim();
            if (!resolution) {
              showToast('Resolution notes are required', 'error');
              return;
            }
            try {
              await IssueService.resolve(issueId, resolution, 'HOD');
              const issue = issues.find(i => i.id === issueId);
              if (studentId) {
                await NotificationService.create({
                  userId: studentId, type:'ISSUE_RESOLVED',
                  title:'Issue Resolved', message:`Your issue has been resolved by HOD: ${resolution}`, relatedId:issueId
                });
              }
              if (issue && issue.mentorId) {
                await NotificationService.create({
                  userId: issue.mentorId, type:'ISSUE_RESOLVED',
                  title:'Issue Resolved', message:`Student issue resolved by HOD: ${resolution}`, relatedId:issueId
                });
              }
              if (issue) {
                issue.status = 'RESOLVED';
                issue.resolution = resolution;
              }
              close();
              showToast('Issue resolved!', 'success');
              renderList();
            } catch (err) { showToast(err.message, 'error'); }
          }
        });
      });
    });

    document.querySelectorAll('.dean-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const issueId = e.currentTarget?.dataset?.id || btn.dataset.id;
        showModal({
          title: 'Escalate to Dean',
          content: `
            <div class="form-group">
              <label class="form-label">Escalation reason</label>
              <textarea id="dean-reason" class="form-textarea" style="min-height:120px;" placeholder="Explain why this issue requires Dean intervention."></textarea>
            </div>
          `,
          confirmText: 'Escalate',
          onConfirm: async (close) => {
            const reason = document.getElementById('dean-reason')?.value.trim();
            if (!reason) {
              showToast('Escalation reason is required', 'error');
              return;
            }
            try {
              await IssueService.escalate(issueId, 'DEAN', reason, user.name, 'HOD');
              const target = issues.find(i => i.id === issueId);
              if (target) target.escalationLevel = 'DEAN';
              await notifyDeans(
                issueId,
                `Issue Escalated to Dean by HOD (${user.department || ''})`,
                `HOD ${user.name} escalated issue "${target?.title || 'Department Issue'}" to Dean: ${reason}`
              );
              showToast('Escalated to Dean', 'info');
              const target = issues.find(i => i.id === issueId);
              if (target) target.escalationLevel = 'DEAN';
              close();
              renderList();
            } catch (err) { showToast(err.message, 'error'); }
          }
        });
      });
    });
  }

  renderList();
}


