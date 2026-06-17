import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/hod/dashboard')}
            <div class="main-content">
                ${createHeader('HOD Dashboard', user)}
                <div class="page-content">
                    <div class="stats-row grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div class="stat-card card p-4"><h3>Total Students</h3><p class="text-2xl font-bold">450</p></div>
                        <div class="stat-card card p-4"><h3>Active Mentors</h3><p class="text-2xl font-bold">30</p></div>
                        <div class="stat-card card p-4"><h3>Open Issues</h3><p class="text-2xl font-bold">5</p></div>
                        <div class="stat-card card p-4"><h3>High Risk</h3><p class="text-2xl font-bold text-danger">12</p></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
