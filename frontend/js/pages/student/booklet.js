import { getUserProfile } from '../../auth.js';
import { db, storage } from '../../firebase-init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { showToast } from '../../components/toast.js';
import { createSidebar } from '../../components/sidebar.js';
import { createHeader } from '../../components/header.js';

export async function render(container) {
    const user = getUserProfile();
    const docRef = doc(db, 'booklets', user.id);
    let bookletData = {};
    
    try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            bookletData = snap.data();
        }
    } catch (e) {
        showToast('Error loading booklet', 'error');
    }

    const safe = (val) => val || '';
    const safeCheck = (val, expected) => val === expected ? 'checked' : '';

    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/student/booklet')}
            <div class="main-content">
                ${createHeader('Mentorship Booklet', user)}
                
                <div class="page-content" style="max-width: 1200px; margin: 0 auto;">
                    <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                        <div class="booklet-tabs tabs" style="overflow-x:auto;">
                            <button class="btn tab-btn btn-primary" data-target="tab-personal">
                                <i class="ph ph-user"></i> Personal Profile
                            </button>
                            <button class="btn tab-btn" data-target="tab-health">
                                <i class="ph ph-heartbeat"></i> Health Service
                            </button>
                            <button class="btn tab-btn" data-target="tab-performance">
                                <i class="ph ph-trophy"></i> Previous Performance
                            </button>
                            <button class="btn tab-btn" data-target="tab-academics">
                                <i class="ph ph-books"></i> Academics
                            </button>
                            <button class="btn tab-btn" data-target="tab-activities">
                                <i class="ph ph-star"></i> Activities
                            </button>
                            <button class="btn tab-btn" data-target="tab-meets">
                                <i class="ph ph-users-three"></i> Mentorship Meets
                            </button>
                        </div>
                        <button class="btn btn-secondary" type="button" onclick="window.print()" style="white-space: nowrap;">
                            <i class="ph ph-printer"></i> Print / Export PDF
                        </button>
                    </div>

                    <form id="booklet-form">
                        <!-- Personal Profile Tab -->
                        <div id="tab-personal" class="tab-content fade-in">
                            <div class="booklet-section" style="display: flex; gap: 24px; flex-wrap: wrap;">
                                <div style="flex: 0 0 150px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                                    <div style="width: 150px; height: 180px; border: 2px dashed var(--border); border-radius: var(--radius-md); overflow: hidden; display: flex; justify-content: center; align-items: center; background: var(--bg-input); position: relative;">
                                        <img id="profile-preview" src="${bookletData.personal?.photoUrl || ''}" style="width: 100%; height: 100%; object-fit: cover; display: ${bookletData.personal?.photoUrl ? 'block' : 'none'};">
                                        <i class="ph ph-user" id="profile-placeholder" style="font-size: 4rem; color: var(--text-muted); display: ${bookletData.personal?.photoUrl ? 'none' : 'block'};"></i>
                                        <div id="upload-overlay" style="position:absolute; inset:0; background:rgba(0,0,0,0.5); display:none; justify-content:center; align-items:center; color:white;">
                                            <i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i>
                                        </div>
                                    </div>
                                    <label class="btn btn-sm btn-secondary" style="width: 100%; cursor: pointer; text-align: center;">
                                        <i class="ph ph-upload-simple"></i> Upload Photo
                                        <input type="file" id="profile-photo-upload" accept="image/*" style="display: none;">
                                    </label>
                                </div>
                                <div style="flex: 1; min-width: 300px;">
                                    <h4 class="booklet-section-title" style="margin-top:0;"><i class="ph ph-identification-card"></i> Basic Information</h4>
                                    <div class="booklet-grid-3">
                                        <div class="form-group"><label>Name of the Student</label><input type="text" class="form-control" name="personal.name" value="${safe(bookletData.personal?.name || user.name)}"></div>
                                        <div class="form-group"><label>Year of Admission</label><input type="text" class="form-control" name="personal.admissionYear" value="${safe(bookletData.personal?.admissionYear)}"></div>
                                        <div class="form-group"><label>Class</label><input type="text" class="form-control" name="personal.class" value="${safe(bookletData.personal?.class)}"></div>
                                        <div class="form-group"><label>E-mail ID</label><input type="email" class="form-control" name="personal.email" value="${safe(bookletData.personal?.email || user.email)}"></div>
                                        <div class="form-group"><label>Date of Birth</label><input type="date" class="form-control" name="personal.dob" value="${safe(bookletData.personal?.dob)}"></div>
                                        <div class="form-group"><label>Place of Birth</label><input type="text" class="form-control" name="personal.placeOfBirth" value="${safe(bookletData.personal?.placeOfBirth)}"></div>
                                        <div class="form-group"><label>State</label><input type="text" class="form-control" name="personal.state" value="${safe(bookletData.personal?.state)}"></div>
                                        <div class="form-group"><label>Nationality</label><input type="text" class="form-control" name="personal.nationality" value="${safe(bookletData.personal?.nationality)}"></div>
                                        <div class="form-group"><label>Religion</label><input type="text" class="form-control" name="personal.religion" value="${safe(bookletData.personal?.religion)}"></div>
                                        <div class="form-group"><label>Category</label><input type="text" class="form-control" name="personal.category" value="${safe(bookletData.personal?.category)}"></div>
                                        <div class="form-group"><label>Caste</label><input type="text" class="form-control" name="personal.caste" value="${safe(bookletData.personal?.caste)}"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-users"></i> Family Details</h4>
                                <h5 style="margin-bottom:12px; color:var(--text-secondary);">Father's Details</h5>
                                <div class="booklet-grid-3">
                                    <div class="form-group"><label>Father's Full Name</label><input type="text" class="form-control" name="personal.fatherName" value="${safe(bookletData.personal?.fatherName)}"></div>
                                    <div class="form-group"><label>Occupation</label><input type="text" class="form-control" name="personal.fatherOccupation" value="${safe(bookletData.personal?.fatherOccupation)}"></div>
                                    <div class="form-group"><label>Phone (Office)</label><input type="tel" class="form-control" name="personal.fatherPhoneO" value="${safe(bookletData.personal?.fatherPhoneO)}"></div>
                                    <div class="form-group"><label>Phone (Residence)</label><input type="tel" class="form-control" name="personal.fatherPhoneR" value="${safe(bookletData.personal?.fatherPhoneR)}"></div>
                                    <div class="form-group"><label>Phone (Mobile)</label><input type="tel" class="form-control" name="personal.fatherPhoneM" value="${safe(bookletData.personal?.fatherPhoneM)}"></div>
                                </div>

                                <div class="divider" style="margin:20px 0;"></div>

                                <h5 style="margin-bottom:12px; color:var(--text-secondary);">Mother's Details</h5>
                                <div class="booklet-grid-3">
                                    <div class="form-group"><label>Mother's Full Name</label><input type="text" class="form-control" name="personal.motherName" value="${safe(bookletData.personal?.motherName)}"></div>
                                    <div class="form-group"><label>Occupation</label><input type="text" class="form-control" name="personal.motherOccupation" value="${safe(bookletData.personal?.motherOccupation)}"></div>
                                    <div class="form-group"><label>Phone (Office)</label><input type="tel" class="form-control" name="personal.motherPhoneO" value="${safe(bookletData.personal?.motherPhoneO)}"></div>
                                    <div class="form-group"><label>Phone (Residence)</label><input type="tel" class="form-control" name="personal.motherPhoneR" value="${safe(bookletData.personal?.motherPhoneR)}"></div>
                                    <div class="form-group"><label>Phone (Mobile)</label><input type="tel" class="form-control" name="personal.motherPhoneM" value="${safe(bookletData.personal?.motherPhoneM)}"></div>
                                </div>
                            </div>

                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-house"></i> Local Guardian & Addresses</h4>
                                <div class="booklet-grid-3">
                                    <div class="form-group"><label>Name of local guardian</label><input type="text" class="form-control" name="personal.guardianName" value="${safe(bookletData.personal?.guardianName)}"></div>
                                    <div class="form-group"><label>Phone Number</label><input type="tel" class="form-control" name="personal.guardianPhone" value="${safe(bookletData.personal?.guardianPhone)}"></div>
                                    <div class="form-group"><label>Profession</label><input type="text" class="form-control" name="personal.guardianProfession" value="${safe(bookletData.personal?.guardianProfession)}"></div>
                                    <div class="form-group"><label>Relation</label><input type="text" class="form-control" name="personal.guardianRelation" value="${safe(bookletData.personal?.guardianRelation)}"></div>
                                    <div class="form-group"><label>Annual Income</label><input type="text" class="form-control" name="personal.annualIncome" value="${safe(bookletData.personal?.annualIncome)}"></div>
                                    <div class="form-group"><label>Pin Code</label><input type="text" class="form-control" name="personal.pinCode" value="${safe(bookletData.personal?.pinCode)}"></div>
                                </div>
                                <div class="grid-2" style="margin-top:15px;">
                                    <div class="form-group"><label>Local Guardian Address</label><textarea class="form-control" name="personal.guardianAddress">${safe(bookletData.personal?.guardianAddress)}</textarea></div>
                                    <div class="form-group"><label>Present Address</label><textarea class="form-control" name="personal.presentAddress">${safe(bookletData.personal?.presentAddress)}</textarea></div>
                                    <div class="form-group" style="grid-column: span 2;"><label>Permanent Address</label><textarea class="form-control" name="personal.permanentAddress">${safe(bookletData.personal?.permanentAddress)}</textarea></div>
                                </div>
                            </div>
                        </div>

                        <!-- Health Tab -->
                        <div id="tab-health" class="tab-content fade-in" hidden>
                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-barbell"></i> Diet & Habits</h4>
                                <div class="booklet-grid-3">
                                    <div class="form-group"><label>Diet</label>
                                        <select class="form-control" name="health.diet">
                                            <option value="">Select...</option>
                                            <option value="Veg" ${safeCheck(bookletData.health?.diet, 'Veg') ? 'selected' : ''}>Veg</option>
                                            <option value="Mixed" ${safeCheck(bookletData.health?.diet, 'Mixed') ? 'selected' : ''}>Mixed</option>
                                        </select>
                                    </div>
                                    <div class="form-group"><label>Exercise</label>
                                        <select class="form-control" name="health.exercise">
                                            <option value="">Select...</option>
                                            <option value="Yes" ${safeCheck(bookletData.health?.exercise, 'Yes') ? 'selected' : ''}>Yes</option>
                                            <option value="No" ${safeCheck(bookletData.health?.exercise, 'No') ? 'selected' : ''}>No</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="form-group" style="margin-top:20px;">
                                    <label>Habits (Check all that apply)</label>
                                    <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:10px; padding:15px; background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">
                                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" name="health.habitTobacco" ${bookletData.health?.habitTobacco ? 'checked' : ''}> Tobacco Chewing</label>
                                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" name="health.habitSmoking" ${bookletData.health?.habitSmoking ? 'checked' : ''}> Tobacco Smoking</label>
                                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" name="health.habitAlcohol" ${bookletData.health?.habitAlcohol ? 'checked' : ''}> Alcohol</label>
                                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" name="health.habitPan" ${bookletData.health?.habitPan ? 'checked' : ''}> Pan Parag</label>
                                        <label style="display:flex; align-items:center; gap:5px;"><input type="checkbox" name="health.habitGutka" ${bookletData.health?.habitGutka ? 'checked' : ''}> Gutka</label>
                                    </div>
                                </div>
                            </div>

                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-activity"></i> Physical Vitals</h4>
                                <div class="booklet-grid-3">
                                    <div class="form-group"><label>Height (cms)</label><input type="text" class="form-control" name="health.height" value="${safe(bookletData.health?.height)}"></div>
                                    <div class="form-group"><label>Weight (K.gm)</label><input type="text" class="form-control" name="health.weight" value="${safe(bookletData.health?.weight)}"></div>
                                    <div class="form-group"><label>Pulse</label><input type="text" class="form-control" name="health.pulse" value="${safe(bookletData.health?.pulse)}"></div>
                                    <div class="form-group"><label>B.P. (mm of Hg)</label><input type="text" class="form-control" name="health.bp" value="${safe(bookletData.health?.bp)}"></div>
                                </div>
                            </div>

                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-stethoscope"></i> Complaints & Systems Check</h4>
                                <div class="booklet-grid-3">
                                    <div class="form-group"><label>Menstrual History (females)</label><input type="text" class="form-control" name="health.menstrual" value="${safe(bookletData.health?.menstrual)}" placeholder="Regular / Excessive / Scanty / Painful"></div>
                                    <div class="form-group"><label>Males specific</label><input type="text" class="form-control" name="health.malesComplaints" value="${safe(bookletData.health?.malesComplaints)}" placeholder="Phimosis / Testes / Swelling"></div>
                                    <div class="form-group"><label>C.V.S.</label><input type="text" class="form-control" name="health.cvs" value="${safe(bookletData.health?.cvs)}"></div>
                                    <div class="form-group"><label>R.S.</label><input type="text" class="form-control" name="health.rs" value="${safe(bookletData.health?.rs)}"></div>
                                    <div class="form-group"><label>P/A</label><input type="text" class="form-control" name="health.pa" value="${safe(bookletData.health?.pa)}"></div>
                                    <div class="form-group"><label>SKIN</label><input type="text" class="form-control" name="health.skin" value="${safe(bookletData.health?.skin)}"></div>
                                    <div class="form-group"><label>EAR</label><input type="text" class="form-control" name="health.ear" value="${safe(bookletData.health?.ear)}"></div>
                                    <div class="form-group"><label>NOSE</label><input type="text" class="form-control" name="health.nose" value="${safe(bookletData.health?.nose)}"></div>
                                    <div class="form-group"><label>THROAT</label><input type="text" class="form-control" name="health.throat" value="${safe(bookletData.health?.throat)}"></div>
                                    <div class="form-group"><label>EYES</label><input type="text" class="form-control" name="health.eyes" value="${safe(bookletData.health?.eyes)}"></div>
                                    <div class="form-group" style="grid-column:span 2;"><label>TEETH & GUMS</label><input type="text" class="form-control" name="health.teeth" value="${safe(bookletData.health?.teeth)}"></div>
                                </div>
                                
                                <div class="divider" style="margin:20px 0;"></div>
                                <div class="form-group">
                                    <label><i class="ph ph-file-text"></i> Medical Officer Certificate / Remarks</label>
                                    <textarea class="form-control" name="health.medicalOfficerRemarks">${safe(bookletData.health?.medicalOfficerRemarks)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Performance Record Tab -->
                        <div id="tab-performance" class="tab-content fade-in" hidden>
                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-medal"></i> Record in Previous Institute</h4>
                                <div class="booklet-grid-3">
                                    <div class="form-group"><label>Qualifying Examination Passed</label><input type="text" class="form-control" name="performance.examPassed" value="${safe(bookletData.performance?.examPassed)}" placeholder="e.g. H.S.C"></div>
                                    <div class="form-group"><label>Board / University</label><input type="text" class="form-control" name="performance.board" value="${safe(bookletData.performance?.board)}"></div>
                                    <div class="form-group"><label>Month & Year of Passing</label><input type="text" class="form-control" name="performance.passingYear" value="${safe(bookletData.performance?.passingYear)}"></div>
                                    <div class="form-group" style="grid-column: span 3;"><label>College / Institute previously attended</label><input type="text" class="form-control" name="performance.collegeAttended" value="${safe(bookletData.performance?.collegeAttended)}"></div>
                                    <div class="form-group"><label>Class Awarded</label><input type="text" class="form-control" name="performance.classAwarded" value="${safe(bookletData.performance?.classAwarded)}"></div>
                                    <div class="form-group"><label>Total Marks obtained</label><input type="text" class="form-control" name="performance.totalMarks" value="${safe(bookletData.performance?.totalMarks)}" placeholder="e.g. 450 / 600"></div>
                                    <div class="form-group"><label>Total Marks in P.C.M. Group</label><input type="text" class="form-control" name="performance.pcmMarks" value="${safe(bookletData.performance?.pcmMarks)}" placeholder="e.g. 221 / 300"></div>
                                    <div class="form-group"><label>Method of Selection (CET, JEE, etc)</label><input type="text" class="form-control" name="performance.selectionMethod" value="${safe(bookletData.performance?.selectionMethod)}"></div>
                                    <div class="form-group"><label>NCC / NSS</label><input type="text" class="form-control" name="performance.ncc" value="${safe(bookletData.performance?.ncc)}"></div>
                                    <div class="form-group"><label>Scholarships held</label><input type="text" class="form-control" name="performance.scholarships" value="${safe(bookletData.performance?.scholarships)}"></div>
                                </div>
                                <div class="grid-2" style="margin-top:20px;">
                                    <div class="form-group"><label>Extra Curricular activities</label><textarea class="form-control" name="performance.extraCurricular">${safe(bookletData.performance?.extraCurricular)}</textarea></div>
                                    <div class="form-group"><label>Other achievements (College, School etc.)</label><textarea class="form-control" name="performance.otherAchievements">${safe(bookletData.performance?.otherAchievements)}</textarea></div>
                                </div>
                            </div>
                        </div>

                        <!-- Academics Tab -->
                        <div id="tab-academics" class="tab-content fade-in" hidden>
                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-exam"></i> Examination Profile</h4>
                                <p class="text-muted" style="margin-bottom:15px; font-size:0.9rem;"><i class="ph ph-info"></i> Subject marks and attendance are generally updated by your Mentor.</p>
                                
                                <div style="margin-bottom: 20px;">
                                    <label>Select Semester:</label>
                                    <select class="form-control" id="academic-sem-select" style="max-width:200px;">
                                        <option value="SEM I">SEM I</option>
                                        <option value="SEM II">SEM II</option>
                                        <option value="SEM III">SEM III</option>
                                        <option value="SEM IV">SEM IV</option>
                                        <option value="SEM V">SEM V</option>
                                        <option value="SEM VI">SEM VI</option>
                                        <option value="SEM VII">SEM VII</option>
                                        <option value="SEM VIII">SEM VIII</option>
                                    </select>
                                </div>
                                
                                <div class="table-responsive" style="background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">
                                    <table class="data-table" style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                        <thead>
                                            <tr style="border-bottom:1px solid var(--border); background:rgba(0,0,0,0.02);">
                                                <th style="padding:12px;">Name of Subject</th>
                                                <th style="padding:12px;">Date of Passing</th>
                                                <th style="padding:12px;">Univ. Seat No.</th>
                                                <th style="padding:12px;">Th</th>
                                                <th style="padding:12px;">Or/Pr</th>
                                                <th style="padding:12px;">IA</th>
                                                <th style="padding:12px;">Total</th>
                                                <th style="padding:12px;">Result / Remark</th>
                                            </tr>
                                        </thead>
                                        <tbody id="academics-subjects-tbody">
                                            <!-- Dynamic subjects rendered here -->
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div style="margin-top: 20px;" class="booklet-grid-3">
                                    <div class="form-group">
                                        <label>Overall Class / SGPA</label>
                                        <input type="text" class="form-control" id="academic-class" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label>Total Backlogs</label>
                                        <input type="text" class="form-control" id="academic-backlogs" readonly>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Activities Tab -->
                        <div id="tab-activities" class="tab-content fade-in" hidden>
                            <div class="booklet-section">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                                    <h4 class="booklet-section-title" style="margin-bottom:0; border:none; padding:0;"><i class="ph ph-star"></i> Co-Curricular & Extra Curricular</h4>
                                    <button type="button" class="btn btn-sm btn-primary" id="btn-add-activity"><i class="ph ph-plus"></i> Add Activity</button>
                                </div>
                                <div class="table-responsive" style="background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">
                                    <table class="data-table" style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                        <thead>
                                            <tr style="border-bottom:1px solid var(--border); background:rgba(0,0,0,0.02);">
                                                <th style="padding:12px;">Activity</th>
                                                <th style="padding:12px;">Date</th>
                                                <th style="padding:12px;">Name of Institution</th>
                                                <th style="padding:12px;">Award / Prize Won</th>
                                                <th style="padding:12px; width:50px;"></th>
                                            </tr>
                                        </thead>
                                        <tbody id="activities-tbody">
                                            <!-- Dynamic rows -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Mentorship Meets Tab -->
                        <div id="tab-meets" class="tab-content fade-in" hidden>
                            <div class="booklet-section">
                                <h4 class="booklet-section-title"><i class="ph ph-users-three"></i> Mentorship Meets Log</h4>
                                <p class="text-muted" style="margin-bottom:20px; font-size:0.9rem;"><i class="ph ph-info"></i> Filled by Mentor during/after meetings</p>
                                <div class="table-responsive" style="background:var(--bg-input); border-radius:8px; border:1px solid var(--border);">
                                    <table class="data-table" style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                        <thead>
                                            <tr style="border-bottom:1px solid var(--border); background:rgba(0,0,0,0.02);">
                                                <th style="padding:12px;">Date of Meeting</th>
                                                <th style="padding:12px;">Topic of Discussion</th>
                                                <th style="padding:12px;">Issue / Suggestion</th>
                                                <th style="padding:12px;">Final Attendance %</th>
                                            </tr>
                                        </thead>
                                        <tbody id="meets-tbody">
                                            <!-- Dynamic rows populated from bookletData.meets -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: 24px; display:flex; justify-content:flex-end;">
                            <button type="submit" class="btn btn-primary btn-lg" style="padding: 14px 28px; font-size: 1.05rem;"><i class="ph ph-floppy-disk" style="font-size:1.2rem; margin-right:8px;"></i> Save Booklet Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Render Academics logic (Read-only for students)
    const academicsData = bookletData.academics || {};
    const semSelect = document.getElementById('academic-sem-select');
    const acadTbody = document.getElementById('academics-subjects-tbody');
    const acadClass = document.getElementById('academic-class');
    const acadBacklogs = document.getElementById('academic-backlogs');

    function renderAcademicsForSem(sem) {
        acadTbody.innerHTML = '';
        const data = academicsData[sem] || { subjects: [], classAwarded: '', backlogs: '' };
        acadClass.value = data.classAwarded || '';
        acadBacklogs.value = data.backlogs || '';
        
        if (!data.subjects || data.subjects.length === 0) {
            acadTbody.innerHTML = '<tr><td colspan="8" style="padding:15px 0; text-align:center; color:var(--text-muted);">No subjects added yet.</td></tr>';
            return;
        }

        data.subjects.forEach(sub => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding:10px 12px;">${safe(sub.name)}</td>
                <td style="padding:10px 12px;">${safe(sub.date)}</td>
                <td style="padding:10px 12px;">${safe(sub.seatNo)}</td>
                <td style="padding:10px 12px;">${safe(sub.th)}</td>
                <td style="padding:10px 12px;">${safe(sub.or)}</td>
                <td style="padding:10px 12px;">${safe(sub.ia)}</td>
                <td style="padding:10px 12px;">${safe(sub.total)}</td>
                <td style="padding:10px 12px;">${safe(sub.result)}</td>
            `;
            acadTbody.appendChild(tr);
        });
    }
    
    semSelect.addEventListener('change', (e) => renderAcademicsForSem(e.target.value));
    renderAcademicsForSem('SEM I'); // Initial render

    // Render Activities Table (Editable for student)
    const activitiesBody = document.getElementById('activities-tbody');
    let activitiesData = bookletData.activities || [];

    function renderActivities() {
        activitiesBody.innerHTML = '';
        if (activitiesData.length === 0) {
            activitiesBody.innerHTML = '<tr><td colspan="5" style="padding:15px 0; text-align:center; color:var(--text-muted);">No activities logged yet.</td></tr>';
            return;
        }
        activitiesData.forEach((act, index) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding:10px 12px;"><input type="text" class="form-control" data-idx="${index}" data-field="activity" value="${safe(act.activity)}"></td>
                <td style="padding:10px 12px;"><input type="date" class="form-control" data-idx="${index}" data-field="date" value="${safe(act.date)}" style="max-width:140px;"></td>
                <td style="padding:10px 12px;"><input type="text" class="form-control" data-idx="${index}" data-field="institution" value="${safe(act.institution)}"></td>
                <td style="padding:10px 12px;"><input type="text" class="form-control" data-idx="${index}" data-field="award" value="${safe(act.award)}"></td>
                <td style="padding:10px 12px;"><button type="button" class="btn btn-sm btn-secondary delete-act" data-idx="${index}" style="color:var(--danger);"><i class="ph ph-trash"></i></button></td>
            `;
            activitiesBody.appendChild(tr);
        });

        activitiesBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                activitiesData[e.target.dataset.idx][e.target.dataset.field] = e.target.value;
            });
        });
        activitiesBody.querySelectorAll('.delete-act').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activitiesData.splice(e.target.dataset.idx, 1);
                renderActivities();
            });
        });
    }
    renderActivities();
    
    document.getElementById('btn-add-activity').addEventListener('click', () => {
        activitiesData.push({ activity: '', date: '', institution: '', award: '' });
        renderActivities();
    });

    // Render Meets Table (Readonly for student)
    const meetsBody = document.getElementById('meets-tbody');
    const meetsData = bookletData.meets || [];
    if (meetsData.length === 0) {
        meetsBody.innerHTML = '<tr><td colspan="4" style="padding:15px 0; text-align:center; color:var(--text-muted);">No meetings logged yet.</td></tr>';
    } else {
        meetsData.forEach(meet => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding:10px 12px;">${safe(meet.date)}</td>
                <td style="padding:10px 12px;">${safe(meet.topic)}</td>
                <td style="padding:10px 12px;">${safe(meet.suggestions)}</td>
                <td style="padding:10px 12px;">${safe(meet.attendance)}%</td>
            `;
            meetsBody.appendChild(tr);
        });
    }

    // Tab Switching Logic
    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(t => {
                t.classList.remove('btn-primary');
                t.classList.add('btn-secondary');
            });
            tab.classList.remove('btn-secondary');
            tab.classList.add('btn-primary');
            
            contents.forEach(c => c.hidden = true);
            document.getElementById(tab.dataset.target).hidden = false;
        });
    });

    // Form Submission
    document.getElementById('booklet-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';

        try {
            const formData = new FormData(e.target);
            const updateData = {
                personal: {
                    name: formData.get('personal.name'),
                    photoUrl: bookletData.personal?.photoUrl || null,
                    admissionYear: formData.get('personal.admissionYear'),
                    class: formData.get('personal.class'),
                    email: formData.get('personal.email'),
                    dob: formData.get('personal.dob'),
                    placeOfBirth: formData.get('personal.placeOfBirth'),
                    state: formData.get('personal.state'),
                    nationality: formData.get('personal.nationality'),
                    religion: formData.get('personal.religion'),
                    category: formData.get('personal.category'),
                    caste: formData.get('personal.caste'),
                    fatherName: formData.get('personal.fatherName'),
                    fatherOccupation: formData.get('personal.fatherOccupation'),
                    fatherPhoneO: formData.get('personal.fatherPhoneO'),
                    fatherPhoneR: formData.get('personal.fatherPhoneR'),
                    fatherPhoneM: formData.get('personal.fatherPhoneM'),
                    motherName: formData.get('personal.motherName'),
                    motherOccupation: formData.get('personal.motherOccupation'),
                    motherPhoneO: formData.get('personal.motherPhoneO'),
                    motherPhoneR: formData.get('personal.motherPhoneR'),
                    motherPhoneM: formData.get('personal.motherPhoneM'),
                    guardianName: formData.get('personal.guardianName'),
                    guardianPhone: formData.get('personal.guardianPhone'),
                    guardianProfession: formData.get('personal.guardianProfession'),
                    guardianRelation: formData.get('personal.guardianRelation'),
                    guardianAddress: formData.get('personal.guardianAddress'),
                    annualIncome: formData.get('personal.annualIncome'),
                    pinCode: formData.get('personal.pinCode'),
                    presentAddress: formData.get('personal.presentAddress'),
                    permanentAddress: formData.get('personal.permanentAddress')
                },
                health: {
                    diet: formData.get('health.diet'),
                    exercise: formData.get('health.exercise'),
                    habitTobacco: formData.get('health.habitTobacco') === 'on',
                    habitSmoking: formData.get('health.habitSmoking') === 'on',
                    habitAlcohol: formData.get('health.habitAlcohol') === 'on',
                    habitPan: formData.get('health.habitPan') === 'on',
                    habitGutka: formData.get('health.habitGutka') === 'on',
                    height: formData.get('health.height'),
                    weight: formData.get('health.weight'),
                    pulse: formData.get('health.pulse'),
                    bp: formData.get('health.bp'),
                    menstrual: formData.get('health.menstrual'),
                    malesComplaints: formData.get('health.malesComplaints'),
                    cvs: formData.get('health.cvs'),
                    rs: formData.get('health.rs'),
                    pa: formData.get('health.pa'),
                    skin: formData.get('health.skin'),
                    ear: formData.get('health.ear'),
                    nose: formData.get('health.nose'),
                    throat: formData.get('health.throat'),
                    eyes: formData.get('health.eyes'),
                    teeth: formData.get('health.teeth'),
                    medicalOfficerRemarks: formData.get('health.medicalOfficerRemarks')
                },
                performance: {
                    examPassed: formData.get('performance.examPassed'),
                    collegeAttended: formData.get('performance.collegeAttended'),
                    board: formData.get('performance.board'),
                    passingYear: formData.get('performance.passingYear'),
                    classAwarded: formData.get('performance.classAwarded'),
                    totalMarks: formData.get('performance.totalMarks'),
                    pcmMarks: formData.get('performance.pcmMarks'),
                    selectionMethod: formData.get('performance.selectionMethod'),
                    extraCurricular: formData.get('performance.extraCurricular'),
                    ncc: formData.get('performance.ncc'),
                    scholarships: formData.get('performance.scholarships'),
                    otherAchievements: formData.get('performance.otherAchievements')
                },
                activities: activitiesData
            };

            updateData.academics = bookletData.academics || {};
            updateData.meets = bookletData.meets || [];

            await setDoc(docRef, updateData, { merge: true });
            bookletData = updateData;
            showToast('Booklet saved successfully!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to save booklet: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-floppy-disk" style="font-size:1.2rem; margin-right:8px;"></i> Save Booklet Changes';
        }
    });

    // Handle Photo Upload
    const photoUploadInput = document.getElementById('profile-photo-upload');
    if (photoUploadInput) {
        photoUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const preview = document.getElementById('profile-preview');
            const placeholder = document.getElementById('profile-placeholder');
            const overlay = document.getElementById('upload-overlay');
            
            overlay.style.display = 'flex';

            try {
                const storageRef = ref(storage, 'booklets/' + user.id + '/profile.jpg');
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                
                if (!bookletData.personal) bookletData.personal = {};
                bookletData.personal.photoUrl = url;
                
                // Save just the photo instantly so it's not lost
                await setDoc(docRef, { personal: { photoUrl: url } }, { merge: true });
                
                preview.src = url;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                showToast('Photo uploaded successfully', 'success');
            } catch (error) {
                console.error(error);
                showToast('Failed to upload photo', 'error');
            } finally {
                overlay.style.display = 'none';
                e.target.value = ''; // Reset input
            }
        });
    }
}
