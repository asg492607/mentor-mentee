import { login, forgotPassword } from '../auth.js';
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
          <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT University" style="height: 60px; width: auto; max-width: 240px; margin: 0 auto 16px; display: block; object-fit: contain; background: white; padding: 6px 12px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.1);">
          <h1 class="text-gradient mb-2" style="font-size: 2.2rem; letter-spacing: -1px;">Lumina</h1>
          <p class="text-secondary">Empowering Student Success</p>
        </div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="email" class="form-input" placeholder="student@university.edu" required>
          </div>
          
          <div class="form-group mb-2">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="form-label" style="margin:0;">Password</label>
              <button type="button" id="btn-forgot-password" class="text-sm" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:500;padding:0;">Forgot Password?</button>
            </div>
            <input type="password" id="password" class="form-input" placeholder="••••••••" required>
          </div>

          <button type="submit" class="btn btn-primary w-full btn-lg mt-6" id="login-btn">
            Sign In
          </button>
        </form>

        <div class="text-center mt-6">
          <p class="text-muted text-sm">Contact Administrator for login credentials.</p>
        </div>
      </div>

      <!-- Forgot Password Modal -->
      <div id="forgot-password-modal" class="modal-backdrop" style="display:none;z-index:9999;">
        <div class="modal" style="max-width:400px;padding:28px;">
          <div class="modal-header" style="margin-bottom:16px;">
            <h3>Reset Password</h3>
            <button class="btn btn-ghost btn-sm" id="close-forgot-modal">✕</button>
          </div>
          <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:20px;line-height:1.5;">
            Enter your registered email address and we will send you a link to reset your password.
          </p>
          <form id="forgot-password-form">
            <div class="form-group mb-4">
              <label class="form-label">Email Address</label>
              <input type="email" id="forgot-email" class="form-input" placeholder="user@university.edu" required>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-forgot-modal">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="btn-send-reset">Send Reset Link</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const forgotModal = document.getElementById('forgot-password-modal');
  const btnForgot = document.getElementById('btn-forgot-password');
  const closeForgot = document.getElementById('close-forgot-modal');
  const cancelForgot = document.getElementById('cancel-forgot-modal');
  const forgotForm = document.getElementById('forgot-password-form');
  const sendResetBtn = document.getElementById('btn-send-reset');

  btnForgot.addEventListener('click', () => {
    const mainEmail = document.getElementById('email').value;
    if (mainEmail) {
      document.getElementById('forgot-email').value = mainEmail;
    }
    forgotModal.style.display = 'flex';
  });

  closeForgot.addEventListener('click', () => forgotModal.style.display = 'none');
  cancelForgot.addEventListener('click', () => forgotModal.style.display = 'none');

  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const resetEmail = document.getElementById('forgot-email').value.trim();
    if (!resetEmail) return;

    try {
      sendResetBtn.disabled = true;
      sendResetBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';
      await forgotPassword(resetEmail);
      showToast('Password reset link sent to your email! Check your inbox.', 'success');
      forgotModal.style.display = 'none';
      forgotForm.reset();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to send password reset email', 'error');
    } finally {
      sendResetBtn.disabled = false;
      sendResetBtn.textContent = 'Send Reset Link';
    }
  });

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

