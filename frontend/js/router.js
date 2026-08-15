import { onAuthChange, getCurrentUser, fetchUserProfile, getUserProfile } from './auth.js';
import { initNotificationListener, stopNotificationListener, renderNotifications } from './notifications.js';
import { openWebIssueModal } from './components/web-issue-modal.js';

const routes = {
  '/landing': './pages/landing.js',
  '/login': './pages/login.js',
  '/register': './pages/register.js',
  '/student/dashboard': './pages/student/dashboard.js',
  '/student/meetings': './pages/student/meetings.js',
  '/student/issues': './pages/student/issues.js',
  '/student/tasks': './pages/student/tasks.js',
  '/student/profile': './pages/student/profile.js',
  '/student/booklet': './pages/student/booklet.js',
  '/chat': './pages/chat.js',
  '/mentor/dashboard': './pages/mentor/dashboard.js',
  '/mentor/students': './pages/mentor/students.js',
  '/mentor/meetings': './pages/mentor/meetings.js',
  '/mentor/issues': './pages/mentor/issues.js',
  '/mentor/notes': './pages/mentor/notes.js',
  '/mentor/reports': './pages/mentor/reports.js',
  '/mentor/booklet': './pages/mentor/booklet.js',
  '/hod/dashboard': './pages/hod/dashboard.js',
  '/hod/management': './pages/hod/management.js',
  '/hod/allocation': './pages/admin/allocation.js',
  '/hod/directory': './pages/admin/users.js',
  '/hod/risk-students': './pages/hod/risk-students.js',
  '/hod/escalations': './pages/hod/escalations.js',
  '/hod/reports': './pages/hod/reports.js',
  '/dean/dashboard': './pages/dean/dashboard.js',
  '/dean/management': './pages/dean/management.js',
  '/dean/analytics': './pages/dean/analytics.js',
  '/dean/escalations': './pages/dean/escalations.js',
  '/dean/reports': './pages/dean/reports.js',
  '/dean/allocation': './pages/admin/allocation.js',
  '/dean/directory': './pages/admin/users.js',
  '/section/dashboard': './pages/section/dashboard.js',
  '/section/escalations': './pages/section/escalations.js',
  '/admin/dashboard': './pages/admin/dashboard.js',
  '/admin/users': './pages/admin/users.js',
  '/admin/departments': './pages/admin/departments.js',
  '/admin/allocation': './pages/admin/allocation.js',
  '/admin/settings': './pages/admin/settings.js',
  '/admin/infrastructure': './pages/admin/infrastructure.js',
  '/meeting-room': './pages/meeting-room.js'
};

const authFreeRoutes = ['/landing', '/login', '/register'];

// Map a Firestore role string to the correct dashboard URL prefix
function getRoleDashboardPath(role) {
  if (!role) return '/login';
  switch (role.toUpperCase()) {
    case 'STUDENT':  return '/student/dashboard';
    case 'FACULTY':
    case 'MENTOR':   return '/mentor/dashboard';
    case 'HOD':      return '/hod/dashboard';
    case 'DEAN':     return '/dean/dashboard';
    case 'SECTION_HEAD': return '/section/dashboard';
    case 'ADMIN':    return '/admin/dashboard';
    default:         return '/student/dashboard';
  }
}

export function navigateTo(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return (window.location.hash.slice(1).split('?')[0] || '/');
}

let currentModule = null;

async function handleRoute() {
  let path = getCurrentRoute();
  
  if (path === '/') {
      // Redirect based on role if logged in, else login
      const user = getCurrentUser();
      if (user) {
          let profile = getUserProfile();
          if(!profile) {
              profile = await fetchUserProfile();
          }
          if(profile && profile.role) {
              path = getRoleDashboardPath(profile.role);
              navigateTo(path);
              return;
          }
      }
      path = '/landing';
      navigateTo(path);
      return;
  }

  const user = getCurrentUser();
  if (!user && !authFreeRoutes.includes(path)) {
    navigateTo('/login');
    return;
  }

  // Ensure profile is loaded before rendering authenticated routes
  const appContainer = document.getElementById('app');
  if (user && !authFreeRoutes.includes(path)) {
    let profile = getUserProfile();
    if (!profile) {
      appContainer.innerHTML = '<div class="loader-overlay" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;"><div class="spinner"></div><p style="margin-top:20px;color:var(--text-muted);font-weight:500;">Verifying your access...</p></div>';
      try {
        profile = await Promise.race([
          fetchUserProfile(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Auth timeout: Connection is slow.')), 15000))
        ]);
      } catch (e) {
        console.error('Profile fetch failed:', e);
        appContainer.innerHTML = `<div class="empty-state h-screen">
          <h2 class="text-danger">Connection Error</h2>
          <p class="text-muted mt-2">${e.message || 'Could not verify your account details. Please check your connection.'}</p>
          <button class="btn btn-primary mt-4" onclick="window.location.reload()">Retry</button>
        </div>`;
        return;
      }
      if (!profile) {
        appContainer.innerHTML = `<div class="empty-state h-screen">
          <h2 class="text-danger">Account Not Found</h2>
          <p class="text-muted mt-2">Your user profile does not exist in the database. Please contact an administrator.</p>
          <button class="btn btn-primary mt-4" onclick="window.localStorage.clear(); window.location.hash = '/login'; window.location.reload();">Sign Out</button>
        </div>`;
        return;
      }
    }

    // Strict Role Route Protection
    const role = String(profile.role).toUpperCase();
    const isGlobalRoute = ['/chat', '/meeting-room'].includes(path);

    // 🔒 Mandatory 50% Booklet Lock for Students: Block all other pages until 50% filled!
    if (role === 'STUDENT') {
      try {
        const { BookletService } = await import('./services.js');
        const { showToast } = await import('./components/toast.js');
        const completionPct = await BookletService.getCompletionPercentage(profile.id || user.uid);
        if (completionPct < 50 && path !== '/student/booklet') {
          showToast(`⚠️ Mandatory Action: You must fill at least 50% of your Mentorship Booklet before accessing other pages (${completionPct}% / 50%).`, 'warning');
          navigateTo('/student/booklet');
          return;
        }
      } catch (err) {
        console.warn('Booklet completion route check warning:', err);
      }
    }

    if (!isGlobalRoute) {
      if (path.startsWith('/student') && role !== 'STUDENT') return navigateTo(getRoleDashboardPath(role));
      if (path.startsWith('/mentor') && path !== '/mentor/booklet' && !['FACULTY', 'MENTOR'].includes(role)) return navigateTo(getRoleDashboardPath(role));
      if (path === '/mentor/booklet' && !['FACULTY', 'MENTOR', 'HOD', 'DEAN', 'ADMIN'].includes(role)) return navigateTo(getRoleDashboardPath(role));
      if (path.startsWith('/hod') && role !== 'HOD') return navigateTo(getRoleDashboardPath(role));
      if (path.startsWith('/dean') && role !== 'DEAN') return navigateTo(getRoleDashboardPath(role));
      if (path.startsWith('/section') && role !== 'SECTION_HEAD') return navigateTo(getRoleDashboardPath(role));
      if (path.startsWith('/admin') && role !== 'ADMIN') return navigateTo(getRoleDashboardPath(role));
    }
  }

  const modulePath = routes[path];

  if (!modulePath) {
    if (currentModule && currentModule.teardown) {
      currentModule.teardown();
      currentModule = null;
    }
    appContainer.innerHTML = `
      <div class="empty-state h-screen">
        <h2>404 - Page Not Found</h2>
        <p class="text-muted mt-2">The page you are looking for does not exist.</p>
        <a class="btn btn-primary mt-4" href="#/">Go Home</a>
      </div>
    `;
    return;
  }

  try {
    if (currentModule && currentModule.teardown) {
      currentModule.teardown();
    }
    appContainer.innerHTML = '<div class="loader-overlay"><div class="spinner"></div></div>';
    const module = await import(`${modulePath}?v=10`);
    currentModule = module;
    if (module.render) {
      await module.render(appContainer);
      updateThemeToggleUI();
      renderNotifications();
    } else {
      throw new Error(`Module ${modulePath} does not export a render function`);
    }
  } catch (error) {
    console.error("Error loading route:", error);
    appContainer.innerHTML = `
      <div class="empty-state h-screen">
        <h2 class="text-danger">Error Loading Page</h2>
        <p class="text-muted mt-2">${error.message || 'Check console for details.'}</p>
        <p class="text-muted mt-2 text-xs">Note: Placeholder routes might not exist yet.</p>
      </div>
    `;
  }
}

// Initialization
window.addEventListener('hashchange', handleRoute);

let isInitialLoad = true;

onAuthChange((user) => {
    if (user) {
        initNotificationListener();
    } else {
        stopNotificationListener();
    }

    if (isInitialLoad) {
        isInitialLoad = false;
        handleRoute();
    } else {
        // Handle auth state changes that might require a redirect
        const path = getCurrentRoute();
        if (!user && !authFreeRoutes.includes(path)) {
            navigateTo('/login');
        } else if (user && ['/login', '/register'].includes(path)) {
            navigateTo('/'); // handleRoute will redirect to appropriate dashboard
        }
    }
});

// Removed fallback timeout as it caused race conditions overriding deep links.

function updateThemeToggleUI(theme) {
    const currentTheme = theme || document.documentElement.getAttribute('data-theme') || 'dark';
    const sunIcons = document.querySelectorAll('.sun-icon');
    const moonIcons = document.querySelectorAll('.moon-icon');
    
    if (currentTheme === 'light') {
        sunIcons.forEach(icon => icon.style.display = 'block');
        moonIcons.forEach(icon => icon.style.display = 'none');
    } else {
        sunIcons.forEach(icon => icon.style.display = 'none');
        moonIcons.forEach(icon => icon.style.display = 'block');
    }
}

// Theme Toggle Click Handler
document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('#theme-toggle');
    if (toggleBtn) {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleUI(newTheme);
    }

    if (e.target.closest('#global-web-issue-btn')) {
        openWebIssueModal();
    }

    if (e.target.closest('#global-header-profile-btn')) {
        const user = getUserProfile();
        if (user) {
            const role = (user.role || 'STUDENT').toUpperCase();
            if (role === 'STUDENT') {
                navigateTo('/student/profile');
            } else {
                import('./components/profile-modal.js')
                    .then(m => m.openProfileModal())
                    .catch(err => console.error('Error opening profile modal:', err));
            }
        }
    }

    if (e.target.closest('#start-tour-btn')) {
        e.preventDefault();
        import('./components/tour.js').then(({ startTour }) => {
            const user = getUserProfile();
            const path = getCurrentRoute();
            const role = (user?.role || 'STUDENT').toUpperCase();

            let tourSteps = [
                { selector: '.sidebar', title: 'Navigation Sidebar', desc: 'Use this sidebar to access your dashboard, student rosters, meetings, booklet, issues, and reports.', position: 'right' },
                { selector: '.header-actions', title: 'Action Bar', desc: 'Access web bug reporting, role guide PDF, interactive tours, dark/light theme, and live notifications.', position: 'bottom' },
                { selector: '.page-content, .main-content', title: 'Workspace View', desc: 'Manage your active records, schedule sessions, view metrics, and track student outcomes.', position: 'top' }
            ];

            if (path.includes('/mentor/dashboard') || (role === 'MENTOR' && path === '/mentor/dashboard')) {
                tourSteps = [
                    { selector: '.sidebar', title: 'Navigation', desc: 'Use this sidebar to view all your students, schedule meetings, and resolve issues.', position: 'right' },
                    { selector: '.stats-grid, .stat-card', title: 'Key Performance Indicators', desc: 'Track your assigned student count, pending meeting requests, high-risk flags, and completed sessions.', position: 'bottom' },
                    { selector: '.card, .data-table', title: 'Assigned Mentees', desc: 'Monitor mentee CGPA, attendance, booklet completion, and risk levels.', position: 'top' },
                    { selector: '.header-actions', title: 'Quick Action Bar', desc: 'Switch theme, download the Mentor Operating Manual, or report web issues.', position: 'bottom' }
                ];
            } else if (path.includes('/student/dashboard')) {
                tourSteps = [
                    { selector: '.sidebar', title: 'Navigation', desc: 'Use this sidebar to access your profile, booklet, book meetings, and raise grievances.', position: 'right' },
                    { selector: '.stats-grid, .stat-card', title: 'Overview Metrics', desc: 'Keep track of upcoming meetings, pending action tasks, open grievances, and CGPA.', position: 'bottom' },
                    { selector: '.header-actions', title: 'Quick Actions', desc: 'Switch themes, download your Student Mentee Guide PDF, or report web issues.', position: 'bottom' }
                ];
            } else if (path.includes('/hod/dashboard')) {
                tourSteps = [
                    { selector: '.sidebar', title: 'HOD Department Controls', desc: 'Oversee department faculty allocations, high-risk students, grievances, and mentorship reports.', position: 'right' },
                    { selector: '.stats-grid, .stat-card', title: 'Department Analytics', desc: 'Monitor total students, active mentors, open issues, and resolved cases.', position: 'bottom' },
                    { selector: '.header-actions', title: 'Quick Action Bar', desc: 'Access the HOD Operations Manual, theme toggle, and live department alerts.', position: 'bottom' }
                ];
            } else if (path.includes('/dean/dashboard')) {
                tourSteps = [
                    { selector: '.sidebar', title: 'Dean Leadership Overview', desc: 'Monitor university-wide mentoring coverage, risk distributions, and institutional reports.', position: 'right' },
                    { selector: '.stats-grid, .stat-card', title: 'Institutional KPIs', desc: 'Track university-wide student rosters, total faculty, active departments, and high-risk totals.', position: 'bottom' },
                    { selector: '.header-actions', title: 'Quick Action Bar', desc: 'Access the Dean Operations Guide, dark/light theme, and platform notifications.', position: 'bottom' }
                ];
            } else if (path.includes('/admin/dashboard') || path.includes('/admin/users')) {
                tourSteps = [
                    { selector: '.sidebar', title: 'Admin Controls', desc: 'Manage system users, departments, classes, automated allocations, and audits.', position: 'right' },
                    { selector: '.stats-grid, .stat-card', title: 'Platform Health Metrics', desc: 'View global student registrations, faculty allocations, and database status.', position: 'bottom' },
                    { selector: '.header-actions', title: 'Quick Action Bar', desc: 'Access the Administrator Operations Manual, color themes, and system alerts.', position: 'bottom' }
                ];
            } else if (path.includes('/meetings')) {
                tourSteps = [
                    { selector: '#btn-schedule-meeting, .page-content', title: 'Schedule & Manage Meetings', desc: 'Schedule mentorship meetings, approve pending requests, and enter meeting notes.', position: 'bottom' },
                    { selector: '.tabs-nav, #tab-bar', title: 'Meeting Filters', desc: 'Filter your meetings by Pending, Approved, Completed, or All.', position: 'bottom' },
                    { selector: '.header-actions', title: 'Action Bar', desc: 'Access your user guide, switch color themes, and view alerts.', position: 'bottom' }
                ];
            }

            startTour(`page_tour_${path.replace(/[^a-zA-Z0-9]/g, '_')}`, tourSteps, true);
        }).catch(err => console.warn('Could not start tour:', err));
    }

    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const menuButton = document.getElementById('sidebar-toggle');
    const isMobile = window.innerWidth <= 768;

    if (e.target.closest('#sidebar-toggle')) {
        if (isMobile) {
            const isOpen = sidebar?.classList.toggle('open') || false;
            backdrop?.classList.toggle('visible', isOpen);
            menuButton?.setAttribute('aria-expanded', String(isOpen));
        } else {
            const isCollapsed = sidebar?.classList.toggle('collapsed') || false;
            menuButton?.setAttribute('aria-expanded', String(!isCollapsed));
        }
    }
    if (e.target.closest('#sidebar-backdrop') || e.target.closest('.sidebar-item')) {
        if (isMobile) {
            sidebar?.classList.remove('open');
            backdrop?.classList.remove('visible');
            menuButton?.setAttribute('aria-expanded', 'false');
        }
    }
});
