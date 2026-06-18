import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { IssueService } from '/js/services.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      ${createSidebar(user.role, '/section/dashboard')}
      <div class="main-content">
        ${createHeader(`${user.department || 'Section'} Dashboard`, user)}
        <div class="page-content" id="section-dash-content">
          <div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  try {
    const issues = await IssueService.getEscalated(user.department);
    const open = issues.filter(i => i.status !== 'RESOLVED').length;
    const resolved = issues.filter(i => i.status === 'RESOLVED').length;

    document.getElementById('section-dash-content').innerHTML = `
      <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-bottom:24px;">
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--warning)22;">
            <svg viewBox="0 0 24 24" style="fill:var(--warning);width:20px;height:20px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </div>
          <div class="stat-label">Open Issues</div>
          <div class="stat-value">${open}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:var(--success)22;">
            <svg viewBox="0 0 24 24" style="fill:var(--success);width:20px;height:20px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <div class="stat-label">Resolved Issues</div>
          <div class="stat-value">${resolved}</div>
        </div>
      </div>

      <div class="card" style="padding:24px;text-align:center;">
        <h3 style="margin-bottom:12px;">Welcome to the ${user.department || 'Section'} Portal</h3>
        <p style="color:var(--text-secondary);margin-bottom:24px;">Manage issues escalated by Mentors specifically for your department.</p>
        <a class="btn btn-primary" href="#/section/escalations">View Escalations</a>
      </div>
    `;

  } catch (err) {
    document.getElementById('section-dash-content').innerHTML = `<div class="empty-state"><h3 style="color:var(--danger);">Error</h3><p>${err.message}</p></div>`;
  }
}
