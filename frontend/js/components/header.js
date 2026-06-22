export function createHeader(title, user, notificationCount = 0) {
  const badgeHtml = notificationCount > 0 ? `<span class="notification-badge">${notificationCount > 9 ? '9+' : notificationCount}</span>` : '';
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  return `
    <header class="header">
      <div class="header-leading">
        <button id="sidebar-toggle" class="header-icon-btn" type="button" aria-label="Open navigation" aria-expanded="false">
          <i class="ph ph-list" style="font-size:1.5rem;"></i>
        </button>
        <div>
          <p class="header-kicker">mentor-mentee workspace</p>
          <h2 class="header-title">${title}</h2>
        </div>
      </div>
      <div class="header-actions">
        <button id="theme-toggle" class="theme-toggle-btn" type="button" aria-label="Switch color theme" title="Switch color theme">
          <!-- Sun Icon (visible in light mode) -->
          <i class="ph ph-sun sun-icon" style="font-size:1.5rem; display:none;"></i>
          <!-- Moon Icon (visible in dark mode) -->
          <i class="ph ph-moon moon-icon" style="font-size:1.5rem; display:block;"></i>
        </button>
        <div class="notification-bell">
          <i class="ph ph-bell" style="font-size:1.5rem;"></i>
          ${badgeHtml}
        </div>
        <div class="flex items-center gap-3">
          <div class="avatar avatar-sm">${initial}</div>
          <span class="header-user-name">${user?.name || 'User'}</span>
        </div>
      </div>
    </header>
  `;
}
