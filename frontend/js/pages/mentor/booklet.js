import { getUserProfile } from '../../auth.js';
import { db } from '../../firebase-init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast } from '../../components/toast.js';
import { createSidebar } from '../../components/sidebar.js';
import { createHeader } from '../../components/header.js';

export async function render(container) {
    const user = getUserProfile();
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const studentId = params.get('studentId');
    
    if (!studentId) {
        showToast('No student selected', 'error');
        window.location.hash = '/mentor/students';
        return;
    }

    const docRef = doc(db, 'booklets', studentId);
    let bookletData = {};
    let studentName = 'Student';
    
    try {
        const studentSnap = await getDoc(doc(db, 'students', studentId));
        if (studentSnap.exists()) {
            studentName = studentSnap.data().name || 'Student';
        }

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
            ${createSidebar(user.role, '/mentor/booklet')}
            <div class="main-content">
                ${createHeader('Booklet: ' + safe(studentName), user)}
                
                <div class="page-content" style="max-width: 1200px; margin: 0 auto;">
                    <div style="margin-bottom:15px;">
                        <button class="btn btn-secondary btn-sm" onclick="window.history.back()">← Back to Students</button>
                    </div>
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
                        <!-- Personal Profile Tab (Readonly for Mentor) -->
                        <div id="tab-personal" class="tab-content card fade-in">
                            <h3>1. Personal Profile</h3>
                            
                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Basic Information</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Name of the Student</label><input type="text" class="form-control" value="${safe(bookletData.personal?.name)}" readonly></div>
                                <div class="form-group"><label>Year of Admission</label><input type="text" class="form-control" value="${safe(bookletData.personal?.admissionYear)}" readonly></div>
                                <div class="form-group"><label>Class</label><input type="text" class="form-control" value="${safe(bookletData.personal?.class)}" readonly></div>
                                <div class="form-group"><label>E-mail ID</label><input type="email" class="form-control" value="${safe(bookletData.personal?.email)}" readonly></div>
                                <div class="form-group"><label>Date of Birth</label><input type="date" class="form-control" value="${safe(bookletData.personal?.dob)}" readonly></div>
                                <div class="form-group"><label>Place of Birth</label><input type="text" class="form-control" value="${safe(bookletData.personal?.placeOfBirth)}" readonly></div>
                                <div class="form-group"><label>State</label><input type="text" class="form-control" value="${safe(bookletData.personal?.state)}" readonly></div>
                                <div class="form-group"><label>Nationality</label><input type="text" class="form-control" value="${safe(bookletData.personal?.nationality)}" readonly></div>
                                <div class="form-group"><label>Religion</label><input type="text" class="form-control" value="${safe(bookletData.personal?.religion)}" readonly></div>
                                <div class="form-group"><label>Category</label><input type="text" class="form-control" value="${safe(bookletData.personal?.category)}" readonly></div>
                                <div class="form-group"><label>Caste</label><input type="text" class="form-control" value="${safe(bookletData.personal?.caste)}" readonly></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Father's Details</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Father's Full Name</label><input type="text" class="form-control" value="${safe(bookletData.personal?.fatherName)}" readonly></div>
                                <div class="form-group"><label>Occupation</label><input type="text" class="form-control" value="${safe(bookletData.personal?.fatherOccupation)}" readonly></div>
                                <div class="form-group"><label>Phone (Office)</label><input type="tel" class="form-control" value="${safe(bookletData.personal?.fatherPhoneO)}" readonly></div>
                                <div class="form-group"><label>Phone (Residence)</label><input type="tel" class="form-control" value="${safe(bookletData.personal?.fatherPhoneR)}" readonly></div>
                                <div class="form-group"><label>Phone (Mobile)</label><input type="tel" class="form-control" value="${safe(bookletData.personal?.fatherPhoneM)}" readonly></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Mother's Details</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Mother's Full Name</label><input type="text" class="form-control" value="${safe(bookletData.personal?.motherName)}" readonly></div>
                                <div class="form-group"><label>Occupation</label><input type="text" class="form-control" value="${safe(bookletData.personal?.motherOccupation)}" readonly></div>
                                <div class="form-group"><label>Phone (Office)</label><input type="tel" class="form-control" value="${safe(bookletData.personal?.motherPhoneO)}" readonly></div>
                                <div class="form-group"><label>Phone (Residence)</label><input type="tel" class="form-control" value="${safe(bookletData.personal?.motherPhoneR)}" readonly></div>
                                <div class="form-group"><label>Phone (Mobile)</label><input type="tel" class="form-control" value="${safe(bookletData.personal?.motherPhoneM)}" readonly></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Local Guardian Details</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Name of local guardian</label><input type="text" class="form-control" value="${safe(bookletData.personal?.guardianName)}" readonly></div>
                                <div class="form-group"><label>Phone Number</label><input type="tel" class="form-control" value="${safe(bookletData.personal?.guardianPhone)}" readonly></div>
                                <div class="form-group"><label>Profession</label><input type="text" class="form-control" value="${safe(bookletData.personal?.guardianProfession)}" readonly></div>
                                <div class="form-group"><label>Relation</label><input type="text" class="form-control" value="${safe(bookletData.personal?.guardianRelation)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Address</label><textarea class="form-control" readonly>${safe(bookletData.personal?.guardianAddress)}</textarea></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Financial & Address Info</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Annual Income</label><input type="text" class="form-control" value="${safe(bookletData.personal?.annualIncome)}" readonly></div>
                                <div class="form-group"><label>Pin Code</label><input type="text" class="form-control" value="${safe(bookletData.personal?.pinCode)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Present Address</label><textarea class="form-control" readonly>${safe(bookletData.personal?.presentAddress)}</textarea></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Permanent Address</label><textarea class="form-control" readonly>${safe(bookletData.personal?.permanentAddress)}</textarea></div>
                            </div>
                        </div>

                        <!-- Health Tab (Readonly for Mentor) -->
                        <div id="tab-health" class="tab-content card fade-in" hidden>
                            <h3>2. Student's Health Service</h3>
                            
                            <div class="grid-2" style="margin-top:20px;">
                                <div class="form-group"><label>Diet</label><input type="text" class="form-control" value="${safe(bookletData.health?.diet)}" readonly></div>
                                <div class="form-group"><label>Exercise</label><input type="text" class="form-control" value="${safe(bookletData.health?.exercise)}" readonly></div>
                            </div>

                            <div class="form-group">
                                <label>Habits (Check all that apply)</label>
                                <div style="display:flex; gap:15px; flex-wrap:wrap; margin-top:5px;">
                                    <label><input type="checkbox" disabled ${bookletData.health?.habitTobacco ? 'checked' : ''}> Tobacco Chewing</label>
                                    <label><input type="checkbox" disabled ${bookletData.health?.habitSmoking ? 'checked' : ''}> Tobacco Smoking</label>
                                    <label><input type="checkbox" disabled ${bookletData.health?.habitAlcohol ? 'checked' : ''}> Alcohol Consumption</label>
                                    <label><input type="checkbox" disabled ${bookletData.health?.habitPan ? 'checked' : ''}> Pan Parag</label>
                                    <label><input type="checkbox" disabled ${bookletData.health?.habitGutka ? 'checked' : ''}> Gutka</label>
                                </div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Physical Vitals</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Height (cms)</label><input type="text" class="form-control" value="${safe(bookletData.health?.height)}" readonly></div>
                                <div class="form-group"><label>Weight (K.gm)</label><input type="text" class="form-control" value="${safe(bookletData.health?.weight)}" readonly></div>
                                <div class="form-group"><label>Pulse</label><input type="text" class="form-control" value="${safe(bookletData.health?.pulse)}" readonly></div>
                                <div class="form-group"><label>B.P. (mm of Hg)</label><input type="text" class="form-control" value="${safe(bookletData.health?.bp)}" readonly></div>
                            </div>

                            <h4 style="margin-top:20px; border-bottom:1px solid var(--border); padding-bottom:5px;">Complaints (if any)</h4>
                            <div class="grid-2">
                                <div class="form-group"><label>Menstrual History (females)</label><input type="text" class="form-control" value="${safe(bookletData.health?.menstrual)}" readonly></div>
                                <div class="form-group"><label>Males specific</label><input type="text" class="form-control" value="${safe(bookletData.health?.malesComplaints)}" readonly></div>
                                <div class="form-group"><label>C.V.S.</label><input type="text" class="form-control" value="${safe(bookletData.health?.cvs)}" readonly></div>
                                <div class="form-group"><label>R.S.</label><input type="text" class="form-control" value="${safe(bookletData.health?.rs)}" readonly></div>
                                <div class="form-group"><label>P/A</label><input type="text" class="form-control" value="${safe(bookletData.health?.pa)}" readonly></div>
                                <div class="form-group"><label>SKIN</label><input type="text" class="form-control" value="${safe(bookletData.health?.skin)}" readonly></div>
                                <div class="form-group"><label>EAR</label><input type="text" class="form-control" value="${safe(bookletData.health?.ear)}" readonly></div>
                                <div class="form-group"><label>NOSE</label><input type="text" class="form-control" value="${safe(bookletData.health?.nose)}" readonly></div>
                                <div class="form-group"><label>THROAT</label><input type="text" class="form-control" value="${safe(bookletData.health?.throat)}" readonly></div>
                                <div class="form-group"><label>EYES</label><input type="text" class="form-control" value="${safe(bookletData.health?.eyes)}" readonly></div>
                                <div class="form-group" style="grid-column:span 2;"><label>TEETH & GUMS</label><input type="text" class="form-control" value="${safe(bookletData.health?.teeth)}" readonly></div>
                            </div>
                            
                            <div class="form-group" style="margin-top:20px;">
                                <label>Medical Officer Certificate / Remarks</label>
                                <textarea class="form-control" readonly>${safe(bookletData.health?.medicalOfficerRemarks)}</textarea>
                            </div>
                        </div>

                        <!-- Performance Record Tab (Readonly for Mentor) -->
                        <div id="tab-performance" class="tab-content card fade-in" hidden>
                            <h3>3. Performance Record in the Previous Institute</h3>
                            <div class="grid-2" style="margin-top:20px;">
                                <div class="form-group" style="grid-column: span 2;"><label>Qualifying Examination Passed</label><input type="text" class="form-control" value="${safe(bookletData.performance?.examPassed)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>College / Institute previously attended</label><input type="text" class="form-control" value="${safe(bookletData.performance?.collegeAttended)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Board / University</label><input type="text" class="form-control" value="${safe(bookletData.performance?.board)}" readonly></div>
                                <div class="form-group"><label>Month & Year of Passing</label><input type="text" class="form-control" value="${safe(bookletData.performance?.passingYear)}" readonly></div>
                                <div class="form-group"><label>Class Awarded</label><input type="text" class="form-control" value="${safe(bookletData.performance?.classAwarded)}" readonly></div>
                                <div class="form-group"><label>Total Marks obtained</label><input type="text" class="form-control" value="${safe(bookletData.performance?.totalMarks)}" readonly></div>
                                <div class="form-group"><label>Total Marks in P.C.M. Group</label><input type="text" class="form-control" value="${safe(bookletData.performance?.pcmMarks)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Method of Selection</label><input type="text" class="form-control" value="${safe(bookletData.performance?.selectionMethod)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Extra Curricular activities</label><textarea class="form-control" readonly>${safe(bookletData.performance?.extraCurricular)}</textarea></div>
                                <div class="form-group" style="grid-column: span 2;"><label>NCC / NSS</label><input type="text" class="form-control" value="${safe(bookletData.performance?.ncc)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Scholarships held</label><input type="text" class="form-control" value="${safe(bookletData.performance?.scholarships)}" readonly></div>
                                <div class="form-group" style="grid-column: span 2;"><label>Other achievements</label><textarea class="form-control" readonly>${safe(bookletData.performance?.otherAchievements)}</textarea></div>
                            </div>
                        </div>

                        <!-- Academics Tab (Editable by Mentor) -->
                        <div id="tab-academics" class="tab-content card fade-in" hidden>
                            <h3>4. Performance Examination Profile (Academic)</h3>
                            
                            <div style="margin-bottom: 15px; display:flex; gap:10px; align-items:flex-end;">
                                <div style="flex:1; max-width:200px;">
                                    <label>Select Semester to View/Edit:</label>
                                    <select class="form-control" id="academic-sem-select">
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
                                <button type="button" class="btn btn-sm btn-secondary" id="btn-add-subject">Add Subject Row</button>
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
                                            <th style="width:40px;"></th>
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
                                    <input type="text" class="form-control" id="academic-class">
                                </div>
                                <div class="form-group">
                                    <label>Total Backlogs</label>
                                    <input type="text" class="form-control" id="academic-backlogs">
                                </div>
                            </div>
                        </div>

                        <!-- Activities Tab (Readonly for Mentor) -->
                        <div id="tab-activities" class="tab-content card fade-in" hidden>
                            <h3>5. Co-Curricular & Extra Curricular Activities</h3>
                            <div class="table-responsive" style="margin-top:15px;">
                                <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border);">
                                            <th>Activity</th>
                                            <th>Date</th>
                                            <th>Name of Institution</th>
                                            <th>Award / Prize Won</th>
                                        </tr>
                                    </thead>
                                    <tbody id="activities-tbody">
                                        <!-- Dynamic rows -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Mentorship Meets Tab (Editable by Mentor) -->
                        <div id="tab-meets" class="tab-content card fade-in" hidden>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <h3>6. Mentorship Meets</h3>
                                <button type="button" class="btn btn-sm btn-secondary" id="btn-add-meet">Add Meeting Log</button>
                            </div>
                            <div class="table-responsive" style="margin-top:15px;">
                                <table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.9rem;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border);">
                                            <th>Date of Meeting</th>
                                            <th>Topic of Discussion</th>
                                            <th>Issue / Suggestion</th>
                                            <th>Final Attendance %</th>
                                            <th style="width:40px;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="meets-tbody">
                                        <!-- Dynamic rows -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div id="save-bar" style="margin-top: 20px; display:none; justify-content:flex-end;">
                            <button type="submit" class="btn btn-primary btn-lg">Save Mentor Logs</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Render Academics logic (Editable for Mentor)
    let academicsData = bookletData.academics || {};
    const semSelect = document.getElementById('academic-sem-select');
    const acadTbody = document.getElementById('academics-subjects-tbody');
    const acadClass = document.getElementById('academic-class');
    const acadBacklogs = document.getElementById('academic-backlogs');
    let currentSem = 'SEM I';

    function renderAcademicsForSem(sem) {
        currentSem = sem;
        acadTbody.innerHTML = '';
        if (!academicsData[sem]) {
            academicsData[sem] = { subjects: [], classAwarded: '', backlogs: '' };
        }
        const data = academicsData[sem];
        acadClass.value = data.classAwarded || '';
        acadBacklogs.value = data.backlogs || '';
        
        if (data.subjects.length === 0) {
            acadTbody.innerHTML = '<tr><td colspan="9" style="padding:15px 0; text-align:center; color:var(--text-muted);">No subjects added yet. Click "Add Subject Row".</td></tr>';
        } else {
            data.subjects.forEach((sub, idx) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.innerHTML = `
                    <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${idx}" data-field="name" value="${safe(sub.name)}" style="min-width:120px;"></td>
                    <td style="padding:10px 2px;"><input type="date" class="form-control" data-idx="${idx}" data-field="date" value="${safe(sub.date)}"></td>
                    <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${idx}" data-field="seatNo" value="${safe(sub.seatNo)}"></td>
                    <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${idx}" data-field="th" value="${safe(sub.th)}" style="max-width:50px;"></td>
                    <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${idx}" data-field="or" value="${safe(sub.or)}" style="max-width:50px;"></td>
                    <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${idx}" data-field="ia" value="${safe(sub.ia)}" style="max-width:50px;"></td>
                    <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${idx}" data-field="total" value="${safe(sub.total)}" style="max-width:60px;"></td>
                    <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${idx}" data-field="result" value="${safe(sub.result)}"></td>
                    <td style="padding:10px 2px;"><button type="button" class="btn btn-sm btn-secondary delete-sub" data-idx="${idx}" style="color:var(--danger);">X</button></td>
                `;
                acadTbody.appendChild(tr);
            });

            acadTbody.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', (e) => {
                    academicsData[currentSem].subjects[e.target.dataset.idx][e.target.dataset.field] = e.target.value;
                });
            });
            acadTbody.querySelectorAll('.delete-sub').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    academicsData[currentSem].subjects.splice(e.target.dataset.idx, 1);
                    renderAcademicsForSem(currentSem);
                });
            });
        }
    }
    
    semSelect.addEventListener('change', (e) => renderAcademicsForSem(e.target.value));
    renderAcademicsForSem('SEM I'); // Initial render

    document.getElementById('btn-add-subject').addEventListener('click', () => {
        academicsData[currentSem].subjects.push({ name: '', date: '', seatNo: '', th: '', or: '', ia: '', total: '', result: '' });
        renderAcademicsForSem(currentSem);
    });

    acadClass.addEventListener('input', (e) => academicsData[currentSem].classAwarded = e.target.value);
    acadBacklogs.addEventListener('input', (e) => academicsData[currentSem].backlogs = e.target.value);

    // Render Activities Table (Readonly for Mentor)
    const activitiesBody = document.getElementById('activities-tbody');
    let activitiesData = bookletData.activities || [];
    if (activitiesData.length === 0) {
        activitiesBody.innerHTML = '<tr><td colspan="4" style="padding:15px 0; text-align:center; color:var(--text-muted);">No activities logged yet.</td></tr>';
    } else {
        activitiesData.forEach(act => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding:10px 0;">${safe(act.activity)}</td>
                <td style="padding:10px 0;">${safe(act.date)}</td>
                <td style="padding:10px 0;">${safe(act.institution)}</td>
                <td style="padding:10px 0;">${safe(act.award)}</td>
            `;
            activitiesBody.appendChild(tr);
        });
    }

    // Render Meets Table (Editable for Mentor)
    const meetsBody = document.getElementById('meets-tbody');
    let meetsData = bookletData.meets || [];

    function renderMeets() {
        meetsBody.innerHTML = '';
        if (meetsData.length === 0) {
            meetsBody.innerHTML = '<tr><td colspan="5" style="padding:15px 0; text-align:center; color:var(--text-muted);">No meetings logged yet.</td></tr>';
            return;
        }
        meetsData.forEach((meet, index) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding:10px 2px;"><input type="date" class="form-control" data-idx="${index}" data-field="date" value="${safe(meet.date)}"></td>
                <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${index}" data-field="topic" value="${safe(meet.topic)}"></td>
                <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${index}" data-field="suggestions" value="${safe(meet.suggestions)}"></td>
                <td style="padding:10px 2px;"><input type="text" class="form-control" data-idx="${index}" data-field="attendance" value="${safe(meet.attendance)}" style="max-width:80px;"></td>
                <td style="padding:10px 2px;"><button type="button" class="btn btn-sm btn-secondary delete-meet" data-idx="${index}" style="color:var(--danger);">X</button></td>
            `;
            meetsBody.appendChild(tr);
        });

        meetsBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                meetsData[e.target.dataset.idx][e.target.dataset.field] = e.target.value;
            });
        });
        meetsBody.querySelectorAll('.delete-meet').forEach(btn => {
            btn.addEventListener('click', (e) => {
                meetsData.splice(e.target.dataset.idx, 1);
                renderMeets();
            });
        });
    }

    renderMeets();

    document.getElementById('btn-add-meet').addEventListener('click', () => {
        meetsData.push({ date: new Date().toISOString().split('T')[0], topic: '', suggestions: '', attendance: '' });
        renderMeets();
    });

    // Tab Switching Logic
    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');
    const saveBar = document.getElementById('save-bar');
    
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
            const targetId = tab.dataset.target;
            document.getElementById(targetId).hidden = false;

            // Show save button only on editable tabs
            if (targetId === 'tab-academics' || targetId === 'tab-meets') {
                saveBar.style.display = 'flex';
            } else {
                saveBar.style.display = 'none';
            }
        });
    });

    // Form Submission
    document.getElementById('booklet-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            // Mentor only updates academics and meets. Rest is preserved.
            const updateData = { 
                academics: academicsData, 
                meets: meetsData 
            };

            await setDoc(docRef, updateData, { merge: true });
            showToast('Mentor logs saved successfully!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to save logs: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Mentor Logs';
        }
    });
}
