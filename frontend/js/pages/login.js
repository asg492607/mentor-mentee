import { login } from '../auth.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  container.innerHTML = `
    <div class="h-screen flex items-center justify-center relative overflow-hidden" style="background: var(--bg-primary);">
      <!-- Decorative background elements -->
      <div class="absolute" style="top: -10%; left: -5%; width: 40vw; height: 40vw; background: var(--accent); opacity: 0.05; filter: blur(100px); border-radius: 50%;"></div>
      <div class="absolute" style="bottom: -10%; right: -5%; width: 30vw; height: 30vw; background: var(--info); opacity: 0.05; filter: blur(100px); border-radius: 50%;"></div>
      
      <div class="card card-glass animate-scale-in" style="width: 100%; max-width: 420px; padding: 40px; z-index: 10;">
        <div class="text-center mb-8">
          <h1 class="text-gradient mb-2" style="font-size: 2.5rem; letter-spacing: -1px;">MentorOS</h1>
          <p class="text-secondary">Empowering Student Success</p>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="email" class="form-input" placeholder="student@university.edu" required>
          </div>
          
          <div class="form-group mb-6">
            <label class="form-label">Password</label>
            <input type="password" id="password" class="form-input" placeholder="••••••••" required>
          </div>

          <button type="submit" class="btn btn-primary w-full btn-lg" id="login-btn">
            Sign In
          </button>
        </form>

        <div class="text-center mt-6">
          <p class="text-muted text-sm">Don't have an account? <a href="#/register">Register here</a></p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      loginBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      loginBtn.disabled = true;

      const profile = await login(email, password);
      
      showToast('Login successful!', 'success');
      
      // Redirect based on role — FACULTY maps to /mentor/dashboard
      const rolePathMap = {
        STUDENT: '/student/dashboard',
        FACULTY: '/mentor/dashboard',
        MENTOR:  '/mentor/dashboard',
        HOD:     '/hod/dashboard',
        DEAN:    '/dean/dashboard',
        ADMIN:   '/admin/dashboard'
      };
      if (profile && profile.role) {
          navigateTo(rolePathMap[profile.role.toUpperCase()] || '/student/dashboard');
      } else {
          // Default fallback
          navigateTo('/student/dashboard');
      }
      
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Invalid email or password', 'error');
      loginBtn.innerHTML = 'Sign In';
      loginBtn.disabled = false;
    }
  });
}
