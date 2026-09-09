import { onAuthChange, getCurrentUser, fetchUserProfile, getUserProfile } from './auth.js';
import { initNotificationListener, stopNotificationListener, renderNotifications } from './notifications.js';
import { openWebIssueModal } from './components/web-issue-modal.js';
import { initAIAssistant, aiAssistantWidget } from './components/ai-assistant-widget.js';
import { onLanguageChange } from './i18n.js';
import { escapeHtml } from './utils.js';

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
  '/admin/compliance': './pages/admin/compliance.js',
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

    // 🔒 Mandatory 25% Booklet Lock for Students: Block all other pages until 25% filled!
    if (role === 'STUDENT') {
      try {
        const { BookletService } = await import('./services.js');
        const { showToast } = await import('./components/toast.js');
        const completionPct = await BookletService.getCompletionPercentage(profile.id || user.uid);
        if (completionPct < 25 && path !== '/student/booklet') {
          showToast(`⚠️ Mandatory Action: You must fill at least 25% of your Mentorship Booklet across all sections before accessing other pages (${completionPct}% / 25%).`, 'warning');
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

  const safeTeardown = () => {
    if (currentModule && typeof currentModule.teardown === 'function') {
      try {
        currentModule.teardown();
      } catch (teardownErr) {
        console.warn('Error during page teardown:', teardownErr);
      }
    }
    currentModule = null;
  };

  if (!modulePath) {
    safeTeardown();
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
    safeTeardown();
    appContainer.innerHTML = '<div class="loader-overlay"><div class="spinner"></div></div>';
    
    // Dynamic import with retry logic for network drops/ERR_CONNECTION_RESET
    let module = null;
    let lastImportError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const cacheBuster = attempt > 1 ? `&_retry=${Date.now()}` : '';
        module = await import(`${modulePath}?v=11${cacheBuster}`);
        break;
      } catch (err) {
        lastImportError = err;
        if (attempt < 3) {
          await new Promise(res => setTimeout(res, 500 * attempt));
        }
      }
    }

    if (!module) {
      throw lastImportError || new Error(`Failed to load module ${modulePath}`);
    }

    currentModule = module;
    if (module.render) {
      await module.render(appContainer);
      renderNotifications();
      if (user && !authFreeRoutes.includes(path)) {
        initAIAssistant();
      } else {
        aiAssistantWidget.unmount();
      }
    } else {
      throw new Error(`Module ${modulePath} does not export a render function`);
    }
  } catch (error) {
    console.error("Error loading route:", error);
    const isNetworkError = !navigator.onLine || 
      /failed to fetch|dynamically imported module|network|load failed/i.test(error.message || '');

    appContainer.innerHTML = `
      <div class="empty-state h-screen" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center;">
        <div style="width:64px; height:64px; border-radius:50%; background:rgba(239,68,68,0.1); color:var(--danger, #ef4444); display:flex; align-items:center; justify-content:center; font-size:2rem; margin-bottom:16px;">
          <i class="ph ${isNetworkError ? 'ph-wifi-slash' : 'ph-warning-circle'}"></i>
        </div>
        <h2 style="font-size:1.4rem; font-weight:700; color:var(--text); margin-bottom:8px;">
          ${isNetworkError ? 'Network Connection Issue' : 'Error Loading Page'}
        </h2>
        <p class="text-muted" style="max-width:440px; margin:0 0 20px; font-size:0.9rem; line-height:1.5;">
          ${isNetworkError 
            ? 'We were unable to download this page module due to a network interruption. Please verify your internet connection and try again.' 
            : escapeHtml(error.message || 'Check console for details.')}
        </p>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-primary" onclick="window.location.reload()" style="display:inline-flex; align-items:center; gap:6px;">
            <i class="ph ph-arrows-clockwise"></i> Reload Page
          </button>
          <a class="btn btn-secondary" href="#/">
            Go Home
          </a>
        </div>
      </div>
    `;
  }
}

// Initialization
window.addEventListener('hashchange', handleRoute);
onLanguageChange(() => {
  handleRoute();
});

let isInitialLoad = true;

onAuthChange((user) => {
    if (user) {
        initNotificationListener();
        initAIAssistant();
    } else {
        stopNotificationListener();
        aiAssistantWidget.unmount();
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

// Global Click Handler
document.addEventListener('click', (e) => {

    if (e.target.closest('#global-ai-copilot-btn')) {
        aiAssistantWidget.toggleWindow();
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

    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const menuButton = document.getElementById('sidebar-toggle');
    const isMobile = window.innerWidth <= 992;

    if (e.target.closest('#sidebar-toggle')) {
        e.preventDefault();
        e.stopPropagation();
        if (isMobile) {
            const isOpen = sidebar?.classList.toggle('open') || false;
            backdrop?.classList.toggle('visible', isOpen);
            document.body.classList.toggle('sidebar-open', isOpen);
            menuButton?.setAttribute('aria-expanded', String(isOpen));
        } else {
            const isCollapsed = sidebar?.classList.toggle('collapsed') || false;
            menuButton?.setAttribute('aria-expanded', String(!isCollapsed));
        }
    }
    
    if (e.target.closest('#sidebar-backdrop') || (isMobile && e.target.closest('.sidebar-item'))) {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('visible');
        document.body.classList.remove('sidebar-open');
        menuButton?.setAttribute('aria-expanded', 'false');
    }
});
