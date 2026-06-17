import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';

export async function render(container) {
    const user = getUserProfile();
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/admin/departments')}
            <div class="main-content">
                ${createHeader('Department Management', user)}
                <div class="page-content">
                    <button class="btn btn-primary mb-4">Add Department</button>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="card p-4">
                            <h3 class="font-bold">Computer Science</h3>
                            <p class="text-sm text-muted mb-2">Code: CSE</p>
                            <p class="text-sm">HOD: Dr. Alan Turing</p>
                            <div class="flex gap-2 mt-4">
                                <button class="btn btn-sm btn-ghost text-primary">Edit</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
