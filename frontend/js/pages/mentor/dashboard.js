import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showLoader, hideLoader } from '/js/components/loader.js';

export async function render(container) {
    const user = getUserProfile();
    
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/mentor/dashboard')}
            <div class="main-content">
                ${createHeader('Mentor Dashboard', user)}
                <div class="page-content" id="dashboard-content">
                    <p class="text-center p-8">Loading dashboard...</p>
                </div>
            </div>
        </div>
    `;
    
    const content = document.getElementById('dashboard-content');
    
    try {
        showLoader();
        // Mock data
        const res = {
            stats: { totalStudents: 24, meetingsThisMonth: 12, pendingRequests: 3, highRisk: 2 },
            pendingRequests: [
                { id: 1, studentName: 'Alice Johnson', type: 'Academic', date: '2023-10-15T10:00:00Z' },
                { id: 2, studentName: 'Bob Smith', type: 'Career', date: '2023-10-16T14:30:00Z' }
            ],
            highRiskStudents: [
                { id: 1, name: 'Charlie Davis', riskScore: 85, reason: 'Low Attendance' }
            ]
        };
        
        hideLoader();
        
        content.innerHTML = `
            <div class="stats-row grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Total Students</h3>
                    <p class="text-2xl font-bold">${res.stats.totalStudents}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Meetings This Month</h3>
                    <p class="text-2xl font-bold">${res.stats.meetingsThisMonth}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Pending Requests</h3>
                    <p class="text-2xl font-bold text-warning">${res.stats.pendingRequests}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">High Risk Students</h3>
                    <p class="text-2xl font-bold text-danger">${res.stats.highRisk}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="card card-glass">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 class="font-bold">Pending Meeting Requests</h2>
                    </div>
                    <div class="p-4">
                        <ul class="space-y-4">
                            ${res.pendingRequests.map(r => `
                                <li class="flex justify-between items-center border border-gray-100 dark:border-gray-800 p-3 rounded">
                                    <div>
                                        <p class="font-bold">${r.studentName}</p>
                                        <p class="text-sm text-muted">${r.type} - ${new Date(r.date).toLocaleString()}</p>
                                    </div>
                                    <div class="flex gap-2">
                                        <button class="btn btn-sm btn-success">Approve</button>
                                        <button class="btn btn-sm btn-danger">Reject</button>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                
                <div class="card card-glass border border-red-500/30">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                        <h2 class="font-bold text-danger">High Risk Alerts</h2>
                    </div>
                    <div class="p-4">
                        <ul class="space-y-4">
                            ${res.highRiskStudents.map(s => `
                                <li class="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-3 rounded">
                                    <div>
                                        <p class="font-bold">${s.name}</p>
                                        <p class="text-sm text-danger">${s.reason}</p>
                                    </div>
                                    <span class="badge badge-danger">Risk Score: ${s.riskScore}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        hideLoader();
        content.innerHTML = '<p class="text-danger p-4">Error loading dashboard.</p>';
    }
}
