import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/mentor/students')}
            <div class="main-content">
                ${createHeader('Assigned Students', user)}
                <div class="page-content">
                    <div class="mb-4">
                        <input type="text" placeholder="Search students..." class="form-input w-full max-w-md">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="card p-4 hover:shadow-lg transition-shadow cursor-pointer">
                            <h3 class="font-bold">Alice Johnson</h3>
                            <p class="text-sm text-muted">Roll: 20CS101</p>
                            <div class="mt-2 flex gap-2">
                                <span class="badge badge-success">CGPA: 8.5</span>
                                <span class="badge badge-risk-low">Low Risk</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
