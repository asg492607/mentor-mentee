/**
 * MIT-ADT University Statutory, Mandatory Welfare, Innovation, & Student Growth Cells
 * Official cell registry, Section Head roles, descriptions, and credentials metadata.
 */

export const MIT_UNIVERSITY_CELLS = [
  // ─── 1. Statutory & Mandatory Welfare Cells ─────────────────────────────────
  {
    id: 'icc',
    category: 'Statutory & Mandatory Welfare',
    name: 'Internal Complaints Committee (ICC)',
    shortCode: 'ICC',
    description: 'Enforces the POSH Act, 2013 to address, prevent, and investigate sexual harassment complaints on campus with strict confidentiality.',
    headName: 'Dr. Meera Deshmukh',
    designation: 'ICC Presiding Officer',
    email: 'icc@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!ICC',
    role: 'SECTION_HEAD',
    icon: 'ph-shield-check',
    color: '#ec4899'
  },
  {
    id: 'wdc',
    category: 'Statutory & Mandatory Welfare',
    name: "Women's Development Cell (WDC)",
    shortCode: 'WDC',
    description: 'Promotes gender sensitization, organizes self-defense workshops, and conducts health & wellbeing awareness programs for female students and staff.',
    headName: 'Prof. Sunita Kulkarni',
    designation: 'WDC Convener',
    email: 'wdc@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!WDC',
    role: 'SECTION_HEAD',
    icon: 'ph-gender-female',
    color: '#f43f5e'
  },
  {
    id: 'anti_ragging',
    category: 'Statutory & Mandatory Welfare',
    name: 'Anti-Ragging Committee & Squad',
    shortCode: 'ARC',
    description: 'Monitors campus and hostel safety 24/7, enforcing zero-tolerance compliance with UGC and national anti-ragging regulations.',
    headName: 'Dr. Rajesh Patil',
    designation: 'Anti-Ragging Chief Officer',
    email: 'antiragging@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!ARC',
    role: 'SECTION_HEAD',
    icon: 'ph-warning-octagon',
    color: '#ef4444'
  },
  {
    id: 'eoc',
    category: 'Statutory & Mandatory Welfare',
    name: 'Equal Opportunity Cell (EOC)',
    shortCode: 'EOC',
    description: 'Ensures affirmative action, equal access, and scholarship guidance for underprivileged groups including SC, ST, OBC, minority, and PwD students.',
    headName: 'Dr. Ramesh Kamble',
    designation: 'EOC Coordinator',
    email: 'eoc@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!EOC',
    role: 'SECTION_HEAD',
    icon: 'ph-scales',
    color: '#8b5cf6'
  },
  {
    id: 'grc',
    category: 'Statutory & Mandatory Welfare',
    name: 'Grievance Redressal Cell (GRC)',
    shortCode: 'GRC',
    description: 'Handles formal resolution of academic, operational, hostel, fee, and administrative disputes submitted by students or staff.',
    headName: 'Prof. Arvind Joshi',
    designation: 'GRC Secretary',
    email: 'grc@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!GRC',
    role: 'SECTION_HEAD',
    icon: 'ph-chats-circle',
    color: '#06b6d4'
  },

  // ─── 2. Innovation, Business & Skill Cells ──────────────────────────────────
  {
    id: 'edc',
    category: 'Innovation, Business & Skill',
    name: 'Entrepreneurship Development Cell (EDC / E-Cell)',
    shortCode: 'E-Cell',
    description: 'Fosters campus startup culture, runs ideation bootcamps, and connects student founders with angel networks and venture funds.',
    headName: 'Dr. Vikram Shinde',
    designation: 'E-Cell Faculty Lead',
    email: 'edc@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!EDC',
    role: 'SECTION_HEAD',
    icon: 'ph-lightbulb-filament',
    color: '#eab308'
  },
  {
    id: 'iic',
    category: 'Innovation, Business & Skill',
    name: "Institution’s Innovation Council (IIC)",
    shortCode: 'IIC',
    description: 'Established under Ministry of Education (MoE) Innovation Cell to coordinate national hackathons, Smart India Hackathon (SIH), and innovation indexing.',
    headName: 'Dr. Neha Gaikwad',
    designation: 'IIC President',
    email: 'iic@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!IIC',
    role: 'SECTION_HEAD',
    icon: 'ph-trophy',
    color: '#f97316'
  },
  {
    id: 'tbi',
    category: 'Innovation, Business & Skill',
    name: 'Incubation Centre / Technology Business Incubator (TBI)',
    shortCode: 'TBI',
    description: 'Provides physical co-working space, pre-seed grants, rapid prototyping labs, and legal mentoring for early-stage student ventures.',
    headName: 'Er. Rohit Salunkhe',
    designation: 'TBI Director',
    email: 'tbi@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!TBI',
    role: 'SECTION_HEAD',
    icon: 'ph-rocket-launch',
    color: '#6366f1'
  },
  {
    id: 'ipr',
    category: 'Innovation, Business & Skill',
    name: 'Intellectual Property Rights (IPR) Cell',
    shortCode: 'IPR',
    description: 'Assists faculty and students with patent prior-art searches, drafting, provisional filing, copyright registration, and tech transfers.',
    headName: 'Dr. Sanjay Bhalerao',
    designation: 'IPR Chair',
    email: 'ipr@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!IPR',
    role: 'SECTION_HEAD',
    icon: 'ph-certificate',
    color: '#3b82f6'
  },
  {
    id: 'tnp',
    category: 'Innovation, Business & Skill',
    name: 'Training and Placement Cell (T&P)',
    shortCode: 'T&P',
    description: 'Coordinates university campus recruitment drives, industry internships, aptitude training, soft skill bootcamps, and mock interviews.',
    headName: 'Prof. Amit Kothari',
    designation: 'Head — Training & Placement',
    email: 'tnp@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!TNP',
    role: 'SECTION_HEAD',
    icon: 'ph-briefcase',
    color: '#10b981'
  },
  {
    id: 'iiic',
    category: 'Innovation, Business & Skill',
    name: 'Industry-Institute Interaction Cell (IIIC)',
    shortCode: 'IIIC',
    description: 'Manages corporate MOUs, executive guest lectures, sponsored capstone projects, and industrial faculty exchange programs.',
    headName: 'Dr. Prashant More',
    designation: 'IIIC Convener',
    email: 'iiic@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!IIIC',
    role: 'SECTION_HEAD',
    icon: 'ph-handshake',
    color: '#14b8a6'
  },

  // ─── 3. Student Growth & Community Service Cells ────────────────────────────
  {
    id: 'nss',
    category: 'Student Growth & Community Service',
    name: 'National Service Scheme (NSS)',
    shortCode: 'NSS',
    description: 'Leads student community outreach, annual blood donation drives, digital literacy camps, tree plantation, and rural development missions.',
    headName: 'Prof. Sachin Chavan',
    designation: 'NSS Program Officer',
    email: 'nss@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!NSS',
    role: 'SECTION_HEAD',
    icon: 'ph-users-three',
    color: '#16a34a'
  },
  {
    id: 'ncc',
    category: 'Student Growth & Community Service',
    name: 'National Cadet Corps (NCC)',
    shortCode: 'NCC',
    description: 'Provides structured military drill training, adventurous camps, national integration programs, and leadership development for cadets.',
    headName: 'Lt. Col. Deepak Yadav',
    designation: 'Associate NCC Officer',
    email: 'ncc@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!NCC',
    role: 'SECTION_HEAD',
    icon: 'ph-medal',
    color: '#059669'
  },
  {
    id: 'counseling',
    category: 'Student Growth & Community Service',
    name: 'Career Guidance and Counseling Cell',
    shortCode: 'Counseling',
    description: 'Offers 1-on-1 confidential psychological counseling, mental wellness sessions, stress management, and higher studies roadmap advisory.',
    headName: 'Dr. Ananya Sen',
    designation: 'Chief Student Counselor',
    email: 'counseling@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!CGC',
    role: 'SECTION_HEAD',
    icon: 'ph-heart-straight',
    color: '#d946ef'
  },
  {
    id: 'alumni',
    category: 'Student Growth & Community Service',
    name: 'Alumni Relations Cell',
    shortCode: 'Alumni',
    description: 'Connects current mentees with global alumni leaders for mentorship, guest coaching, industry referrals, and institutional endowments.',
    headName: 'Prof. Snehal Patil',
    designation: 'Alumni Relations Officer',
    email: 'alumni@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!ALM',
    role: 'SECTION_HEAD',
    icon: 'ph-graduation-cap',
    color: '#a855f7'
  },
  {
    id: 'iqac',
    category: 'Student Growth & Community Service',
    name: 'Internal Quality Assurance Cell (IQAC)',
    shortCode: 'IQAC',
    description: 'Monitors, audits, and ensures continuous quality benchmarks across academic pedagogy, research output, and NAAC/NIRF accreditation metrics.',
    headName: 'Dr. Suhas Pawar',
    designation: 'IQAC Director',
    email: 'iqac@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!IQAC',
    role: 'SECTION_HEAD',
    icon: 'ph-check-circle',
    color: '#0284c7'
  },

  // ─── 4. Operational Campus Sections ─────────────────────────────────────────
  {
    id: 'exam_section',
    category: 'Campus Operational Sections',
    name: 'Exam Section',
    shortCode: 'Exam',
    description: 'Coordinates end-semester exam scheduling, hall tickets, revaluation requests, transcript issuance, and grade card distribution.',
    headName: 'Prof. Nitin Ghorpade',
    designation: 'Controller of Examinations (CoE)',
    email: 'exam.section@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!EXM',
    role: 'SECTION_HEAD',
    icon: 'ph-exam',
    color: '#4f46e5'
  },
  {
    id: 'student_section',
    category: 'Campus Operational Sections',
    name: 'Student Section',
    shortCode: 'Student',
    description: 'Manages official student identity cards, bonafide certificates, fee installment plans, bus/train concessions, and hostel allotments.',
    headName: 'Mr. Anand Kadam',
    designation: 'Student Section Head',
    email: 'student.section@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!STU',
    role: 'SECTION_HEAD',
    icon: 'ph-identification-card',
    color: '#0d9488'
  },
  {
    id: 'academic_section',
    category: 'Campus Operational Sections',
    name: 'Academic Section',
    shortCode: 'Academic',
    description: 'Oversees academic calendar adherence, course registration, electives selection, syllabus distribution, and credit transfers.',
    headName: 'Dr. Archana Dixit',
    designation: 'Dean Academics Representative',
    email: 'academic.section@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!ACD',
    role: 'SECTION_HEAD',
    icon: 'ph-books',
    color: '#2563eb'
  },
  {
    id: 'travel_section',
    category: 'Campus Operational Sections',
    name: 'Travel Section',
    shortCode: 'Travel',
    description: 'Handles official student transportation, concession passes, industrial visit logistics, and university bus routing.',
    headName: 'Mr. Ganesh Rathi',
    designation: 'Transport & Logistics Head',
    email: 'travel.section@mituniversity.edu.in',
    defaultPassword: 'Mit@2026!TRV',
    role: 'SECTION_HEAD',
    icon: 'ph-bus',
    color: '#0891b2'
  }
];

export function getAllCellNames() {
  return MIT_UNIVERSITY_CELLS.map(c => c.name);
}

export function getCellsByCategory() {
  const grouped = {};
  for (const cell of MIT_UNIVERSITY_CELLS) {
    if (!grouped[cell.category]) {
      grouped[cell.category] = [];
    }
    grouped[cell.category].push(cell);
  }
  return grouped;
}
