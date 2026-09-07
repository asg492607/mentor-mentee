import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';
import { StudentService, IssueService, NotificationService, SettingsService } from '/js/services.js';
import { AIService } from '/js/services/ai-service.js';
import { escapeHtml } from '/js/utils.js';
import { t, getLanguage } from '/js/i18n.js';

function statusBadge(s) {
  const cls = {
    OPEN: 'badge-warning',
    RESOLVED: 'badge-success',
    ESCALATED: 'badge-danger',
    CLOSED: 'badge-muted'
  }[s] || 'badge-muted';
  const label = t('status.' + String(s).toLowerCase(), s);
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function priorityBadge(p) {
  const cls = {
    LOW: 'badge-info',
    MEDIUM: 'badge-warning',
    HIGH: 'badge-danger',
    CRITICAL: 'badge-danger'
  }[p] || 'badge-muted';
  const label = t('status.' + String(p).toLowerCase(), p);
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function fmt(iso) {
  if (!iso) return '—';
  const lang = getLanguage();
  const locale = lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  try {
    return new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' });
  } catch {
    return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  }
}

export async function render(container) {
  const user = getUserProfile();
  const issueCategories = await SettingsService.getSections().catch(() => ['Academic', 'Accounts', 'Hostel', 'Exam Cell', 'Transport', 'Library', 'Discipline']);

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/student/issues')}
      <div class="main-content">
        ${createHeader(t('issues.title', 'Grievance & Issue Escalation'), user)}
        <div class="page-content">
          
          <!-- Section Header with Raise Issue CTA -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
            <div>
              <h2 class="section-title" style="margin-bottom:4px;">${t('issues.title', 'My Issues')}</h2>
              <p style="color:var(--text-secondary);font-size:0.85rem;margin:0;">
                ${t('issues.subtitle', 'Transparent 4-tier student dispute and grievance resolution')}
              </p>
            </div>
            <button class="btn btn-primary" id="btn-raise" style="display:inline-flex;align-items:center;gap:8px;border-radius:12px;font-weight:700;padding:10px 20px;box-shadow:0 4px 14px rgba(108,71,255,0.3);">
              <i class="ph ph-plus-circle" style="font-size:1.1rem;"></i>
              ${t('issues.btn_raise', 'Raise New Issue')}
            </button>
          </div>

          <!-- Raise Issue Form Card -->
          <div id="issue-form" style="display:none;margin-bottom:28px;" class="card inline-form">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--border);">
              <h3 style="font-size:1.05rem;font-weight:700;margin:0;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                <i class="ph ph-warning-circle" style="color:var(--accent);"></i> ${t('issues.form_title', 'Raise a New Issue')}
              </h3>
              <button type="button" class="btn btn-xs btn-ghost" id="btn-close-form" style="font-size:1rem;color:var(--text-muted);">✕</button>
            </div>

            <div class="form-group">
              <label class="form-label">${t('issues.form_title_label', 'Title')}</label>
              <input type="text" id="i-title" class="form-input" placeholder="${t('issues.form_title_placeholder', 'Brief summary of the issue')}">
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
              <div class="form-group">
                <label class="form-label">${t('issues.form_category', 'Category')}</label>
                <select id="i-cat" class="form-select">
                  ${issueCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">${t('issues.form_priority', 'Priority')}</label>
                <select id="i-pri" class="form-select">
                  <option value="LOW">${t('status.low', 'LOW')}</option>
                  <option value="MEDIUM" selected>${t('status.medium', 'MEDIUM')}</option>
                  <option value="HIGH">${t('status.high', 'HIGH')}</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <label class="form-label" style="margin:0;">${t('issues.form_desc', 'Detailed Description')}</label>
                <button type="button" class="btn-ai-sparkle" id="btn-ai-polish-issue" title="Structure and refine your issue with AI" style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;padding:4px 10px;border-radius:12px;background:rgba(108,71,255,0.12);color:var(--accent);border:1px solid rgba(108,71,255,0.25);cursor:pointer;">
                  <i class="ph ph-sparkle"></i> ${t('issues.ai_polish', '✨ AI Polish Description')}
                </button>
              </div>
              <textarea id="i-desc" class="form-textarea" rows="4" placeholder="${t('issues.form_desc_placeholder', 'Describe your issue in detail...')}"></textarea>
            </div>

            <div style="display:flex;gap:12px;margin-top:16px;">
              <button class="btn btn-primary" id="btn-submit-issue" style="padding:10px 24px;border-radius:10px;font-weight:600;">
                ${t('common.submit', 'Submit')}
              </button>
              <button class="btn btn-secondary" id="btn-cancel-issue" style="padding:10px 20px;border-radius:10px;">
                ${t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>

          <!-- Status Filter Tabs -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;" id="issue-filters">
            <button class="btn btn-sm btn-primary ifilt active" data-filter="ALL">${t('common.all', 'All')}</button>
            <button class="btn btn-sm btn-secondary ifilt" data-filter="OPEN">${t('status.open', 'Open')}</button>
            <button class="btn btn-sm btn-secondary ifilt" data-filter="ESCALATED">${t('status.high', 'Escalated')}</button>
            <button class="btn btn-sm btn-secondary ifilt" data-filter="RESOLVED">${t('status.resolved', 'Resolved')}</button>
          </div>

          <!-- Issues List Container -->
          <div id="issues-wrap">
            <div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>
          </div>

        </div>
      </div>
    </div>
  `;

  const toggle = () => {
    const f = document.getElementById('issue-form');
    if (f) {
      const isHidden = f.style.display === 'none';
      f.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        document.getElementById('i-title')?.focus();
      }
    }
  };

  document.getElementById('btn-raise')?.addEventListener('click', toggle);
  document.getElementById('btn-cancel-issue')?.addEventListener('click', toggle);
  document.getElementById('btn-close-form')?.addEventListener('click', toggle);

  // AI Polish Button
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
      aiBtn.innerHTML = '<div class="spinner spinner-xs" style="width:12px;height:12px;border-width:2px;display:inline-block;"></div> Polishing...';
    }

    try {
      const polished = await AIService.polishIssueDescription({
        title: title || 'Academic / Campus Issue',
        description: desc || title,
        category,
        priority
      });
      const descEl = document.getElementById('i-desc');
      if (descEl) descEl.value = polished;
      showToast('✨ Issue description structured and enhanced with AI!', 'success');
    } catch (err) {
      console.error('AI Polish error:', err);
      showToast('Could not polish with AI. Please check your network.', 'error');
    } finally {
      if (aiBtn) {
        aiBtn.disabled = false;
        aiBtn.innerHTML = `<i class="ph ph-sparkle"></i> ${t('issues.ai_polish', '✨ AI Polish Description')}`;
      }
    }
  });

  // Submit Issue
  document.getElementById('btn-submit-issue')?.addEventListener('click', async () => {
    const title = document.getElementById('i-title')?.value.trim();
    const category = document.getElementById('i-cat')?.value;
    const priority = document.getElementById('i-pri')?.value;
    const description = document.getElementById('i-desc')?.value.trim();

    if (!title || !description) {
      showToast('Please fill in title and description', 'warning');
      return;
    }

    const btn = document.getElementById('btn-submit-issue');
    if (btn) btn.disabled = true;

    try {
      const freshUser = await StudentService.get(user.id).catch(() => null);
      if (freshUser) {
        Object.assign(user, freshUser);
        localStorage.setItem('lumina_profile', JSON.stringify(user));
      }

      const id = await IssueService.create({
        title,
        category,
        priority,
        description,
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
        }).catch(() => null);
      }

      showToast(t('issues.toast_submitted', 'Issue submitted successfully and routed to mentor!'), 'success');
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

  let allIssues = [];
  let currentFilter = 'ALL';

  async function loadIssues() {
    const wrap = document.getElementById('issues-wrap');
    if (!wrap) return;
    try {
      const rawIssues = await IssueService.getByStudent(user.id);
      allIssues = (rawIssues || []).map(i => IssueService.sanitizeForStudent(i));
      renderIssueList();
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state card" style="padding:32px;"><h3 style="color:var(--danger);">${t('common.retry', 'Error loading issues')}</h3><p>${err.message}</p></div>`;
    }
  }

  function renderIssueList() {
    const wrap = document.getElementById('issues-wrap');
    if (!wrap) return;

    let list = allIssues;
    if (currentFilter !== 'ALL') {
      list = allIssues.filter(i => i.status === currentFilter);
    }

    if (!list.length) {
      wrap.innerHTML = `
        <div class="empty-state card" style="padding:54px 24px;text-align:center;">
          <div style="width:64px;height:64px;border-radius:20px;background:rgba(16,185,129,0.1);color:#10b981;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:16px;">
            <i class="ph ph-shield-check"></i>
          </div>
          <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:6px;color:var(--text-primary);">${t('issues.empty_title', 'No issues reported')}</h3>
          <p style="color:var(--text-secondary);font-size:0.88rem;max-width:480px;margin:0 auto;line-height:1.6;">
            ${t('issues.empty_desc', 'If you face academic, infrastructural, or hostel concerns, raise a ticket here for prompt escalation.')}
          </p>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${list.map(i => `
          <div class="card" style="padding:22px;border-left:4px solid ${i.status==='OPEN'?'#f59e0b':i.status==='RESOLVED'?'#10b981':'#ef4444'};transition:transform 0.2s ease;">
            <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;">
              <div style="flex:1;min-width:260px;">
                
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">
                  <h3 style="font-size:1rem;font-weight:700;margin:0;color:var(--text-primary);">${escapeHtml(i.title)}</h3>
                  ${statusBadge(i.status)}
                  ${priorityBadge(i.priority)}
                  <span class="badge badge-info">${escapeHtml(i.category)}</span>
                  ${i.escalationLevel ? `<span class="badge badge-accent" title="Current Escalation Level"><i class="ph ph-arrow-up-right"></i> ${escapeHtml(i.escalationLevel)}</span>` : ''}
                </div>

                <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.6;margin-bottom:12px;">${escapeHtml(i.description)}</p>

                <!-- 4-Tier Escalation Indicator -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:10px;">
                  <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:6px;">
                    ${t('issues.escalation_path', '4-Tier Escalation Path')}
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;flex-wrap:wrap;">
                    <span style="font-weight:${!i.escalationLevel || i.escalationLevel === 'MENTOR' ? '700;color:var(--accent);' : '500;color:var(--text-muted);'}">
                      ① ${t('issues.tier_mentor', 'Faculty Mentor')}
                    </span>
                    <span style="color:var(--text-muted);">→</span>
                    <span style="font-weight:${i.escalationLevel === 'SECTION_HEAD' ? '700;color:var(--accent);' : '500;color:var(--text-muted);'}">
                      ② ${t('issues.tier_section', 'Section Head')}
                    </span>
                    <span style="color:var(--text-muted);">→</span>
                    <span style="font-weight:${i.escalationLevel === 'HOD' ? '700;color:var(--accent);' : '500;color:var(--text-muted);'}">
                      ③ ${t('issues.tier_hod', 'HOD')}
                    </span>
                    <span style="color:var(--text-muted);">→</span>
                    <span style="font-weight:${i.escalationLevel === 'DEAN' ? '700;color:var(--accent);' : '500;color:var(--text-muted);'}">
                      ④ ${t('issues.tier_dean', 'Dean / Apex Body')}
                    </span>
                  </div>
                </div>

                ${i.actionTaken || i.resolution ? `
                  <div style="background:rgba(16,185,129,0.08);border-left:3px solid #10b981;padding:10px 14px;border-radius:8px;font-size:0.84rem;color:var(--text-primary);">
                    <strong style="color:#10b981;">Remedial Measures &amp; Resolution:</strong> ${escapeHtml(i.actionTaken || i.resolution)}
                  </div>
                ` : ''}

              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Filter Buttons
  container.querySelectorAll('.ifilt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget || e.target.closest('.ifilt');
      container.querySelectorAll('.ifilt').forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-secondary');
      });
      if (target) {
        target.classList.remove('btn-secondary');
        target.classList.add('btn-primary', 'active');
        currentFilter = target.dataset.filter;
      }
      renderIssueList();
    });
  });

  loadIssues();
}
