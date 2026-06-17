export function formatRiskLevel(level) {
    let badgeClass = 'badge-info';
    let text = level;
    
    if (!level) return `<span class="badge ${badgeClass}">Unknown</span>`;
    
    const l = level.toLowerCase();
    if (l === 'low' || l === 'no risk') {
        badgeClass = 'badge-risk-low';
        text = 'Low Risk';
    } else if (l === 'medium') {
        badgeClass = 'badge-risk-medium';
        text = 'Medium Risk';
    } else if (l === 'high') {
        badgeClass = 'badge-risk-high';
        text = 'High Risk';
    }
    
    return `<span class="badge ${badgeClass}">${text}</span>`;
}

export function formatStatus(status) {
    let badgeClass = 'badge';
    if (!status) return `<span class="badge">Unknown</span>`;
    
    const s = status.toLowerCase();
    if (s === 'pending' || s === 'in progress') badgeClass = 'badge-warning';
    else if (s === 'completed' || s === 'resolved' || s === 'approved') badgeClass = 'badge-success';
    else if (s === 'cancelled' || s === 'rejected' || s === 'overdue') badgeClass = 'badge-danger';
    else if (s === 'open') badgeClass = 'badge-info';
    
    return `<span class="badge ${badgeClass}">${status}</span>`;
}

export function formatPriority(priority) {
    let badgeClass = 'badge';
    if (!priority) return '';
    
    const p = priority.toLowerCase();
    if (p === 'low') badgeClass = 'badge-info';
    else if (p === 'medium') badgeClass = 'badge-warning';
    else if (p === 'high') badgeClass = 'badge-danger';
    
    return `<span class="badge ${badgeClass}">${priority}</span>`;
}

export function formatMeetingType(type) {
    if (!type) return 'General';
    const mapping = {
        'academic': 'Academic Support',
        'career': 'Career Guidance',
        'personal': 'Personal Counseling',
        'internship': 'Internship Advice',
        'project': 'Project Discussion',
        'higher_studies': 'Higher Studies'
    };
    return mapping[type.toLowerCase()] || type;
}

export function formatCGPA(cgpa) {
    const val = parseFloat(cgpa);
    if (isNaN(val)) return 'N/A';
    
    let color = 'text-success';
    if (val < 6.0) color = 'text-danger';
    else if (val < 7.5) color = 'text-warning';
    
    return `<span class="${color} font-bold">${val.toFixed(2)}</span>`;
}

export function formatPercentage(value) {
    const val = parseInt(value);
    if (isNaN(val)) return '0%';
    
    let color = 'bg-primary';
    if (val < 30) color = 'bg-danger';
    else if (val < 70) color = 'bg-warning';
    else color = 'bg-success';
    
    return `
        <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div class="${color} h-2.5 rounded-full" style="width: ${val}%"></div>
        </div>
        <span class="text-xs text-muted mt-1 inline-block">${val}%</span>
    `;
}
