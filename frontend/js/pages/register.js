import { register } from '../auth.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/toast.js';

// No longer need PRIVILEGED_ROLES here — auth.js handles all approval logic

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
          <h2 class="text-gradient mb-2">Join mentor-mentee</h2>
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
                <select id="department" class="form-select dynamic-dept" required>
                  <option value="">Loading...</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Class</label>
                <select id="student-class" class="form-select" required disabled>
                  <option value="">Select Department First</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Year (Standard)</label>
                <select id="year" class="form-select" required>
                  <option value="">Select Year</option>
                  <option value="1">First Year</option>
                  <option value="2">Second Year</option>
                  <option value="3">Third Year</option>
                  <option value="4">Fourth Year</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">Enrollment Number</label>
                <input type="text" id="enrollmentNumber" class="form-input" placeholder="e.g. EN2024001" required>
              </div>
            </div>

            <!-- Staff Fields -->
            <div id="teacher-fields" class="grid grid-cols-2 gap-4" style="grid-column: 1 / -1; display: none;">
              <div class="form-group" id="staff-dept-group">
                <label class="form-label" id="staff-dept-label">Department</label>
                <select id="teacher-department" class="form-select dynamic-dept">
                  <option value="">Loading...</option>
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
  const classSelect = document.getElementById('student-class');
  const deptSelects = document.querySelectorAll('.dynamic-dept');
  
  let allDepts = [];
  
  import('/js/services.js').then(async ({ DepartmentService, ClassService }) => {
    try {
      allDepts = await DepartmentService.getAll();
      populateDepts('Academic');
      
      deptSelects[0].addEventListener('change', async (e) => {
        const dept = e.target.value;
        classSelect.innerHTML = '<option value="">Select Class</option>';
        if (!dept) {
          classSelect.disabled = true;
          return;
        }
        classSelect.disabled = true;
        classSelect.innerHTML = '<option value="">Loading...</option>';
        const classes = await ClassService.getByDepartment(dept);
        if (!classes.length) {
          classSelect.innerHTML = '<option value="">No classes found</option>';
        } else {
          classSelect.disabled = false;
          classSelect.innerHTML = '<option value="">Select Class</option>' + classes.map(c => `<option value="${c.className}">Class ${c.className}</option>`).join('');
        }
      });
      
    } catch(e) {
      console.error('Failed to load departments', e);
    }
  });
  
  function populateDepts(typeStr) {
    const isSection = typeStr === 'Section';
    const opts = '<option value="">Select ' + (isSection ? 'Section' : 'Department') + '</option>' +
      allDepts.filter(d => isSection ? d.type === 'Section' : d.type !== 'Section').map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    deptSelects.forEach(s => s.innerHTML = opts);
  }

  roleSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    const staffLabel = document.getElementById('staff-dept-label');
    const staffGroup = document.getElementById('staff-dept-group');
    
    if (val === 'STUDENT') {
      studentFields.style.display = 'grid';
      teacherFields.style.display = 'none';
      document.getElementById('department').required = true;
      document.getElementById('student-class').required = true;
      document.getElementById('year').required = true;
      document.getElementById('enrollmentNumber').required = true;
      document.getElementById('teacher-department').required = false;
      document.getElementById('designation').required = false;
      document.getElementById('employeeId').required = false;
      populateDepts('Academic');
    } else {
      studentFields.style.display = 'none';
      teacherFields.style.display = 'grid';
      document.getElementById('department').required = false;
      document.getElementById('student-class').required = false;
      document.getElementById('year').required = false;
      document.getElementById('enrollmentNumber').required = false;
      
      if (val === 'DEAN' || val === 'ADMIN') {
        staffGroup.style.display = 'none';
        document.getElementById('teacher-department').required = false;
      } else {
        staffGroup.style.display = 'block';
        document.getElementById('teacher-department').required = true;
        if (val === 'SECTION_HEAD') {
          staffLabel.textContent = 'Section';
          populateDepts('Section');
        } else {
          staffLabel.textContent = 'Department';
          populateDepts('Academic');
        }
      }
      
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
      data.profile.class = document.getElementById('student-class').value;
      data.profile.year = parseInt(document.getElementById('year').value);
      data.profile.enrollmentNumber = document.getElementById('enrollmentNumber').value;
    } else {
      if (role !== 'DEAN' && role !== 'ADMIN') {
        data.profile.department = document.getElementById('teacher-department').value;
      }
      data.profile.designation = getDefaultDesignation(role, document.getElementById('designation').value);
      data.profile.employeeId = document.getElementById('employeeId').value;
    }

    try {
      registerBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      registerBtn.disabled = true;

      await register(data);
      
      const pendingMessages = {
        STUDENT: 'Registration submitted! Your account needs approval from your assigned Mentor.',
        FACULTY: 'Registration submitted! Awaiting HOD approval.',
        HOD: 'Registration submitted! Awaiting Dean approval.'
      };
      showToast(pendingMessages[role] || 'Registration submitted! Please wait for approval.', 'success');
      navigateTo('/login');
      
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Registration failed', 'error');
      registerBtn.innerHTML = 'Create Account';
      registerBtn.disabled = false;
    }
  });
}
