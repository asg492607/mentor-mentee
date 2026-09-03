export function createSidebar(role, activePath) {
  const roleUpper = role ? role.toUpperCase() : 'STUDENT';
  
  let navItems = [];
  
  if (roleUpper === 'STUDENT') {
    navItems = [
      { path: '/student/dashboard', label: 'Dashboard', icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/chat', label: 'Messages', icon: '<i class="ph ph-chat-circle-dots"></i>' },
      { path: '/student/meetings', label: 'Meetings', icon: '<i class="ph ph-calendar-check"></i>' },
      { path: '/student/issues', label: 'Issues', icon: '<i class="ph ph-warning-circle"></i>' },
      { path: '/student/tasks', label: 'Tasks', icon: '<i class="ph ph-check-square"></i>' },
      { path: '/student/profile', label: 'Profile', icon: '<i class="ph ph-user"></i>' },
      { path: '/student/booklet', label: 'Mentorship Booklet', icon: '<i class="ph ph-book-open"></i>' }
    ];
  } else if (roleUpper === 'FACULTY' || roleUpper === 'MENTOR') {
    navItems = [
      { path: '/mentor/dashboard', label: 'Dashboard', icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/chat', label: 'Messages', icon: '<i class="ph ph-chat-circle-dots"></i>' },
      { path: '/mentor/students', label: 'My Students', icon: '<i class="ph ph-users"></i>' },
      { path: '/mentor/meetings', label: 'Meetings', icon: '<i class="ph ph-calendar-check"></i>' },
      { path: '/mentor/issues', label: 'Issues', icon: '<i class="ph ph-warning-circle"></i>' },
      { path: '/mentor/reports', label: 'Reports', icon: '<i class="ph ph-chart-bar"></i>' },
      { path: '#profile-modal', label: 'My Profile', icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'HOD') {
    navItems = [
      { path: '/hod/dashboard', label: 'Dashboard', icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/hod/allocation', label: 'Allocation', icon: '<i class="ph ph-users-three"></i>' },
      { path: '/hod/management', label: 'Management', icon: '<i class="ph ph-briefcase"></i>' },
      { path: '/hod/directory', label: 'Users', icon: '<i class="ph ph-users"></i>' },
      { path: '/hod/risk-students', label: 'Risk Students', icon: '<i class="ph ph-warning"></i>' },
      { path: '/hod/escalations', label: 'Escalations', icon: '<i class="ph ph-siren"></i>' },
      { path: '/hod/reports', label: 'Mentor Reports', icon: '<i class="ph ph-chart-bar"></i>' },
      { path: '#profile-modal', label: 'My Profile', icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'DEAN') {
    navItems = [
      { path: '/dean/dashboard', label: 'Dashboard', icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/dean/management', label: 'Management', icon: '<i class="ph ph-briefcase"></i>' },
      { path: '/dean/directory', label: 'Users', icon: '<i class="ph ph-users"></i>' },
      { path: '/dean/analytics', label: 'Analytics', icon: '<i class="ph ph-chart-line-up"></i>' },
      { path: '/dean/allocation',  label: 'Allocation',  icon: '<i class="ph ph-users-three"></i>' },
      { path: '/dean/escalations', label: 'Escalations', icon: '<i class="ph ph-siren"></i>' },
      { path: '/dean/reports', label: 'Mentor Reports', icon: '<i class="ph ph-chart-bar"></i>' },
      { path: '#profile-modal', label: 'My Profile', icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'ADMIN') {
    navItems = [
      { path: '/admin/dashboard',   label: 'Dashboard',   icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/admin/compliance',  label: 'Booklet Compliance', icon: '<i class="ph ph-clipboard-text"></i>' },
      { path: '/admin/users',       label: 'Users',   icon: '<i class="ph ph-users"></i>' },
      { path: '/admin/departments', label: 'Departments', icon: '<i class="ph ph-buildings"></i>' },
      { path: '/admin/allocation',  label: 'Allocation',  icon: '<i class="ph ph-users-three"></i>' },
      { path: '/admin/settings',    label: 'Settings',    icon: '<i class="ph ph-gear"></i>' },
      { path: '/admin/infrastructure', label: 'System Intelligence', icon: '<i class="ph ph-cpu"></i>' },
      { path: '#profile-modal', label: 'My Profile', icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'SECTION_HEAD') {
    navItems = [
      { path: '/section/dashboard', label: 'Dashboard', icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/section/escalations', label: 'Escalations', icon: '<i class="ph ph-siren"></i>' },
      { path: '#profile-modal', label: 'My Profile', icon: '<i class="ph ph-user"></i>' }
    ];
  }

  // Add AI Copilot quick trigger
  navItems.push({ path: '#ai-copilot-trigger', label: 'AI Copilot ✨', icon: '<i class="ph-bold ph-sparkle" style="color:#c084fc;"></i>' });

  // Always append Landing Page link for quick access
  navItems.push({ path: '/landing', label: 'Landing Page', icon: '<i class="ph ph-house"></i>' });

  const navHtml = navItems.map(item => `
    <a href="${item.path.startsWith('#') ? item.path : '#' + item.path}" class="sidebar-item ${activePath === item.path ? 'active' : ''}">
      ${item.icon}
      ${item.label}
    </a>
  `).join('');

  // Global event delegation is set up at the module level below

  return `
    <button class="sidebar-backdrop" id="sidebar-backdrop" type="button" aria-label="Close navigation"></button>
    <aside class="sidebar">
      <div class="sidebar-logo">
        <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT University Logo" class="sidebar-logo-img">
        <span>Lumina<small>${roleUpper.toLowerCase()} portal</small></span>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
        <button id="logout-btn" class="btn btn-ghost w-full" style="justify-content:flex-start;color:var(--danger);width:100%;gap:10px;">
          <i class="ph ph-sign-out" style="font-size: 1.2rem;"></i>
          Logout
        </button>
      </div>
    </aside>
  `;
}

// Global Event Delegation for Sidebar Actions
document.body.addEventListener('click', async (e) => {
  // Handle Logout
  const logoutBtn = e.target.closest('#logout-btn');
  if (logoutBtn) {
    try {
      const { logout } = await import('/js/auth.js');
      await logout();
    } catch (err) {
      window.location.hash = '/login';
    }
    return;
  }

  // Handle AI Copilot click from sidebar
  const aiCopilotItem = e.target.closest('a[href="#ai-copilot-trigger"]');
  if (aiCopilotItem) {
    e.preventDefault();
    try {
      const { aiAssistantWidget } = await import('/js/components/ai-assistant-widget.js');
      aiAssistantWidget.toggleWindow(true);
    } catch (err) {
      console.error('Failed to open AI Copilot:', err);
    }
    return;
  }

  // Handle My Profile modal click from sidebar
  const profileItem = e.target.closest('a[href="#profile-modal"]');
  if (profileItem) {
    e.preventDefault();
    try {
      const { openProfileModal } = await import('/js/components/profile-modal.js');
      openProfileModal();
    } catch (err) {
      console.error('Failed to open profile modal:', err);
    }
    return;
  }
  
  // Handle Mobile Backdrop & Navigation Item Close
  if (e.target.id === 'sidebar-backdrop' || (e.target.closest('.sidebar-item') && window.innerWidth <= 992)) {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
  }
});
