export function createHeader(title, user, notificationCount = 0) {
  const badgeHtml = notificationCount > 0 ? `<span class="notification-badge">${notificationCount > 9 ? '9+' : notificationCount}</span>` : '';
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  return `
    <header class="header">
      <div class="header-leading">
        <button id="sidebar-toggle" class="header-icon-btn mobile-only" type="button" aria-label="Open navigation" aria-expanded="false">
          <svg viewBox="0 0 24 24"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
        </button>
        <div>
          <p class="header-kicker">MentorOS workspace</p>
          <h2 class="header-title">${title}</h2>
        </div>
      </div>
      <div class="header-actions">
        <button id="theme-toggle" class="theme-toggle-btn" type="button" aria-label="Switch color theme" title="Switch color theme">
          <!-- Sun Icon (visible in light mode) -->
          <svg class="sun-icon" viewBox="0 0 24 24" style="width: 20px; height: 20px; display: none; fill: currentColor;"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-.39-1.03 0-1.41s1.03-.39 1.41 0l1.06 1.06c.39.39.39 1.03 0 1.41s-1.03.39-1.41 0l-1.06-1.06zM7.05 18.01c-.39-.39-.39-1.03 0-1.41s1.03-.39 1.41 0l1.06 1.06c.39.39.39 1.03 0 1.41s-1.03.39-1.41 0l-1.06-1.06z"/></svg>
          <!-- Moon Icon (visible in dark mode) -->
          <svg class="moon-icon" viewBox="0 0 24 24" style="width: 20px; height: 20px; display: block; fill: currentColor;"><path d="M12.3 22h-.1c-5.5 0-10-4.5-10-10 0-4.8 3.5-9 8.3-9.9.5-.1.9.3.8.8-.2.9-.3 1.8-.3 2.7 0 5.5 4.5 10 10 10 .9 0 1.8-.1 2.7-.3.5-.1.9.3.8.8-.9 4.8-5.1 8.3-9.9 8.3zm-6-15c-.9 1.5-1.3 3.2-1.3 5 0 4.4 3.6 8 8 8 1.8 0 3.5-.4 5-1.3-1.1-.5-2-1.4-2.6-2.5-.9-1.5-1.4-3.3-1.4-5.2 0-1.9.5-3.7 1.4-5.2-.6-.6-1.3-1.1-2.1-1.4-3.2-1-6.7.7-7 4.2z"/></svg>
        </button>
        <div class="notification-bell">
          <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
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
