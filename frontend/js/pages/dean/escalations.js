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
      ${createSidebar(user.role, '/dean/escalations')}
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
  try {
    issues = await IssueService.getEscalated('DEAN');
  } catch (err) {
    document.getElementById('esc-content').innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error: ${err.message}</h3></div>`;
    return;
  }

  function renderList() {
    const wrap = document.getElementById('esc-content');
    if (!issues.length) {
      wrap.innerHTML = `<div class="empty-state card" style="padding:48px;">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        <h3>No escalations</h3>
        <p>All issues are being resolved at lower levels.</p>
      </div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="section-header" style="margin-bottom:16px;">
        <h2 class="section-title">Escalated Issues</h2>
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
              const issue = issues.find(i => i.id === btn.dataset.id);
              if (btn.dataset.sid) {
                await NotificationService.create({
                  userId: btn.dataset.sid, type:'ISSUE_RESOLVED',
                  title:'Issue Resolved', message:`Your issue has been resolved by the Dean: ${resolution}`, relatedId:btn.dataset.id
                });
              }
              if (issue && issue.mentorId) {
                await NotificationService.create({
                  userId: issue.mentorId, type:'ISSUE_RESOLVED',
                  title:'Issue Resolved', message:`Student issue resolved by the Dean: ${resolution}`, relatedId:btn.dataset.id
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

  }

  renderList();
}
