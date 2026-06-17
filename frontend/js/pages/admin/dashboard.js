import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showLoader, hideLoader } from '/js/components/loader.js';
import { showToast } from '/js/components/toast.js';

export async function render(container) {
    const user = getUserProfile();
    
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/admin/dashboard')}
            <div class="main-content">
                ${createHeader('Admin Dashboard', user)}
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
            stats: { totalUsers: 1500, students: 1200, faculty: 280, departments: 8 },
            health: { server: 'Online', database: 'Connected', load: '12%' }
        };
        
        hideLoader();
        
        content.innerHTML = `
            <div class="stats-row grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Total Users</h3>
                    <p class="text-2xl font-bold">${res.stats.totalUsers}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Students</h3>
                    <p class="text-2xl font-bold">${res.stats.students}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Faculty</h3>
                    <p class="text-2xl font-bold">${res.stats.faculty}</p>
                </div>
                <div class="stat-card card card-glass p-4">
                    <h3 class="text-muted text-sm">Departments</h3>
                    <p class="text-2xl font-bold">${res.stats.departments}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="card card-glass">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 class="font-bold">System Health</h2>
                    </div>
                    <div class="p-4 space-y-4">
                        <div class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                            <span>Server Status</span>
                            <span class="text-success font-bold">${res.health.server}</span>
                        </div>
                        <div class="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                            <span>Database</span>
                            <span class="text-success font-bold">${res.health.database}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>System Load</span>
                            <span>${res.health.load}</span>
                        </div>
                    </div>
                </div>
                
                <div class="card card-glass">
                    <div class="card-header p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 class="font-bold">Quick Actions</h2>
                    </div>
                    <div class="p-4 flex flex-col gap-3">
                        <a href="#/admin/users" class="btn btn-primary w-full justify-center">Manage Users</a>
                        <a href="#/admin/allocation" class="btn btn-secondary w-full justify-center">Mentor Allocation</a>
                        <a href="#/admin/departments" class="btn btn-ghost w-full justify-center border border-gray-300">Manage Departments</a>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        hideLoader();
        content.innerHTML = '<p class="text-danger p-4">Error loading dashboard.</p>';
    }
}
