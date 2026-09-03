import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, IssueService, NotificationService, SettingsService } from '/js/services.js';
import { AIService } from '/js/services/ai-service.js';
import { escapeHtml } from '/js/utils.js';

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
  const issueCategories = await SettingsService.getSections();

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
                <select id="i-cat" class="form-select">${issueCategories.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select id="i-pri" class="form-select"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
              </div>
            </div>
            <div class="form-group">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <label class="form-label" style="margin:0;">Description</label>
                <button type="button" class="btn-ai-sparkle" id="btn-ai-polish-issue" title="Structure and refine your issue with AI">
                  <i class="ph-bold ph-sparkle"></i> ✨ AI Polish Description
                </button>
              </div>
              <textarea id="i-desc" class="form-textarea" rows="4" placeholder="Describe your issue in detail..."></textarea>
            </div>
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
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btn-raise')?.addEventListener('click', toggle);
  document.getElementById('btn-cancel-issue')?.addEventListener('click', toggle);

  document.getElementById('btn-ai-polish-issue')?.addEventListener('click', async () => {
    const title = document.getElementById('i-title')?.value.trim();
    const desc = document.getElementById('i-desc')?.value.trim();
    const category = document.getElementById('i-cat')?.value;
    const priority = document.getElementById('i-pri')?.value;

    if (!title && !desc) {
      showToast('Please enter at least an issue title or rough description first.', 'warning');
      return;
    }

    const aiBtn = document.getElementById('btn-ai-polish-issue');
    if (aiBtn) {
      aiBtn.disabled = true;
      aiBtn.innerHTML = '<div class="spinner spinner-xs" style="width:12px;height:12px;border-width:2px;"></div> Polishing...';
    }

    try {
      const polished = await AIService.polishIssueDescription({
        title: title || 'Academic / Campus Issue',
        description: desc || title,
        category,
        priority
      });
      const descEl = document.getElementById('i-desc');
      if (descEl) {
        descEl.value = polished;
      }
      showToast('✨ Issue description structured and enhanced with AI!', 'success');
    } catch (err) {
      console.error('AI Polish error:', err);
      showToast('Could not polish with AI. Please check your network.', 'error');
    } finally {
      if (aiBtn) {
        aiBtn.disabled = false;
        aiBtn.innerHTML = '<i class="ph-bold ph-sparkle"></i> ✨ AI Polish Description';
      }
    }
  });

  document.getElementById('btn-submit-issue')?.addEventListener('click', async () => {
    const title    = document.getElementById('i-title')?.value.trim();
    const category = document.getElementById('i-cat')?.value;
    const priority = document.getElementById('i-pri')?.value;
    const description = document.getElementById('i-desc')?.value.trim();

    if (!title || !description) { showToast('Please fill in title and description', 'warning'); return; }

    const btn = document.getElementById('btn-submit-issue');
    if (btn) btn.disabled = true;

    try {
      const freshUser = await StudentService.get(user.id);
      if (freshUser) {
        Object.assign(user, freshUser);
        localStorage.setItem('lumina_profile', JSON.stringify(user));
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
      const formEl = document.getElementById('issue-form');
      if (formEl) formEl.style.display = 'none';
      const titleEl = document.getElementById('i-title');
      if (titleEl) titleEl.value = '';
      const descEl = document.getElementById('i-desc');
      if (descEl) descEl.value = '';
      loadIssues();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  async function loadIssues() {
    const wrap = document.getElementById('issues-wrap');
    if (!wrap) return;
    try {
      const rawIssues = await IssueService.getByStudent(user.id);
      const issues = rawIssues.map(i => IssueService.sanitizeForStudent(i));

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
                  <h3 style="font-size:0.9rem;font-weight:600;margin:0;">${escapeHtml(i.title)}</h3>
                  ${statusBadge(i.status)}
                  ${priorityBadge(i.priority)}
                  <span class="badge badge-info">${escapeHtml(i.category)}</span>
                  ${i.escalationLevel ? `<span class="badge badge-muted" title="Currently handled by">@ ${escapeHtml(i.escalationLevel)}</span>` : ''}
                </div>
                <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:6px;">${escapeHtml(i.description)}</p>
                ${i.status === 'ESCALATED' ? `<p style="color:var(--danger);font-size:0.78rem;margin-top:6px;">⚠ Your issue has been escalated to <strong>${escapeHtml(i.escalationLevel || '')}</strong> for further review.</p>` : ''}
                ${i.actionTaken || i.resolution ? `
                  <div style="background:rgba(99,102,241,0.06);border-left:3px solid var(--accent);padding:8px 12px;border-radius:6px;margin-top:8px;font-size:0.825rem;color:var(--text-primary);">
                    <strong>Action Taken &amp; Remedial Measures:</strong> ${escapeHtml(i.actionTaken || i.resolution)}
                  </div>
                ` : ''}
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
