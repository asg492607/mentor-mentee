export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

export function isValidPassword(pwd) {
    return pwd && pwd.length >= 6;
}

export function isRequired(value) {
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
}

export function isValidCGPA(cgpa) {
    const val = parseFloat(cgpa);
    return !isNaN(val) && val >= 0 && val <= 10;
}

export function validateForm(rules, data) {
    let valid = true;
    const errors = {};

    for (const [field, fieldRules] of Object.entries(rules)) {
        for (const rule of fieldRules) {
            if (rule.type === 'required') {
                if (!isRequired(data[field])) {
                    valid = false;
                    errors[field] = rule.message || 'This field is required';
                    break;
                }
            } else if (rule.type === 'email') {
                if (data[field] && !isValidEmail(data[field])) {
                    valid = false;
                    errors[field] = rule.message || 'Invalid email format';
                    break;
                }
            } else if (rule.type === 'minLength') {
                if (data[field] && data[field].length < rule.value) {
                    valid = false;
                    errors[field] = rule.message || `Minimum length is ${rule.value}`;
                    break;
                }
            } else if (rule.type === 'cgpa') {
                if (data[field] && !isValidCGPA(data[field])) {
                    valid = false;
                    errors[field] = rule.message || 'CGPA must be between 0 and 10';
                    break;
                }
            }
        }
    }

    return { valid, errors };
}
