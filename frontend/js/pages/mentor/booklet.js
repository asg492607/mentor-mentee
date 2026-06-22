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

    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/mentor/booklet')}
            <div class="main-content">
                ${createHeader('Booklet: ' + safe(studentName), user)}
                
                <div class="page-content" style="max-width: 1000px; margin: 0 auto;">
                    <div style="margin-bottom:15px;">
                        <button class="btn btn-secondary btn-sm" onclick="window.history.back()">← Back to Students</button>
                    </div>
                    <div class="card" style="margin-bottom: 20px;">
                        <div class="tabs" style="display:flex; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px; overflow-x:auto;">
                            <button class="btn btn-sm btn-primary tab-btn" data-target="tab-personal">Personal Profile</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-health">Health</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-performance">Previous Records</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-academics">Academics</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-project">Project</button>
                            <button class="btn btn-sm btn-secondary tab-btn" data-target="tab-meets">Mentorship Meets</button>
                        </div>
                    </div>

                    <form id="booklet-form">
                        <!-- Personal Profile Tab (Readonly for mentor) -->
                        <div id="tab-personal" class="tab-content card fade-in">
                            <h3>1. Personal Profile</h3>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Full Name</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.personal?.name)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Date of Birth</label>
                                    <input type="date" class="form-control" value="${safe(bookletData.personal?.dob)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Email ID</label>
                                    <input type="email" class="form-control" value="${safe(bookletData.personal?.email)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Phone Number</label>
                                    <input type="tel" class="form-control" value="${safe(bookletData.personal?.phone)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Class / Year</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.personal?.class)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Religion / Caste / Category</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.personal?.category)}" readonly>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Father's Name, Occupation & Contact</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.personal?.fatherDetails)}" readonly>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Mother's Name, Occupation & Contact</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.personal?.motherDetails)}" readonly>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Local Guardian Name & Contact</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.personal?.guardian)}" readonly>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Permanent Address</label>
                                    <textarea class="form-control" readonly>${safe(bookletData.personal?.address)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Health Tab (Readonly for mentor) -->
                        <div id="tab-health" class="tab-content card fade-in" hidden>
                            <h3>2. Health Service</h3>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Blood Group</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.health?.bloodGroup)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Diet (Veg/Non-Veg)</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.health?.diet)}" readonly>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Specific Health Complaints / Allergies</label>
                                    <textarea class="form-control" readonly>${safe(bookletData.health?.complaints)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Performance Record Tab (Readonly for mentor) -->
                        <div id="tab-performance" class="tab-content card fade-in" hidden>
                            <h3>3. Previous Performance Record</h3>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>HSC / Diploma Marks (%)</label>
                                    <input type="number" class="form-control" value="${safe(bookletData.performance?.hscMarks)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Scholarships Received</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.performance?.scholarships)}" readonly>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Co-Curricular / Extra-Curricular Activities</label>
                                    <textarea class="form-control" readonly>${safe(bookletData.performance?.activities)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Academics Tab (Editable by Mentor) -->
                        <div id="tab-academics" class="tab-content card fade-in" hidden>
                            <h3>4. Academic Performance</h3>
                            <div class="table-responsive">
                                <table style="width:100%; text-align:left; border-collapse:collapse;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border);">
                                            <th>Semester</th>
                                            <th>Overall Attendance (%)</th>
                                            <th>SGPA</th>
                                            <th>Mentor Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody id="academics-tbody">
                                        <!-- Dynamic rows for SEM I to VIII -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Project Tab (Readonly for mentor) -->
                        <div id="tab-project" class="tab-content card fade-in" hidden>
                            <h3>5. Project Work Details</h3>
                            <div class="grid-2">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Title of Project</label>
                                    <input type="text" class="form-control" value="${safe(bookletData.project?.title)}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Project Team Members</label>
                                    <textarea class="form-control" readonly>${safe(bookletData.project?.members)}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>Placement Details / Organisation</label>
                                    <textarea class="form-control" readonly>${safe(bookletData.project?.placement)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Mentorship Meets Tab (Editable by Mentor) -->
                        <div id="tab-meets" class="tab-content card fade-in" hidden>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <h3>6. Mentorship Meets</h3>
                                <button type="button" class="btn btn-sm btn-secondary" id="btn-add-meet">Add Meeting Log</button>
                            </div>
                            <div class="table-responsive" style="margin-top:15px;">
                                <table style="width:100%; text-align:left; border-collapse:collapse;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border);">
                                            <th>Date</th>
                                            <th>Topic of Discussion</th>
                                            <th>Issues / Suggestions</th>
                                            <th style="width:50px;"></th>
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

    // Render Academics Table
    const academicsBody = document.getElementById('academics-tbody');
    const sems = ['SEM I', 'SEM II', 'SEM III', 'SEM IV', 'SEM V', 'SEM VI', 'SEM VII', 'SEM VIII'];
    const academicsData = bookletData.academics || {};
    
    sems.forEach((sem, i) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        const d = academicsData[sem] || {};
        tr.innerHTML = `
            <td style="padding:10px 0;"><strong>${sem}</strong></td>
            <td style="padding:10px 0;"><input type="text" class="form-control" name="academics.${i}.attendance" value="${safe(d.attendance)}" placeholder="-" style="max-width:80px;"></td>
            <td style="padding:10px 0;"><input type="text" class="form-control" name="academics.${i}.sgpa" value="${safe(d.sgpa)}" placeholder="-" style="max-width:80px;"></td>
            <td style="padding:10px 0;"><input type="text" class="form-control" name="academics.${i}.remarks" value="${safe(d.remarks)}" placeholder="-"></td>
        `;
        academicsBody.appendChild(tr);
    });

    // Render Meets Table
    const meetsBody = document.getElementById('meets-tbody');
    let meetsData = bookletData.meets || [];

    function renderMeets() {
        meetsBody.innerHTML = '';
        if (meetsData.length === 0) {
            meetsBody.innerHTML = '<tr><td colspan="4" style="padding:15px 0; text-align:center; color:var(--text-muted);">No meetings logged yet.</td></tr>';
            return;
        }
        meetsData.forEach((meet, index) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding:10px 0;"><input type="date" class="form-control" data-idx="${index}" data-field="date" value="${safe(meet.date)}" style="max-width:140px;"></td>
                <td style="padding:10px 0;"><input type="text" class="form-control" data-idx="${index}" data-field="topic" value="${safe(meet.topic)}"></td>
                <td style="padding:10px 0;"><input type="text" class="form-control" data-idx="${index}" data-field="suggestions" value="${safe(meet.suggestions)}"></td>
                <td style="padding:10px 0;"><button type="button" class="btn btn-sm btn-secondary delete-meet" data-idx="${index}" style="color:var(--danger);">X</button></td>
            `;
            meetsBody.appendChild(tr);
        });

        // Attach listeners for dynamic row inputs
        meetsBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.dataset.idx;
                const field = e.target.dataset.field;
                meetsData[idx][field] = e.target.value;
            });
        });
        meetsBody.querySelectorAll('.delete-meet').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.idx;
                meetsData.splice(idx, 1);
                renderMeets();
            });
        });
    }

    renderMeets();

    document.getElementById('btn-add-meet').addEventListener('click', () => {
        meetsData.push({ date: new Date().toISOString().split('T')[0], topic: '', suggestions: '' });
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
            const formData = new FormData(e.target);
            const updateData = { academics: {}, meets: meetsData };

            sems.forEach((sem, i) => {
                updateData.academics[sem] = {
                    attendance: formData.get(`academics.${i}.attendance`),
                    sgpa: formData.get(`academics.${i}.sgpa`),
                    remarks: formData.get(`academics.${i}.remarks`)
                };
            });

            await setDoc(docRef, updateData, { merge: true });
            
            // Also optionally update the student's main cgpa/attendance stats if needed,
            // but for now saving to booklet is enough.
            
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
