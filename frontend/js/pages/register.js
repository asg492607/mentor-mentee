import { register } from '../auth.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style="background: var(--bg-primary); padding: 40px 0;">
      <!-- Decorative background elements -->
      <div class="absolute" style="top: 20%; right: 10%; width: 30vw; height: 30vw; background: var(--accent); opacity: 0.05; filter: blur(100px); border-radius: 50%;"></div>
      
      <div class="card card-glass animate-slide-up" style="width: 100%; max-width: 600px; padding: 40px; z-index: 10;">
        <div class="text-center mb-8">
          <h2 class="text-gradient mb-2">Join MentorOS</h2>
          <p class="text-secondary">Create your student account to get started</p>
        </div>

        <form id="register-form">
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">Full Name</label>
              <input type="text" id="name" class="form-input" placeholder="John Doe" required>
            </div>

            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">Email Address</label>
              <input type="email" id="email" class="form-input" placeholder="john@university.edu" required>
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="password" class="form-input" placeholder="••••••••" required minlength="6">
            </div>

            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <input type="password" id="confirmPassword" class="form-input" placeholder="••••••••" required>
            </div>

            <div class="form-group">
              <label class="form-label">Department</label>
              <select id="department" class="form-select" required>
                <option value="">Select Department</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics">Electronics</option>
                <option value="Mechanical">Mechanical</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Year</label>
              <select id="year" class="form-select" required>
                <option value="">Select Year</option>
                <option value="1">First Year</option>
                <option value="2">Second Year</option>
                <option value="3">Third Year</option>
                <option value="4">Fourth Year</option>
              </select>
            </div>
            
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">Roll Number</label>
              <input type="text" id="rollNumber" class="form-input" placeholder="e.g. 2021CS01" required>
            </div>
          </div>

          <button type="submit" class="btn btn-primary w-full btn-lg mt-6" id="register-btn">
            Create Account
          </button>
        </form>

        <div class="text-center mt-6">
          <p class="text-muted text-sm">Already have an account? <a href="#/login">Sign in</a></p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('register-form');
  const registerBtn = document.getElementById('register-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    const data = {
      email: document.getElementById('email').value,
      password: password,
      role: 'STUDENT', // Default for this form
      profile: {
        name: document.getElementById('name').value,
        department: document.getElementById('department').value,
        year: parseInt(document.getElementById('year').value),
        rollNumber: document.getElementById('rollNumber').value
      }
    };

    try {
      registerBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      registerBtn.disabled = true;

      await register(data);
      
      showToast('Registration successful! Please login.', 'success');
      navigateTo('/login');
      
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Registration failed', 'error');
      registerBtn.innerHTML = 'Create Account';
      registerBtn.disabled = false;
    }
  });
}
