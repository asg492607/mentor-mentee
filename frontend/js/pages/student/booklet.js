import { getUserProfile } from '../../auth.js';
import { db } from '../../firebase-init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
                    <div class="card" style="margin-bottom: 20px;">
                        <div class="tabs" style="display:flex; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px; overflow-x:auto;">
                            <button class="btn btn-sm btn-primary tab-btn" data-target="tab-personal">Personal Profile</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-health">Health Service</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-performance">Previous Performance</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-academics">Academics</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-activities">Activities</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-meets">Mentorship Meets</button>
                        </div>
                    </div>

                    <form id="booklet-form">
                        <!-- Personal Profile Tab -->
                        <div id="tab-personal" class="tab-content card fade-in">
                            <h3>1. Personal Profile</h3>
                            
                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Basic Information</h4>
                            <div class="grid-2">
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

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Father's Details</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Father's Full Name</label><input type="text" class="form-control" name="personal.fatherName" value="${safe(bookletData.personal?.fatherName)}"></div>
                                <div class="form-group"><label>Occupation</label><input type="text" class="form-control" name="personal.fatherOccupation" value="${safe(bookletData.personal?.fatherOccupation)}"></div>
                                <div class="form-group"><label>Phone (Office)</label><input type="tel" class="form-control" name="personal.fatherPhoneO" value="${safe(bookletData.personal?.fatherPhoneO)}"></div>
                                <div class="form-group"><label>Phone (Residence)</label><input type="tel" class="form-control" name="personal.fatherPhoneR" value="${safe(bookletData.personal?.fatherPhoneR)}"></div>
                                <div class="form-group"><label>Phone (Mobile)</label><input type="tel" class="form-control" name="personal.fatherPhoneM" value="${safe(bookletData.personal?.fatherPhoneM)}"></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Mother's Details</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Mother's Full Name</label><input type="text" class="form-control" name="personal.motherName" value="${safe(bookletData.personal?.motherName)}"></div>
                                <div class="form-group"><label>Occupation</label><input type="text" class="form-control" name="personal.motherOccupation" value="${safe(bookletData.personal?.motherOccupation)}"></div>
                                <div class="form-group"><label>Phone (Office)</label><input type="tel" class="form-control" name="personal.motherPhoneO" value="${safe(bookletData.personal?.motherPhoneO)}"></div>
                                <div class="form-group"><label>Phone (Residence)</label><input type="tel" class="form-control" name="personal.motherPhoneR" value="${safe(bookletData.personal?.motherPhoneR)}"></div>
                                <div class="form-group"><label>Phone (Mobile)</label><input type="tel" class="form-control" name="personal.motherPhoneM" value="${safe(bookletData.personal?.motherPhoneM)}"></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Local Guardian Details</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Name of local guardian</label><input type="text" class="form-control" name="personal.guardianName" value="${safe(bookletData.personal?.guardianName)}"></div>
                                <div class="form-group"><label>Phone Number</label><input type="tel" class="form-control" name="personal.guardianPhone" value="${safe(bookletData.personal?.guardianPhone)}"></div>
                                <div class="form-group"><label>Profession</label><input type="text" class="form-control" name="personal.guardianProfession" value="${safe(bookletData.personal?.guardianProfession)}"></div>
                                <div class="form-group"><label>Relation</label><input type="text" class="form-control" name="personal.guardianRelation" value="${safe(bookletData.personal?.guardianRelation)}"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Address</label><textarea class="form-control" name="personal.guardianAddress">${safe(bookletData.personal?.guardianAddress)}</textarea></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Financial & Address Info</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Annual Income</label><input type="text" class="form-control" name="personal.annualIncome" value="${safe(bookletData.personal?.annualIncome)}"></div>
                                <div class="form-group"><label>Pin Code</label><input type="text" class="form-control" name="personal.pinCode" value="${safe(bookletData.personal?.pinCode)}"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Present Address</label><textarea class="form-control" name="personal.presentAddress">${safe(bookletData.personal?.presentAddress)}</textarea></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Permanent Address</label><textarea class="form-control" name="personal.permanentAddress">${safe(bookletData.personal?.permanentAddress)}</textarea></div>
                            </div>
                        </div>

                        <!-- Health Tab -->
                        <div id="tab-health" class="tab-content card fade-in" hidden>
                            <h3>2. Student's Health Service</h3>
                            
                            <div class="grid-2" style="margin-top:20px;">
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

                            <div class="form-group">
                                <label>Habits (Check all that apply)</label>
                                <div style="display:flex; gap:15px; flex-wrap:wrap; margin-top:5px;">
                                    <label><input type="checkbox" name="health.habitTobacco" ${bookletData.health?.habitTobacco ? 'checked' : ''}> Tobacco Chewing</label>
                                    <label><input type="checkbox" name="health.habitSmoking" ${bookletData.health?.habitSmoking ? 'checked' : ''}> Tobacco Smoking</label>
                                    <label><input type="checkbox" name="health.habitAlcohol" ${bookletData.health?.habitAlcohol ? 'checked' : ''}> Alcohol Consumption</label>
                                    <label><input type="checkbox" name="health.habitPan" ${bookletData.health?.habitPan ? 'checked' : ''}> Pan Parag</label>
                                    <label><input type="checkbox" name="health.habitGutka" ${bookletData.health?.habitGutka ? 'checked' : ''}> Gutka</label>
                                </div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Physical Vitals</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Height (cms)</label><input type="text" class="form-control" name="health.height" value="${safe(bookletData.health?.height)}"></div>
                                <div class="form-group"><label>Weight (K.gm)</label><input type="text" class="form-control" name="health.weight" value="${safe(bookletData.health?.weight)}"></div>
                                <div class="form-group"><label>Pulse</label><input type="text" class="form-control" name="health.pulse" value="${safe(bookletData.health?.pulse)}"></div>
                                <div class="form-group"><label>B.P. (mm of Hg)</label><input type="text" class="form-control" name="health.bp" value="${safe(bookletData.health?.bp)}"></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Complaints (if any)</h4>
                            <div class="grid-2">
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
                            
                            <div class="form-group" style="margin-top:20px;">
                                <label>Medical Officer Certificate / Remarks</label>
                                <textarea class="form-control" name="health.medicalOfficerRemarks">${safe(bookletData.health?.medicalOfficerRemarks)}</textarea>
                            </div>
                        </div>

                        <!-- Performance Record Tab -->
                        <div id="tab-performance" class="tab-content card fade-in" hidden>
                            <h3>3. Performance Record in the Previous Institute</h3>
                            <div class="grid-2" style="margin-top:20px;">
                                <div class="form-group" style="grid-column: span 2;"><label>Qualifying Examination Passed</label><input type="text" class="form-control" name="performance.examPassed" value="${safe(bookletData.performance?.examPassed)}" placeholder="e.g. H.S.C"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>College / Institute previously attended</label><input type="text" class="form-control" name="performance.collegeAttended" value="${safe(bookletData.performance?.collegeAttended)}"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Board / University</label><input type="text" class="form-control" name="performance.board" value="${safe(bookletData.performance?.board)}"></div>
                                <div class="form-group"><label>Month & Year of Passing</label><input type="text" class="form-control" name="performance.passingYear" value="${safe(bookletData.performance?.passingYear)}"></div>
                                <div class="form-group"><label>Class Awarded</label><input type="text" class="form-control" name="performance.classAwarded" value="${safe(bookletData.performance?.classAwarded)}"></div>
                                <div class="form-group"><label>Total Marks obtained (Value / Out of)</label><input type="text" class="form-control" name="performance.totalMarks" value="${safe(bookletData.performance?.totalMarks)}" placeholder="e.g. 450 / 600"></div>
                                <div class="form-group"><label>Total Marks in P.C.M. Group (Value / Out of)</label><input type="text" class="form-control" name="performance.pcmMarks" value="${safe(bookletData.performance?.pcmMarks)}" placeholder="e.g. 221 / 300"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Method of Selection (CET, JEE, MIT-NAT etc) and score</label><input type="text" class="form-control" name="performance.selectionMethod" value="${safe(bookletData.performance?.selectionMethod)}"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Extra Curricular activities (Such as Sports, Drama, Debating etc.)</label><textarea class="form-control" name="performance.extraCurricular">${safe(bookletData.performance?.extraCurricular)}</textarea></div>
                                <div class="form-group" style="grid-column: span 2;"><label>NCC / NSS</label><input type="text" class="form-control" name="performance.ncc" value="${safe(bookletData.performance?.ncc)}"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Scholarships held</label><input type="text" class="form-control" name="performance.scholarships" value="${safe(bookletData.performance?.scholarships)}"></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Other achievements (College, School etc.)</label><textarea class="form-control" name="performance.otherAchievements">${safe(bookletData.performance?.otherAchievements)}</textarea></div>
                            </div>
                        </div>

                        <!-- Academics Tab -->
                        <div id="tab-academics" class="tab-content card fade-in" hidden>
                            <h3>4. Performance Examination Profile (Academic)</h3>
                            <p class="text-muted" style="margin-bottom:15px; font-size:0.9rem;">(Subject marks and attendance are generally updated by your Mentor)</p>
                            
                            <div style="margin-bottom: 15px;">
                                <label>Select Semester to View:</label>
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
                            
                            <div class="table-responsive">
                                <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                    <thead>
                                        <tr style="border-bottom:2px solid var(--border);">
                                            <th>Name of Subject</th>
                                            <th>Date of Passing</th>
                                            <th>Univ. Seat No.</th>
                                            <th>Th</th>
                                            <th>Or/Pr</th>
                                            <th>IA</th>
                                            <th>Total</th>
                                            <th>Result / Remark</th>
                                        </tr>
                                    </thead>
                                    <tbody id="academics-subjects-tbody">
                                        <!-- Dynamic subjects rendered here -->
                                    </tbody>
                                </table>
                            </div>
                            
                            <div style="margin-top: 20px;" class="grid-2">
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

                        <!-- Activities Tab -->
                        <div id="tab-activities" class="tab-content card fade-in" hidden>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <h3>5. Co-Curricular & Extra Curricular Activities</h3>
                                <button type="button" class="btn btn-sm btn-secondary" id="btn-add-activity">Add Activity</button>
                            </div>
                            <div class="table-responsive" style="margin-top:15px;">
                                <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border);">
                                            <th>Activity</th>
                                            <th>Date</th>
                                            <th>Name of Institution</th>
                                            <th>Award / Prize Won</th>
                                            <th style="width:50px;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="activities-tbody">
                                        <!-- Dynamic rows -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Mentorship Meets Tab -->
                        <div id="tab-meets" class="tab-content card fade-in" hidden>
                            <h3>6. Mentorship Meets</h3>
                            <p class="text-muted" style="margin-bottom:15px; font-size:0.9rem;">(Filled by Mentor during/after meetings)</p>
                            <div class="table-responsive">
                                <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border);">
                                            <th>Date of Meeting</th>
                                            <th>Topic of Discussion</th>
                                            <th>Issue / Suggestion</th>
                                            <th>Final Attendance %</th>
                                        </tr>
                                    </thead>
                                    <tbody id="meets-tbody">
                                        <!-- Dynamic rows populated from bookletData.meets -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style="margin-top: 20px; display:flex; justify-content:flex-end;">
                            <button type="submit" class="btn btn-primary btn-lg">Save Booklet Changes</button>
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
                <td style="padding:10px 0;">${safe(sub.name)}</td>
                <td style="padding:10px 0;">${safe(sub.date)}</td>
                <td style="padding:10px 0;">${safe(sub.seatNo)}</td>
                <td style="padding:10px 0;">${safe(sub.th)}</td>
                <td style="padding:10px 0;">${safe(sub.or)}</td>
                <td style="padding:10px 0;">${safe(sub.ia)}</td>
                <td style="padding:10px 0;">${safe(sub.total)}</td>
                <td style="padding:10px 0;">${safe(sub.result)}</td>
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
                <td style="padding:10px 0;"><input type="text" class="form-control" data-idx="${index}" data-field="activity" value="${safe(act.activity)}"></td>
                <td style="padding:10px 0;"><input type="date" class="form-control" data-idx="${index}" data-field="date" value="${safe(act.date)}" style="max-width:140px;"></td>
                <td style="padding:10px 0;"><input type="text" class="form-control" data-idx="${index}" data-field="institution" value="${safe(act.institution)}"></td>
                <td style="padding:10px 0;"><input type="text" class="form-control" data-idx="${index}" data-field="award" value="${safe(act.award)}"></td>
                <td style="padding:10px 0;"><button type="button" class="btn btn-sm btn-secondary delete-act" data-idx="${index}" style="color:var(--danger);">X</button></td>
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
                <td style="padding:10px 0;">${safe(meet.date)}</td>
                <td style="padding:10px 0;">${safe(meet.topic)}</td>
                <td style="padding:10px 0;">${safe(meet.suggestions)}</td>
                <td style="padding:10px 0;">${safe(meet.attendance)}%</td>
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
        btn.textContent = 'Saving...';

        try {
            const formData = new FormData(e.target);
            const updateData = {
                personal: {
                    name: formData.get('personal.name'),
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

            // Preserve academics and meets (Mentors edit these)
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
            btn.textContent = 'Save Booklet Changes';
        }
    });
}
