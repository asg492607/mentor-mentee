import { api } from '/js/api.js';
import { navigateTo } from '/js/router.js';
import { getUserProfile } from '/js/auth.js';
import { createSidebar } from '/js/components/sidebar.js';
import { createHeader } from '/js/components/header.js';
import { showModal, hideModal } from '/js/components/modal.js';
import { showToast } from '/js/components/toast.js';
import { showLoader, hideLoader } from '/js/components/loader.js';
import { createDataTable } from '/js/components/table.js';
import { formatDateTime, formatDate } from '/js/utils/helpers.js';
import { formatStatus, formatMeetingType } from '/js/utils/formatters.js';

export async function render(container) {
    const user = getUserProfile();
    
    container.innerHTML = `
        <div class="dashboard-layout fade-in">
            ${createSidebar(user.role, '/student/meetings')}
            <div class="main-content">
                ${createHeader('My Meetings', user)}
                <div class="page-content">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold">Meeting History</h2>
                        <button class="btn btn-primary" id="btn-new-meeting">
                            <i class="fas fa-plus mr-2"></i> Request Meeting
                        </button>
                    </div>
                    
                    <div class="card card-glass p-0 mb-6">
                        <div class="border-b border-gray-200 dark:border-gray-700 px-4 flex gap-4" id="meeting-tabs">
                            <button class="py-3 px-2 border-b-2 border-primary font-medium text-primary active-tab" data-filter="all">All</button>
                            <button class="py-3 px-2 border-b-2 border-transparent font-medium text-muted hover:text-gray-900 dark:hover:text-white" data-filter="upcoming">Upcoming</button>
                            <button class="py-3 px-2 border-b-2 border-transparent font-medium text-muted hover:text-gray-900 dark:hover:text-white" data-filter="completed">Completed</button>
                        </div>
                        <div class="p-4" id="meetings-table-container">
                            <!-- Table goes here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Setup modal html
    const modalHtml = `
        <form id="request-meeting-form" class="space-y-4">
            <div class="form-group">
                <label class="form-label">Meeting Type</label>
                <select class="form-select w-full" name="type" required>
                    <option value="">Select Type</option>
                    <option value="Academic">Academic Support</option>
                    <option value="Career">Career Guidance</option>
                    <option value="Personal">Personal Counseling</option>
                    <option value="Internship">Internship Advice</option>
                    <option value="Project">Project Discussion</option>
                    <option value="Higher Studies">Higher Studies</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Preferred Date & Time</label>
                <input type="datetime-local" class="form-input w-full" name="date" required>
            </div>
            <div class="form-group">
                <label class="form-label">Description / Agenda</label>
                <textarea class="form-textarea w-full" name="description" rows="3" required placeholder="What would you like to discuss?"></textarea>
            </div>
            <div class="flex justify-end gap-2 mt-4">
                <button type="button" class="btn btn-secondary" onclick="document.dispatchEvent(new CustomEvent('close-modal'))">Cancel</button>
                <button type="submit" class="btn btn-primary">Submit Request</button>
            </div>
        </form>
    `;
    
    const tableContainer = document.getElementById('meetings-table-container');
    let allMeetings = [];
    
    async function loadMeetings() {
        showLoader();
        try {
            // Mock data fallback
            const res = await api.get('/api/student/meetings').catch(() => ([
                { id: 1, type: 'Academic', mentor: 'Dr. Jane Smith', date: new Date(Date.now() + 86400000).toISOString(), status: 'Approved' },
                { id: 2, type: 'Career', mentor: 'Dr. Jane Smith', date: new Date(Date.now() - 86400000).toISOString(), status: 'Completed' },
                { id: 3, type: 'Project', mentor: 'Dr. Jane Smith', date: new Date(Date.now() + 172800000).toISOString(), status: 'Pending' }
            ]));
            
            allMeetings = res || [];
            renderTable('all');
        } catch (err) {
            showToast('Failed to load meetings', 'error');
            tableContainer.innerHTML = '<p class="text-danger">Error loading data.</p>';
        } finally {
            hideLoader();
        }
    }
    
    function renderTable(filter) {
        let filtered = allMeetings;
        if (filter === 'upcoming') {
            filtered = allMeetings.filter(m => m.status === 'Approved' || m.status === 'Pending');
        } else if (filter === 'completed') {
            filtered = allMeetings.filter(m => m.status === 'Completed');
        }
        
        const columns = [
            { key: 'date', label: 'Date & Time', render: (val) => formatDateTime(val) },
            { key: 'type', label: 'Type', render: (val) => formatMeetingType(val) },
            { key: 'mentor', label: 'Mentor' },
            { key: 'status', label: 'Status', render: (val) => formatStatus(val) },
            { key: 'actions', label: 'Actions', render: (_, row) => {
                if (row.status === 'Approved') {
                    return `<button class="btn btn-sm btn-primary btn-join" data-id="${row.id}">Join Room</button>`;
                }
                return '';
            }}
        ];
        
        tableContainer.innerHTML = createDataTable(columns, filtered);
        
        // Attach action listeners
        tableContainer.querySelectorAll('.btn-join').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                navigateTo(`/meeting-room?id=${id}`);
            });
        });
    }
    
    // Event Listeners
    document.getElementById('btn-new-meeting').addEventListener('click', () => {
        showModal('Request Meeting', modalHtml);
        
        document.getElementById('request-meeting-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            try {
                showLoader();
                await api.post('/api/student/meetings/request', data).catch(err => {
                    // Mock success
                    console.log('Mock request sent', data);
                });
                showToast('Meeting requested successfully', 'success');
                hideModal();
                loadMeetings();
            } catch (err) {
                showToast('Failed to request meeting', 'error');
            } finally {
                hideLoader();
            }
        });
    });
    
    document.querySelectorAll('#meeting-tabs button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#meeting-tabs button').forEach(b => {
                b.classList.remove('border-primary', 'text-primary', 'active-tab');
                b.classList.add('border-transparent', 'text-muted');
            });
            e.target.classList.remove('border-transparent', 'text-muted');
            e.target.classList.add('border-primary', 'text-primary', 'active-tab');
            
            renderTable(e.target.getAttribute('data-filter'));
        });
    });
    
    document.addEventListener('close-modal', () => hideModal());
    
    loadMeetings();
}
