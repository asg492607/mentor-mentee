import { t } from '../i18n.js';

export function createSidebar(role, activePath) {
  const roleUpper = role ? role.toUpperCase() : 'STUDENT';
  
  let navItems = [];
  
  if (roleUpper === 'STUDENT') {
    navItems = [
      { path: '/student/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/chat', label: t('nav.messages', 'Messages'), icon: '<i class="ph ph-chat-circle-dots"></i>' },
      { path: '/student/meetings', label: t('nav.meetings', 'Meetings'), icon: '<i class="ph ph-calendar-check"></i>' },
      { path: '/student/issues', label: t('nav.issues', 'Issues'), icon: '<i class="ph ph-warning-circle"></i>' },
      { path: '/student/tasks', label: t('nav.tasks', 'Tasks'), icon: '<i class="ph ph-check-square"></i>' },
      { path: '/student/profile', label: t('nav.profile', 'Profile'), icon: '<i class="ph ph-user"></i>' },
      { path: '/student/booklet', label: t('nav.booklet', 'Mentorship Booklet'), icon: '<i class="ph ph-book-open"></i>' }
    ];
  } else if (roleUpper === 'FACULTY' || roleUpper === 'MENTOR') {
    navItems = [
      { path: '/mentor/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/chat', label: t('nav.messages', 'Messages'), icon: '<i class="ph ph-chat-circle-dots"></i>' },
      { path: '/mentor/students', label: t('nav.my_students', 'My Students'), icon: '<i class="ph ph-users"></i>' },
      { path: '/mentor/meetings', label: t('nav.meetings', 'Meetings'), icon: '<i class="ph ph-calendar-check"></i>' },
      { path: '/mentor/issues', label: t('nav.issues', 'Issues'), icon: '<i class="ph ph-warning-circle"></i>' },
      { path: '/mentor/reports', label: t('nav.reports', 'Reports'), icon: '<i class="ph ph-chart-bar"></i>' },
      { path: '#profile-modal', label: t('nav.profile', 'My Profile'), icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'HOD') {
    navItems = [
      { path: '/hod/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/hod/allocation', label: t('nav.allocation', 'Allocation'), icon: '<i class="ph ph-users-three"></i>' },
      { path: '/hod/management', label: t('nav.management', 'Management'), icon: '<i class="ph ph-briefcase"></i>' },
      { path: '/hod/directory', label: t('nav.users', 'Users'), icon: '<i class="ph ph-users"></i>' },
      { path: '/hod/risk-students', label: t('nav.risk_students', 'Risk Students'), icon: '<i class="ph ph-warning"></i>' },
      { path: '/hod/escalations', label: t('nav.escalations', 'Escalations'), icon: '<i class="ph ph-siren"></i>' },
      { path: '/hod/reports', label: t('nav.reports', 'Mentor Reports'), icon: '<i class="ph ph-chart-bar"></i>' },
      { path: '#profile-modal', label: t('nav.profile', 'My Profile'), icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'DEAN') {
    navItems = [
      { path: '/dean/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/dean/management', label: t('nav.management', 'Management'), icon: '<i class="ph ph-briefcase"></i>' },
      { path: '/dean/directory', label: t('nav.users', 'Users'), icon: '<i class="ph ph-users"></i>' },
      { path: '/dean/analytics', label: t('nav.analytics', 'Analytics'), icon: '<i class="ph ph-chart-line-up"></i>' },
      { path: '/dean/allocation',  label: t('nav.allocation', 'Allocation'),  icon: '<i class="ph ph-users-three"></i>' },
      { path: '/dean/escalations', label: t('nav.escalations', 'Escalations'), icon: '<i class="ph ph-siren"></i>' },
      { path: '/dean/reports', label: t('nav.reports', 'Mentor Reports'), icon: '<i class="ph ph-chart-bar"></i>' },
      { path: '#profile-modal', label: t('nav.profile', 'My Profile'), icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'ADMIN') {
    navItems = [
      { path: '/admin/dashboard',   label: t('nav.dashboard', 'Dashboard'),   icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/admin/compliance',  label: t('nav.compliance', 'Booklet Compliance'), icon: '<i class="ph ph-clipboard-text"></i>' },
      { path: '/admin/users',       label: t('nav.users', 'Users'),   icon: '<i class="ph ph-users"></i>' },
      { path: '/admin/departments', label: t('nav.departments', 'Departments'), icon: '<i class="ph ph-buildings"></i>' },
      { path: '/admin/allocation',  label: t('nav.allocation', 'Allocation'),  icon: '<i class="ph ph-users-three"></i>' },
      { path: '/admin/settings',    label: t('nav.settings', 'Settings'),    icon: '<i class="ph ph-gear"></i>' },
      { path: '/admin/infrastructure', label: t('nav.infrastructure', 'System Intelligence'), icon: '<i class="ph ph-cpu"></i>' },
      { path: '#profile-modal', label: t('nav.profile', 'My Profile'), icon: '<i class="ph ph-user"></i>' }
    ];
  } else if (roleUpper === 'SECTION_HEAD') {
    navItems = [
      { path: '/section/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: '<i class="ph ph-squares-four"></i>' },
      { path: '/section/escalations', label: t('nav.escalations', 'Escalations'), icon: '<i class="ph ph-siren"></i>' },
      { path: '#profile-modal', label: t('nav.profile', 'My Profile'), icon: '<i class="ph ph-user"></i>' }
    ];
  }

  // Add AI Copilot quick trigger
  navItems.push({ path: '#ai-copilot-trigger', label: t('nav.copilot_trigger', 'AI Copilot ✨'), icon: '<i class="ph-bold ph-sparkle" style="color:#c084fc;"></i>' });

  // Always append Landing Page link for quick access
  navItems.push({ path: '/landing', label: t('nav.landing', 'Landing Page'), icon: '<i class="ph ph-house"></i>' });

  const navHtml = navItems.map(item => `
    <a href="${item.path.startsWith('#') ? item.path : '#' + item.path}" class="sidebar-item ${activePath === item.path ? 'active' : ''}">
      ${item.icon}
      ${item.label}
    </a>
  `).join('');

  const portalSubtitle = t(`brand.portal_${roleUpper.toLowerCase()}`, `${roleUpper.toLowerCase()} portal`);

  return `
    <button class="sidebar-backdrop" id="sidebar-backdrop" type="button" aria-label="Close navigation"></button>
    <aside class="sidebar">
      <div class="sidebar-logo">
        <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT University Logo" class="sidebar-logo-img">
        <span>Lumina<small>${portalSubtitle}</small></span>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
        <button id="logout-btn" class="btn btn-ghost w-full" style="justify-content:flex-start;color:var(--danger);width:100%;gap:10px;">
          <i class="ph ph-sign-out" style="font-size: 1.2rem;"></i>
          ${t('nav.logout', 'Logout')}
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
