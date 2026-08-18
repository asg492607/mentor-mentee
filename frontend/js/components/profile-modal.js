import { getUserProfile, updateUserProfileData } from '../auth.js';
import { db } from '../firebase-init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils.js';

let modalContainer = null;

export async function openProfileModal() {
  const user = getUserProfile();
  if (!user) {
    showToast('Please log in to view your profile', 'warning');
    return;
  }

  // Remove existing modal if any
  document.getElementById('global-faculty-profile-modal')?.remove();

  // Fetch freshest data from Firestore
  let profile = { ...user };
  try {
    const coll = (user.role || 'STUDENT').toUpperCase() === 'STUDENT' ? 'students' : 'faculty';
    const snap = await getDoc(doc(db, coll, user.id || user.uid));
    if (snap.exists()) {
      profile = { ...profile, ...snap.data() };
    }
  } catch (e) {
    console.warn('Could not fetch latest profile:', e);
  }

  const role = (profile.role || 'FACULTY').toUpperCase();
  const initials = escapeHtml((profile.name || 'User').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2));

  const modalHtml = `
    <div id="global-faculty-profile-modal" class="modal-backdrop" style="display:flex;z-index:10000;background:rgba(0,0,0,0.75);backdrop-filter:blur(5px);position:fixed;inset:0;justify-content:center;align-items:center;padding:16px;">
      <div class="modal card fade-in" style="max-width:680px;width:100%;max-height:90vh;overflow-y:auto;background:var(--bg-card,#1e293b);border:1px solid var(--border);border-radius:16px;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,0.4);">
        
        <!-- Modal Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:16px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="avatar avatar-lg" style="width:58px;height:58px;font-size:1.4rem;font-weight:700;background:linear-gradient(135deg,var(--accent,#6366f1),#8b5cf6);color:white;display:flex;align-items:center;justify-content:center;border-radius:50%;box-shadow:0 4px 12px rgba(99,102,241,0.3);">
              ${initials}
            </div>
            <div>
              <h3 style="margin:0;font-size:1.25rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                ${escapeHtml(profile.name || 'Faculty Profile')}
                <span class="badge badge-accent" style="font-size:0.72rem;padding:3px 10px;border-radius:20px;letter-spacing:0.04em;">${escapeHtml(role)}</span>
              </h3>
              <p style="margin:4px 0 0 0;color:var(--text-secondary);font-size:0.85rem;">
                ${escapeHtml(profile.email || '')} &bull; ${escapeHtml(profile.department || 'School of Computing')}
              </p>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="close-profile-modal-btn" style="font-size:1.3rem;line-height:1;padding:6px 10px;cursor:pointer;">✕</button>
        </div>

        <!-- Form Content -->
        <form id="faculty-profile-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            
            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Full Name</label>
              <input type="text" id="prof-name" class="form-input" value="${escapeHtml(profile.name || '')}" required placeholder="Dr. / Prof. Full Name">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Email Address</label>
              <input type="email" class="form-input" value="${escapeHtml(profile.email || '')}" readonly style="opacity:0.65;cursor:not-allowed;" title="Email cannot be altered">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Designation / Title</label>
              <input type="text" id="prof-designation" class="form-input" value="${escapeHtml(profile.designation || (role === 'HOD' ? 'Head of Department' : role === 'DEAN' ? 'Dean' : 'Assistant Professor'))}" placeholder="e.g. Assistant Professor, HOD">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Department</label>
              <input type="text" id="prof-dept" class="form-input" value="${escapeHtml(profile.department || 'Department of Computer Science & Engineering (Core)')}" placeholder="Department">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Contact Number</label>
              <input type="tel" id="prof-phone" class="form-input" value="${escapeHtml(profile.phone || profile.contactNumber || '')}" placeholder="e.g. +91 9876543210">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Employee / Staff ID</label>
              <input type="text" id="prof-empid" class="form-input" value="${escapeHtml(profile.employeeId || '')}" placeholder="e.g. EMP-10492">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Cabin / Office Room</label>
              <input type="text" id="prof-cabin" class="form-input" value="${escapeHtml(profile.cabinNumber || profile.officeRoom || '')}" placeholder="e.g. Block C, Room 304">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Office / Meeting Hours</label>
              <input type="text" id="prof-hours" class="form-input" value="${escapeHtml(profile.officeHours || '')}" placeholder="e.g. Mon-Fri 3:00 PM - 5:00 PM">
            </div>

            <div class="form-group" style="grid-column:1/-1;">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Specialization / Domain Expertise</label>
              <input type="text" id="prof-spec" class="form-input" value="${escapeHtml(profile.specialization || '')}" placeholder="e.g. Machine Learning, Cloud Computing, Cyber Security">
            </div>

            <div class="form-group" style="grid-column:1/-1;">
              <label class="form-label" style="font-weight:600;font-size:0.85rem;">Professional Bio / Mentorship Philosophy</label>
              <textarea id="prof-bio" class="form-textarea" style="min-height:75px;" placeholder="Brief summary of your academic background and mentorship goals...">${escapeHtml(profile.bio || '')}</textarea>
            </div>

          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;border-top:1px solid var(--border);padding-top:16px;">
            <div style="font-size:0.8rem;color:var(--text-muted);">
              ${role === 'FACULTY' || role === 'MENTOR' ? `<span>👥 Mentee Capacity: <strong>${profile.assignedStudentCount || 0} / 20 Mentees</strong></span>` : ''}
            </div>
            <div style="display:flex;gap:10px;">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-profile-modal-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="btn-save-profile" style="padding:8px 20px;font-weight:600;">
                💾 Save Changes
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('global-faculty-profile-modal');

  const closeModal = () => modal?.remove();
  document.getElementById('close-profile-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('cancel-profile-modal-btn')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.getElementById('faculty-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-profile');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      const updates = {
        name: document.getElementById('prof-name')?.value.trim() || '',
        designation: document.getElementById('prof-designation')?.value.trim() || '',
        department: document.getElementById('prof-dept')?.value.trim() || '',
        phone: document.getElementById('prof-phone')?.value.trim() || '',
        contactNumber: document.getElementById('prof-phone')?.value.trim() || '',
        employeeId: document.getElementById('prof-empid')?.value.trim() || '',
        cabinNumber: document.getElementById('prof-cabin')?.value.trim() || '',
        officeHours: document.getElementById('prof-hours')?.value.trim() || '',
        specialization: document.getElementById('prof-spec')?.value.trim() || '',
        bio: document.getElementById('prof-bio')?.value.trim() || '',
        updatedAt: new Date().toISOString()
      };

      const coll = role === 'STUDENT' ? 'students' : 'faculty';
      await setDoc(doc(db, coll, user.id || user.uid), updates, { merge: true });

      // Update cached user in memory
      if (typeof updateUserProfileData === 'function') {
        await updateUserProfileData(updates);
      }

      // Update UI in header
      const headerNameEl = document.querySelector('.header-user-name');
      if (headerNameEl && updates.name) {
        headerNameEl.textContent = updates.name;
      }
      const avatarEl = document.querySelector('.header .avatar');
      if (avatarEl && updates.name) {
        avatarEl.textContent = updates.name.charAt(0).toUpperCase();
      }

      showToast('Profile updated successfully!', 'success');
      closeModal();
    } catch (err) {
      showToast('Failed to update profile: ' + err.message, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
      }
    }
  });
}
