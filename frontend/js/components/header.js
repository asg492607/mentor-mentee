export function createHeader(title, user, notificationCount = 0) {
  const badgeHtml = notificationCount > 0 ? `<span class="notification-badge">${notificationCount > 9 ? '9+' : notificationCount}</span>` : '';
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  const role = (user?.role || 'STUDENT').toUpperCase();
  const pdfMap = {
    'ADMIN': '/docs/pdf/Lumina_Admin_Guide.pdf',
    'HOD': '/docs/pdf/Lumina_HOD_Guide.pdf',
    'DEAN': '/docs/pdf/Lumina_HOD_Guide.pdf',
    'MENTOR': '/docs/pdf/Lumina_Mentor_Guide.pdf',
    'FACULTY': '/docs/pdf/Lumina_Mentor_Guide.pdf',
    'STUDENT': '/docs/pdf/Lumina_Student_Mentee_Guide.pdf'
  };
  const guidePdf = pdfMap[role] || '/docs/pdf/Lumina_Student_Mentee_Guide.pdf';
  const pdfFileName = guidePdf.split('/').pop();
  const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'dark';
  const isLight = currentTheme === 'light';

  return `
    <header class="header">
      <div class="header-leading">
        <button id="sidebar-toggle" class="header-icon-btn" type="button" aria-label="Open navigation" aria-expanded="false">
          <i class="ph ph-list" style="font-size:1.5rem;"></i>
        </button>
        <div>
          <p class="header-kicker">Lumina workspace</p>
          <h2 class="header-title">${title}</h2>
        </div>
      </div>
      <div class="header-actions">
        <button id="global-web-issue-btn" type="button" class="btn btn-secondary btn-sm" style="gap:6px; font-weight:600; background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.3); display:inline-flex; align-items:center;" title="Report a Web Issue or Bug">
          <i class="ph ph-bug" style="font-size:1.1rem;"></i> Web Issue
        </button>
        <a id="global-pdf-guide-btn" href="${guidePdf}" download="${pdfFileName}" target="_blank" title="Download Role Operating Manual (PDF)" class="header-icon-btn" style="background: rgba(16, 185, 129, 0.12); color: #10b981; text-decoration: none; display: flex; align-items: center; justify-content: center;">
          <i class="ph ph-file-pdf" style="font-size:1.4rem;"></i>
        </a>
        <button id="start-tour-btn" class="header-icon-btn" type="button" aria-label="Take a tour" title="Take an interactive tour of this page" style="background: rgba(99, 102, 241, 0.1); color: var(--accent); cursor: pointer;">
          <i class="ph ph-question" style="font-size:1.5rem;"></i>
        </button>
        <button id="theme-toggle" class="theme-toggle-btn" type="button" aria-label="Switch color theme" title="Switch color theme">
          <!-- Sun Icon (visible in light mode) -->
          <i class="ph ph-sun sun-icon" style="font-size:1.5rem; display:${isLight ? 'block' : 'none'};"></i>
          <!-- Moon Icon (visible in dark mode) -->
          <i class="ph ph-moon moon-icon" style="font-size:1.5rem; display:${isLight ? 'none' : 'block'};"></i>
        </button>
        <div class="notification-bell" id="global-notification-bell">
          <i class="ph ph-bell" style="font-size:1.5rem;"></i>
          <span id="global-notification-badge" class="notification-badge" style="display:none;"></span>
          <div class="notification-dropdown" id="global-notification-dropdown">
            <div class="notification-dropdown-header">
              <h3>Notifications</h3>
              <button id="global-mark-all-read" type="button">Mark all as read</button>
            </div>
            <div class="notification-list" id="global-notification-list">
              <!-- Dynamically populated via app.js -->
            </div>
          </div>
        </div>
        <div class="header-user-profile-btn flex items-center gap-3" id="global-header-profile-btn" style="cursor:pointer;padding:4px 12px 4px 6px;border-radius:24px;background:var(--bg-secondary);border:1px solid var(--border);transition:all 0.2s;user-select:none;" title="Click to view &amp; edit Profile">
          <div class="avatar avatar-sm">${initial}</div>
          <span class="header-user-name" style="font-weight:600;font-size:0.875rem;">${user?.name || 'User'}</span>
          <i class="ph ph-caret-down" style="font-size:0.8rem;color:var(--text-muted);"></i>
        </div>
      </div>
    </header>
  `;
}
