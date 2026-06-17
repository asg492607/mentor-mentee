import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { db } from '/js/firebase-init.js';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast } from '/js/components/toast.js';
import { showLoader, hideLoader } from '/js/components/loader.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/dean/dashboard')}
            <div class="main-content">
                ${createHeader('Dean Dashboard', user)}
                <div class="page-content" id="dean-dashboard-content">
                    <!-- Dashboard content loaded asynchronously -->
                </div>
            </div>
        </div>
    `;
    
    const content = document.getElementById('dean-dashboard-content');
    await loadDeanDashboard(content);
}

async function loadDeanDashboard(content) {
    try {
        showLoader();
        
        // Fetch pending faculty
        const pendingQuery = query(collection(db, 'faculty'), where('status', '==', 'pending'));
        const pendingSnapshot = await getDocs(pendingQuery);
        const pendingTeachers = [];
        pendingSnapshot.forEach(doc => {
            pendingTeachers.push({ id: doc.id, ...doc.data() });
        });
        
        // Fetch approved faculty count
        const approvedQuery = query(collection(db, 'faculty'), where('status', '==', 'approved'));
        const approvedSnapshot = await getDocs(approvedQuery);
        const approvedCount = approvedSnapshot.size;
        
        hideLoader();
        
        content.innerHTML = `
            <div class="stats-row grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Pending Teacher Requests</h3>
                    <p class="text-2xl font-bold text-accent" id="pending-count">${pendingTeachers.length}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Approved Teachers</h3>
                    <p class="text-2xl font-bold text-success">${approvedCount}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Portal Role</h3>
                    <p class="text-2xl font-bold text-primary">Dean</p>
                </div>
            </div>
            
            <div class="card card-glass mb-6">
                <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="font-bold text-lg">Pending Teacher Approvals</h2>
                    <p class="text-muted text-xs mt-1">Review registrations from university faculty members before they can log in.</p>
                </div>
                <div class="p-0 overflow-x-auto">
                    ${pendingTeachers.length === 0 ? `
                        <div class="p-8 text-center">
                            <p class="text-muted">No pending teacher registration requests at this time.</p>
                        </div>
                    ` : `
                        <table class="w-full text-left border-collapse" style="min-width: 600px;">
                            <thead>
                                <tr class="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-muted uppercase border-b border-gray-200 dark:border-gray-700">
                                    <th class="p-4">Name</th>
                                    <th class="p-4">Email</th>
                                    <th class="p-4">Department</th>
                                    <th class="p-4">Designation</th>
                                    <th class="p-4">Employee ID</th>
                                    <th class="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                ${pendingTeachers.map(teacher => `
                                    <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                        <td class="p-4 font-medium">${teacher.name}</td>
                                        <td class="p-4 text-secondary">${teacher.email}</td>
                                        <td class="p-4">${teacher.department}</td>
                                        <td class="p-4">
                                            <span class="badge" style="background: rgba(59, 130, 246, 0.1); color: rgb(59, 130, 246); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">${teacher.designation || 'Faculty'}</span>
                                        </td>
                                        <td class="p-4 text-xs font-mono text-muted">${teacher.employeeId || 'N/A'}</td>
                                        <td class="p-4 text-right">
                                            <button class="btn btn-sm btn-success mr-2 approve-btn" data-id="${teacher.id}" style="padding: 4px 8px; font-size: 0.8rem; background-color: var(--success); color: white; border: none; border-radius: 4px; cursor: pointer;">Approve</button>
                                            <button class="btn btn-sm btn-danger reject-btn" data-id="${teacher.id}" style="padding: 4px 8px; font-size: 0.8rem; background-color: var(--danger); color: white; border: none; border-radius: 4px; cursor: pointer;">Reject</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
        
        // Add button event listeners
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await handleApproval(id, true, content);
            });
        });
        
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await handleApproval(id, false, content);
            });
        });
        
    } catch (err) {
        hideLoader();
        console.error("Dean dashboard load error:", err);
        showToast('Failed to load dashboard data', 'error');
        content.innerHTML = '<p class="text-danger p-4">Error loading registrations dashboard.</p>';
    }
}

async function handleApproval(teacherId, approve, content) {
    try {
        showLoader();
        const docRef = doc(db, 'faculty', teacherId);
        
        if (approve) {
            await updateDoc(docRef, {
                status: 'approved',
                isApproved: true,
                updatedAt: new Date().toISOString()
            });
            showToast('Teacher registration approved!', 'success');
        } else {
            await deleteDoc(docRef);
            showToast('Teacher registration rejected.', 'info');
        }
        
        // Reload dashboard
        await loadDeanDashboard(content);
    } catch (error) {
        hideLoader();
        console.error("Approval action error:", error);
        showToast('Failed to update teacher status', 'error');
    }
}
