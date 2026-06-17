import { api } from '/js/api.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showToast } from '/js/components/toast.js';

export async function render(container) {
    const user = getUserProfile();
    
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/student/issues')}
            <div class="main-content">
                ${createHeader('My Issues', user)}
                <div class="page-content">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold">Reported Issues</h2>
                        <button class="btn btn-primary" onclick="alert('Open Raise Issue Modal')">Raise Issue</button>
                    </div>
                    <div class="grid gap-4">
                        <div class="card p-4">
                            <h3 class="font-bold">Course Registration Error</h3>
                            <p class="text-sm text-muted mb-2">Unable to register for CS301.</p>
                            <span class="badge badge-warning">Pending</span>
                            <span class="badge badge-danger">High</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
