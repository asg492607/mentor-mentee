import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/student/profile')}
            <div class="main-content">
                ${createHeader('My Profile', user)}
                <div class="page-content">
                    <div class="card p-6 max-w-2xl mx-auto">
                        <div class="flex items-center gap-4 mb-6">
                            <div class="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold">
                                ${user.name.charAt(0)}
                            </div>
                            <div>
                                <h2 class="text-2xl font-bold">${user.name}</h2>
                                <p class="text-muted">${user.email}</p>
                                <span class="badge badge-info mt-2">${user.role}</span>
                            </div>
                        </div>
                        <form class="space-y-4">
                            <div class="form-group">
                                <label class="form-label">Department</label>
                                <input type="text" class="form-input w-full" value="Computer Science" disabled>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Career Goals</label>
                                <textarea class="form-textarea w-full" rows="3"></textarea>
                            </div>
                            <button type="button" class="btn btn-primary w-full">Save Changes</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
}
