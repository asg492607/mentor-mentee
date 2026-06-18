import { register } from '../auth.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/toast.js';

const PRIVILEGED_ROLES = new Set(['HOD', 'DEAN', 'ADMIN']);

function getDefaultDesignation(role, selectedDesignation) {
  if (role === 'HOD') return 'Head of Department';
  if (role === 'DEAN') return 'Dean';
  if (role === 'ADMIN') return 'Administrator';
  return selectedDesignation;
}

export async function render(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style="background: var(--bg-primary); padding: 40px 0;">
      <!-- Decorative background elements -->
      <div class="absolute" style="top: 20%; right: 10%; width: 30vw; height: 30vw; background: var(--accent); opacity: 0.05; filter: blur(100px); border-radius: 50%;"></div>
      
      <div class="card card-glass animate-slide-up" style="width: 100%; max-width: 600px; padding: 40px; z-index: 10;">
        <div class="text-center mb-8">
          <h2 class="text-gradient mb-2">Join MentorOS</h2>
          <p class="text-secondary">Create your student, faculty, HOD, dean, or admin account to get started</p>
        </div>

        <form id="register-form">
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">Register As</label>
              <select id="role" class="form-select" required>
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Teacher / Faculty</option>
                <option value="HOD">HOD</option>
                <option value="DEAN">Dean</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

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

            <!-- Student Fields -->
            <div id="student-fields" class="grid grid-cols-2 gap-4" style="grid-column: 1 / -1; display: grid;">
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

            <!-- Staff Fields -->
            <div id="teacher-fields" class="grid grid-cols-2 gap-4" style="grid-column: 1 / -1; display: none;">
              <div class="form-group">
                <label class="form-label">Department</label>
                <select id="teacher-department" class="form-select">
                  <option value="">Select Department</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Mechanical">Mechanical</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Designation</label>
                <select id="designation" class="form-select">
                  <option value="">Select Designation</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Professor">Professor</option>
                  <option value="Head of Department">Head of Department</option>
                  <option value="Dean">Dean</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>
              
              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label">Employee ID</label>
                <input type="text" id="employeeId" class="form-input" placeholder="e.g. EMP1234">
              </div>
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
  const roleSelect = document.getElementById('role');
  const studentFields = document.getElementById('student-fields');
  const teacherFields = document.getElementById('teacher-fields');

  roleSelect.addEventListener('change', (e) => {
    if (e.target.value === 'STUDENT') {
      studentFields.style.display = 'grid';
      teacherFields.style.display = 'none';
      document.getElementById('department').required = true;
      document.getElementById('year').required = true;
      document.getElementById('rollNumber').required = true;
      document.getElementById('teacher-department').required = false;
      document.getElementById('designation').required = false;
      document.getElementById('employeeId').required = false;
    } else {
      studentFields.style.display = 'none';
      teacherFields.style.display = 'grid';
      document.getElementById('department').required = false;
      document.getElementById('year').required = false;
      document.getElementById('rollNumber').required = false;
      document.getElementById('teacher-department').required = true;
      document.getElementById('designation').required = true;
      document.getElementById('employeeId').required = true;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    const role = roleSelect.value;
    const data = {
      email: document.getElementById('email').value,
      password: password,
      role: role,
      profile: {
        name: document.getElementById('name').value
      }
    };

    if (role === 'STUDENT') {
      data.profile.department = document.getElementById('department').value;
      data.profile.year = parseInt(document.getElementById('year').value);
      data.profile.rollNumber = document.getElementById('rollNumber').value;
    } else {
      data.profile.department = document.getElementById('teacher-department').value;
      data.profile.designation = getDefaultDesignation(role, document.getElementById('designation').value);
      data.profile.employeeId = document.getElementById('employeeId').value;
      
      if (PRIVILEGED_ROLES.has(role)) {
        data.profile.status = 'approved';
        data.profile.isApproved = true;
      } else {
        data.profile.status = 'pending';
        data.profile.isApproved = false;
      }
    }

    try {
      registerBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      registerBtn.disabled = true;

      await register(data);
      
      if (role === 'FACULTY') {
        showToast('Registration submitted! Awaiting Dean approval.', 'success');
      } else if (PRIVILEGED_ROLES.has(role)) {
        showToast(`${role} registration successful! Please login.`, 'success');
      } else {
        showToast('Registration successful! Please login.', 'success');
      }
      navigateTo('/login');
      
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Registration failed', 'error');
      registerBtn.innerHTML = 'Create Account';
      registerBtn.disabled = false;
    }
  });
}
