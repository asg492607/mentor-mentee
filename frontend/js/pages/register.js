// Register Page
// Self-registration flow for students and faculty; pending approval before access is granted.
import { register } from '../auth.js';
import { api } from '../api.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderTermsCheckbox, initTermsTriggers } from '../components/terms-modal.js';
import { t, renderLanguageSelector } from '../i18n.js';
import { escapeHtml } from '../utils.js';

// No longer need PRIVILEGED_ROLES here — auth.js handles all approval logic

function getDefaultDesignation(role, selectedDesignation) {
  if (role === 'HOD') return 'Head of Department';
  if (role === 'DEAN') return 'Dean';
  if (role === 'ADMIN') return 'Administrator';
  return selectedDesignation;
}

export async function render(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style="background: var(--bg-primary); min-height: 100vh; min-height: 100dvh; padding: 24px 14px;">
      <!-- Decorative background elements -->
      <div class="absolute" style="top: 20%; right: 10%; width: 30vw; height: 30vw; background: var(--accent); opacity: 0.05; filter: blur(100px); border-radius: 50%;"></div>
      
      <div class="card card-glass animate-slide-up" style="width: 100%; max-width: 600px; padding: clamp(20px, 5vw, 36px); z-index: 10; position: relative;">
        
        <!-- Top bar with language selector and home link -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <a href="#/landing" style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px; text-decoration: none;">
            <i class="ph ph-arrow-left"></i> ${t('common.back', 'Back')}
          </a>
          ${renderLanguageSelector('auth')}
        </div>

        <div class="text-center mb-8">
          <h2 class="text-gradient mb-2">${t('register.title', 'Join Lumina')}</h2>
          <p class="text-secondary">${t('register.subtitle', 'Create a student or faculty account. Staff accounts require approval.')}</p>
        </div>

        <form id="register-form">
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">${t('register.as', 'Register As')}</label>
              <select id="role" class="form-select" required>
                <option value="STUDENT">${t('role.student', 'Student')}</option>
                <option value="FACULTY">${t('role.faculty', 'Teacher / Faculty')}</option>
              </select>
            </div>

            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">${t('register.full_name', 'Full Name')}</label>
              <input type="text" id="name" class="form-input" placeholder="${t('register.full_name_placeholder', 'Your full name')}" required>
            </div>

            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">${t('register.email', 'Email Address')}</label>
              <input type="email" id="email" class="form-input" placeholder="${t('register.email_placeholder', 'name@university.edu')}" required>
            </div>

            <div class="form-group">
              <label class="form-label">${t('register.password', 'Password')}</label>
              <input type="password" id="password" class="form-input" placeholder="••••••••" required minlength="6">
            </div>

            <div class="form-group">
              <label class="form-label">${t('register.confirm_password', 'Confirm Password')}</label>
              <input type="password" id="confirmPassword" class="form-input" placeholder="••••••••" required>
            </div>

            <!-- Student Fields -->
            <div id="student-fields" class="grid grid-cols-2 gap-4" style="grid-column: 1 / -1; display: grid;">
              <div class="form-group">
                <label class="form-label">${t('register.department', 'Department')}</label>
                <select id="department" class="form-select dynamic-dept" required>
                  <option value="">${t('common.loading', 'Loading...')}</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">${t('register.class', 'Class')}</label>
                <select id="student-class" class="form-select" required disabled>
                  <option value="">Select Department First</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">${t('register.year', 'Year (Standard)')}</label>
                <select id="year" class="form-select" required>
                  <option value="">Select Year</option>
                  <option value="1">${t('register.year_1', 'First Year')}</option>
                  <option value="2">${t('register.year_2', 'Second Year')}</option>
                  <option value="3">${t('register.year_3', 'Third Year')}</option>
                  <option value="4">${t('register.year_4', 'Fourth Year')}</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">${t('register.enrollment', 'Enrollment Number')}</label>
                <input type="text" id="enrollmentNumber" class="form-input" placeholder="${t('register.enrollment_placeholder', 'e.g. EN2024001')}" required>
              </div>
            </div>

            <!-- Staff Fields -->
            <div id="teacher-fields" class="grid grid-cols-2 gap-4" style="grid-column: 1 / -1; display: none;">
              <div class="form-group" id="staff-dept-group">
                <label class="form-label" id="staff-dept-label">${t('register.department', 'Department')}</label>
                <select id="teacher-department" class="form-select dynamic-dept">
                </select>
              </div>
              
              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label">Employee ID</label>
                <input type="text" id="employeeId" class="form-input" placeholder="e.g. EMP1234">
              </div>
              <div class="form-group" style="grid-column:1 / -1;">
                <label class="form-label">Designation</label>
                <input type="text" id="designation" class="form-input" placeholder="Faculty">
              </div>
            </div>
          </div>

          <div style="margin-top:4px;">
            ${renderTermsCheckbox({ id: 'register-terms-agree' })}
          </div>

          <button type="submit" class="btn btn-primary w-full btn-lg mt-6" id="register-btn">
            ${t('register.submit', 'Create Account')}
          </button>
        </form>

        <div class="text-center mt-6">
          <p class="text-muted text-sm">${t('register.already_registered', 'Already have an account?')} <a href="#/login">${t('register.sign_in', 'Sign in')}</a></p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('register-form');
  const registerBtn = document.getElementById('register-btn');
  initTermsTriggers(container, 'register-terms-agree');
  const roleSelect = document.getElementById('role');
  const studentFields = document.getElementById('student-fields');
  const teacherFields = document.getElementById('teacher-fields');
  const classSelect = document.getElementById('student-class');
  const deptSelects = document.querySelectorAll('.dynamic-dept');
  
  let allDepts = [];
  let allClasses = [];
  let classCatalog = [];
  
  api.get('/auth/institution-options').then(options => {
    try {
      allDepts = Array.isArray(options.departments) ? options.departments : [];
      classCatalog = Array.isArray(options.classes) ? options.classes : [];
      populateDepts('Academic');
      
      deptSelects[0].addEventListener('change', (e) => {
        const dept = e.target.value;
        classSelect.innerHTML = '<option value="">Select Class</option>';
        if (!dept) {
          classSelect.disabled = true;
          allClasses = [];
          updateYearOptions();
          return;
        }
        classSelect.disabled = true;
        allClasses = classCatalog.filter(item => item.departmentId === dept);
        const classes = allClasses;
        if (!classes.length) {
          classSelect.innerHTML = '<option value="">No classes found</option>';
        } else {
          classSelect.disabled = false;
          classSelect.innerHTML = '<option value="">Select Class</option>' + classes.map(c => `<option value="${escapeHtml(c.id)}">Class ${escapeHtml(c.className)}</option>`).join('');
        }
        updateYearOptions();
      });

      classSelect.addEventListener('change', updateYearOptions);
    } catch (error) { console.error('Failed to load institution registration options', error); }
  }).catch(error => {
    console.error('Failed to load institution registration options', error);
    showToast('Institution options could not be loaded. Please try again later.', 'error');
  });
  
  function populateDepts(typeStr) {
    const isSection = typeStr === 'Section';
    const opts = '<option value="">Select ' + (isSection ? 'Section' : 'Department') + '</option>' +
      allDepts.filter(d => isSection ? String(d.type || '').toUpperCase() === 'SECTION' : !['SECTION', 'SCHOOL', 'COLLEGE'].includes(String(d.type || '').toUpperCase())).map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join('');
    deptSelects.forEach(s => s.innerHTML = opts);
  }

  function updateYearOptions() {
    const yearSelect = document.getElementById('year');
    const selectedClass = allClasses.find(item => item.id === classSelect.value);
    const duration = Math.min(8, Math.max(1, Number(selectedClass?.durationYears) || 4));
    const rawClassYear = String(selectedClass?.year ?? '').trim().toUpperCase();
    const fixedYear = Number(rawClassYear) || ({ FY: 1, SY: 2, TY: 3, LY: 4, FINAL: 4 })[rawClassYear] || null;
    const years = fixedYear && fixedYear <= duration ? [fixedYear] : Array.from({ length: duration }, (_, index) => index + 1);
    const labels = { 1: 'FY · First Year', 2: 'SY · Second Year', 3: 'TY · Third Year', 4: 'LY · Fourth Year' };
    const previous = yearSelect.value;
    yearSelect.innerHTML = '<option value="">Select Year</option>' + years.map(year => `<option value="${year}">${labels[year] || `Year ${year}`}</option>`).join('');
    yearSelect.value = years.includes(Number(previous)) ? previous : '';
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
      email: document.getElementById('email').value.trim(),
      password: password,
      role: role,
      profile: {
        name: document.getElementById('name').value.trim(),
      },
      termsAccepted: document.getElementById('register-terms-agree')?.checked === true
    };

    if (role === 'STUDENT') {
      const departmentRecord = allDepts.find(item => item.id === document.getElementById('department')?.value);
      const classRecord = allClasses.find(item => item.id === document.getElementById('student-class')?.value);
      data.profile.department = departmentRecord?.name || '';
      data.profile.departmentId = departmentRecord?.id || '';
      data.profile.schoolId = departmentRecord?.schoolId || '';
      data.profile.schoolName = departmentRecord?.schoolName || '';
      data.profile.classId = classRecord?.id || '';
      data.profile.class = classRecord?.className || '';
      data.profile.course = classRecord?.course || '';
      data.profile.durationYears = classRecord?.durationYears || 4;
      const yearVal = parseInt(document.getElementById('year')?.value);
      data.profile.year = isNaN(yearVal) ? 1 : yearVal;
      data.profile.yearLabel = ({ 1: 'FY', 2: 'SY', 3: 'TY', 4: 'LY' })[data.profile.year] || `Year ${data.profile.year}`;
      data.profile.enrollmentNumber = document.getElementById('enrollmentNumber')?.value.trim() || '';
    } else {
      if (role !== 'DEAN' && role !== 'ADMIN') {
        const departmentRecord = allDepts.find(item => item.id === document.getElementById('teacher-department')?.value);
        data.profile.department = departmentRecord?.name || '';
        data.profile.departmentId = departmentRecord?.id || '';
        data.profile.schoolId = departmentRecord?.schoolId || '';
        data.profile.schoolName = departmentRecord?.schoolName || '';
      }
      data.profile.designation = getDefaultDesignation(role, document.getElementById('designation')?.value.trim() || 'Faculty');
      data.profile.employeeId = document.getElementById('employeeId')?.value.trim() || '';
    }

    try {
      registerBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      registerBtn.disabled = true;

      await register(data);
      
      const pendingMessages = {
        STUDENT: 'Registration submitted! Your account needs approval from your assigned Mentor.',
        FACULTY: 'Registration submitted! Awaiting HOD approval.'
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

