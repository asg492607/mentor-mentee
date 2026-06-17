import { api } from '/js/api.js';
import { navigateTo } from '/js/router.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showLoader, hideLoader } from '/js/components/loader.js';
import { showToast } from '/js/components/toast.js';
import { formatDate, formatDateTime, getInitials } from '/js/utils/helpers.js';
import { formatStatus, formatCGPA, formatPercentage } from '/js/utils/formatters.js';

export async function render(container) {
    const user = getUserProfile();
    
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/student/dashboard')}
            <div class="main-content">
                ${createHeader('Student Dashboard', user)}
                <div class="page-content" id="dashboard-content">
                    <!-- Content will be injected here -->
                </div>
            </div>
        </div>
    `;
    
    const content = document.getElementById('dashboard-content');
    
    try {
        showLoader();
        // Fetch dashboard data
        const res = await api.get('/api/student/dashboard').catch(() => ({
            // Mock data fallback if API is not ready
            stats: { upcomingMeetings: 2, pendingTasks: 4, openIssues: 1, cgpa: 8.5 },
            mentor: { name: 'Dr. Jane Smith', department: 'Computer Science', email: 'jane@example.com' },
            upcomingMeetings: [
                { id: 1, type: 'Academic', date: new Date(Date.now() + 86400000).toISOString(), status: 'Approved' }
            ],
            recentTasks: [
                { id: 1, description: 'Submit project proposal', deadline: new Date(Date.now() + 172800000).toISOString(), progress: 50 }
            ],
            academicStatus: { attendance: 85, totalCredits: 60 }
        }));
        
        hideLoader();
        
        content.innerHTML = `
            <div class="stats-row grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Upcoming Meetings</h3>
                    <p class="text-2xl font-bold">${res.stats?.upcomingMeetings || 0}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Pending Tasks</h3>
                    <p class="text-2xl font-bold">${res.stats?.pendingTasks || 0}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Open Issues</h3>
                    <p class="text-2xl font-bold">${res.stats?.openIssues || 0}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">CGPA</h3>
                    <p class="text-2xl font-bold">${formatCGPA(res.stats?.cgpa || 0)}</p>
                </div>
            </div>
            
            <div class="dashboard-grid grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- My Mentor -->
                <div class="card card-glass col-span-1">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 class="font-bold">My Mentor</h2>
                    </div>
                    <div class="p-4 text-center">
                        <div class="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl mx-auto mb-4">
                            ${getInitials(res.mentor?.name)}
                        </div>
                        <h3 class="font-bold text-lg">${res.mentor?.name || 'Unassigned'}</h3>
                        <p class="text-muted mb-1">${res.mentor?.department || ''}</p>
                        <p class="text-sm text-muted mb-4">${res.mentor?.email || ''}</p>
                        <button class="btn btn-primary w-full" id="btn-request-meeting">Request Meeting</button>
                    </div>
                </div>
                
                <!-- Upcoming Meetings -->
                <div class="card card-glass col-span-1 md:col-span-2">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h2 class="font-bold">Upcoming Meetings</h2>
                        <a href="#/student/meetings" class="text-sm text-primary">View All</a>
                    </div>
                    <div class="p-0">
                        ${(res.upcomingMeetings || []).length === 0 ? '<p class="p-4 text-muted">No upcoming meetings.</p>' : `
                            <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                                ${res.upcomingMeetings.map(m => `
                                    <li class="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <div>
                                            <p class="font-semibold">${m.type} Discussion</p>
                                            <p class="text-sm text-muted">${formatDateTime(m.date)}</p>
                                        </div>
                                        <div>
                                            ${formatStatus(m.status)}
                                            ${m.status === 'Approved' ? `<button class="btn btn-sm btn-primary ml-2 join-meeting-btn" data-id="${m.id}">Join</button>` : ''}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        `}
                    </div>
                </div>
                
                <!-- Recent Action Items -->
                <div class="card card-glass col-span-1 md:col-span-2">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h2 class="font-bold">Recent Tasks</h2>
                        <a href="#/student/tasks" class="text-sm text-primary">View All</a>
                    </div>
                    <div class="p-4">
                        ${(res.recentTasks || []).length === 0 ? '<p class="text-muted">No tasks assigned.</p>' : `
                            <div class="space-y-4">
                                ${res.recentTasks.map(t => `
                                    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                        <div class="flex justify-between items-start mb-2">
                                            <p class="font-medium">${t.description}</p>
                                            <span class="text-xs text-muted">Due: ${formatDate(t.deadline)}</span>
                                        </div>
                                        ${formatPercentage(t.progress)}
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Academic Status -->
                <div class="card card-glass col-span-1">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 class="font-bold">Academic Status</h2>
                    </div>
                    <div class="p-4 space-y-4">
                        <div>
                            <p class="text-sm text-muted mb-1">Attendance</p>
                            ${formatPercentage(res.academicStatus?.attendance || 0)}
                        </div>
                        <div>
                            <p class="text-sm text-muted mb-1">Total Credits Completed</p>
                            <p class="text-xl font-bold">${res.academicStatus?.totalCredits || 0}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Events
        document.getElementById('btn-request-meeting')?.addEventListener('click', () => {
            navigateTo('/student/meetings');
        });
        
        document.querySelectorAll('.join-meeting-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                navigateTo(`/meeting-room?id=${id}`);
            });
        });
        
    } catch (err) {
        hideLoader();
        showToast('Failed to load dashboard data', 'error');
        content.innerHTML = '<p class="text-danger p-4">Error loading dashboard.</p>';
    }
}
