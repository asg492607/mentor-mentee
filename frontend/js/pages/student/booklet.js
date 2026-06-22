import { getUserProfile } from '../../auth.js';
import { db } from '../../firebase-init.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast } from '../../components/toast.js';

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

    container.innerHTML = `
        <div class="layout">
            <aside class="sidebar">
                <div class="sidebar-header">
                    <h2>MentorOS</h2>
                </div>
                <nav class="sidebar-nav">
                    <a href="#/student/dashboard" class="sidebar-item">Dashboard</a>
                    <a href="#/student/booklet" class="sidebar-item active">Mentorship Booklet</a>
                    <a href="#/student/meetings" class="sidebar-item">Meetings</a>
                </nav>
            </aside>
            <main class="main-content">
                <header class="topbar">
                    <div class="topbar-search">
                        <h2 style="margin:0;">Digital Mentorship Booklet</h2>
                    </div>
                </header>
                
                <div class="dashboard-content" style="max-width: 1000px; margin: 0 auto;">
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
                        <!-- Personal Profile Tab -->
                        <div id="tab-personal" class="tab-content card">
                            <h3>1. Personal Profile</h3>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Full Name</label>
                                    <input type="text" class="form-control" name="personal.name" value="${safe(bookletData.personal?.name || user.name)}">
                                </div>
                                <div class="form-group">
                                    <label>Date of Birth</label>
                                    <input type="date" class="form-control" name="personal.dob" value="${safe(bookletData.personal?.dob)}">
                                </div>
                                <div class="form-group">
                                    <label>Class / Year</label>
                                    <input type="text" class="form-control" name="personal.class" value="${safe(bookletData.personal?.class)}">
                                </div>
                                <div class="form-group">
                                    <label>Category</label>
                                    <input type="text" class="form-control" name="personal.category" value="${safe(bookletData.personal?.category)}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Local Guardian Name & Contact</label>
                                    <input type="text" class="form-control" name="personal.guardian" value="${safe(bookletData.personal?.guardian)}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Permanent Address</label>
                                    <textarea class="form-control" name="personal.address">${safe(bookletData.personal?.address)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Health Tab -->
                        <div id="tab-health" class="tab-content card" hidden>
                            <h3>2. Health Service</h3>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Blood Group</label>
                                    <input type="text" class="form-control" name="health.bloodGroup" value="${safe(bookletData.health?.bloodGroup)}">
                                </div>
                                <div class="form-group">
                                    <label>Diet (Veg/Non-Veg)</label>
                                    <input type="text" class="form-control" name="health.diet" value="${safe(bookletData.health?.diet)}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Specific Health Complaints / Allergies</label>
                                    <textarea class="form-control" name="health.complaints">${safe(bookletData.health?.complaints)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Performance Record Tab -->
                        <div id="tab-performance" class="tab-content card" hidden>
                            <h3>3. Previous Performance Record</h3>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>HSC / Diploma Marks (%)</label>
                                    <input type="number" class="form-control" name="performance.hscMarks" value="${safe(bookletData.performance?.hscMarks)}">
                                </div>
                                <div class="form-group">
                                    <label>Scholarships Received</label>
                                    <input type="text" class="form-control" name="performance.scholarships" value="${safe(bookletData.performance?.scholarships)}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Co-Curricular / Extra-Curricular Activities</label>
                                    <textarea class="form-control" name="performance.activities">${safe(bookletData.performance?.activities)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Academics Tab -->
                        <div id="tab-academics" class="tab-content card" hidden>
                            <h3>4. Academic Performance</h3>
                            <p class="text-muted" style="margin-bottom:15px; font-size:0.9rem;">(Unit Test marks and Attendance are generally updated by your Mentor)</p>
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

                        <!-- Project Tab -->
                        <div id="tab-project" class="tab-content card" hidden>
                            <h3>5. Project Work Details</h3>
                            <div class="grid-2">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Title of Project</label>
                                    <input type="text" class="form-control" name="project.title" value="${safe(bookletData.project?.title)}">
                                </div>
                                <div class="form-group">
                                    <label>Project Team Members</label>
                                    <textarea class="form-control" name="project.members">${safe(bookletData.project?.members)}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>Placement Details / Organisation</label>
                                    <textarea class="form-control" name="project.placement">${safe(bookletData.project?.placement)}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Mentorship Meets Tab -->
                        <div id="tab-meets" class="tab-content card" hidden>
                            <h3>6. Mentorship Meets</h3>
                            <p class="text-muted" style="margin-bottom:15px; font-size:0.9rem;">(Filled by Mentor during/after meetings)</p>
                            <div class="table-responsive">
                                <table style="width:100%; text-align:left; border-collapse:collapse;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border);">
                                            <th>Date</th>
                                            <th>Topic of Discussion</th>
                                            <th>Issues / Suggestions</th>
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
            </main>
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
            <td style="padding:10px 0;"><input type="text" class="form-control" name="academics.${i}.attendance" value="${safe(d.attendance)}" placeholder="-" style="max-width:80px;" readonly></td>
            <td style="padding:10px 0;"><input type="text" class="form-control" name="academics.${i}.sgpa" value="${safe(d.sgpa)}" placeholder="-" style="max-width:80px;" readonly></td>
            <td style="padding:10px 0;"><input type="text" class="form-control" name="academics.${i}.remarks" value="${safe(d.remarks)}" placeholder="-" readonly></td>
        `;
        academicsBody.appendChild(tr);
    });

    // Render Meets Table (Readonly for student, just display)
    const meetsBody = document.getElementById('meets-tbody');
    const meetsData = bookletData.meets || [];
    if (meetsData.length === 0) {
        meetsBody.innerHTML = '<tr><td colspan="3" style="padding:15px 0; text-align:center; color:var(--text-muted);">No meetings logged yet.</td></tr>';
    } else {
        meetsData.forEach(meet => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            tr.innerHTML = `
                <td style="padding:10px 0;">${safe(meet.date)}</td>
                <td style="padding:10px 0;">${safe(meet.topic)}</td>
                <td style="padding:10px 0;">${safe(meet.suggestions)}</td>
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
                    dob: formData.get('personal.dob'),
                    class: formData.get('personal.class'),
                    category: formData.get('personal.category'),
                    guardian: formData.get('personal.guardian'),
                    address: formData.get('personal.address')
                },
                health: {
                    bloodGroup: formData.get('health.bloodGroup'),
                    diet: formData.get('health.diet'),
                    complaints: formData.get('health.complaints')
                },
                performance: {
                    hscMarks: formData.get('performance.hscMarks'),
                    scholarships: formData.get('performance.scholarships'),
                    activities: formData.get('performance.activities')
                },
                project: {
                    title: formData.get('project.title'),
                    members: formData.get('project.members'),
                    placement: formData.get('project.placement')
                },
                academics: {}
            };

            // Preserve academics and meets (since students don't write them)
            updateData.academics = bookletData.academics || {};
            updateData.meets = bookletData.meets || [];

            await setDoc(docRef, updateData, { merge: true });
            bookletData = updateData; // update local cache
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
