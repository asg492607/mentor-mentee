/**
 * Lumina Internationalization (i18n) Engine
 * Native multilingual support for English ('en'), Marathi ('mr'), and Hindi ('hi')
 */

const STORAGE_KEY = 'lumina_locale';
const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', shortLabel: 'EN', flag: '🇬🇧' },
  { code: 'mr', label: 'मराठी', shortLabel: 'मरा', flag: '🚩' },
  { code: 'hi', label: 'हिंदी', shortLabel: 'हिं', flag: '🇮🇳' }
];

export const translations = {
  en: {
    // Brand & General
    'brand.name': 'Lumina',
    'brand.kicker': 'Lumina Workspace',
    'brand.tagline': 'Institutional Mentorship & Student Intelligence Platform',
    'brand.subtagline': 'Empowering Student Success',
    'brand.portal_student': 'student portal',
    'brand.portal_faculty': 'faculty portal',
    'brand.portal_hod': 'hod portal',
    'brand.portal_dean': 'dean portal',
    'brand.portal_admin': 'admin portal',
    'brand.portal_section': 'section portal',

    // Navigation Items
    'nav.dashboard': 'Dashboard',
    'nav.messages': 'Messages',
    'nav.meetings': 'Meetings',
    'nav.issues': 'Grievances & Issues',
    'nav.tasks': 'Tasks & Goals',
    'nav.profile': 'My Profile',
    'nav.booklet': 'Mentorship Booklet',
    'nav.my_students': 'My Students',
    'nav.reports': 'Reports & Analytics',
    'nav.allocation': 'Mentor Allocation',
    'nav.management': 'Academic Management',
    'nav.users': 'Directory & Users',
    'nav.risk_students': 'Students at Risk',
    'nav.escalations': 'Escalations',
    'nav.analytics': 'Institutional Analytics',
    'nav.compliance': 'Booklet Compliance',
    'nav.departments': 'Departments',
    'nav.settings': 'Platform Settings',
    'nav.infrastructure': 'System Intelligence',
    'nav.landing': 'Landing Page',
    'nav.copilot_trigger': 'AI Copilot ✨',
    'nav.logout': 'Logout',

    // Header Actions
    'header.copilot': 'Copilot',
    'header.copilot_title': 'Open Lumina AI Copilot (Ctrl + /)',
    'header.web_issue': 'Web Issue',
    'header.web_issue_title': 'Report a Web Issue or Bug',
    'header.pdf_guide': 'Role Guide (PDF)',
    'header.pdf_guide_title': 'Download Role Operating Manual (PDF)',
    'header.notifications': 'Notifications',
    'header.mark_all_read': 'Mark all as read',
    'header.no_notifications': 'No new notifications',
    'header.profile_tooltip': 'Click to view & edit Profile',
    'header.switch_language': 'Language / भाषा',

    // Roles
    'role.student': 'Student',
    'role.mentor': 'Faculty Mentor',
    'role.faculty': 'Teacher / Faculty',
    'role.hod': 'Head of Department',
    'role.dean': 'Dean',
    'role.admin': 'Administrator',
    'role.section_head': 'Section Head',

    // Common UI & Statuses
    'common.save': 'Save Changes',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.submit': 'Submit',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.download': 'Download',
    'common.view': 'View',
    'common.retry': 'Retry',
    'common.loading': 'Loading...',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.time': 'Time',
    'common.details': 'Details',
    'common.none': 'None',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.active': 'Active',
    'common.all': 'All',
    'common.more': 'More',

    // Status Values
    'status.approved': 'Approved',
    'status.pending': 'Pending',
    'status.rejected': 'Rejected',
    'status.completed': 'Completed',
    'status.in_progress': 'In Progress',
    'status.open': 'Open',
    'status.resolved': 'Resolved',
    'status.closed': 'Closed',
    'status.ongoing': 'Ongoing',
    'status.scheduled': 'Scheduled',
    'status.high': 'High Risk',
    'status.medium': 'Medium Risk',
    'status.low': 'Low Risk',

    // Login Page
    'login.title': 'Welcome Back',
    'login.subtitle': 'Sign in to access your Lumina academic portal',
    'login.email': 'Email Address',
    'login.email_placeholder': 'student@university.edu',
    'login.password': 'Password',
    'login.password_placeholder': '••••••••',
    'login.forgot_password': 'Forgot Password?',
    'login.sign_in': 'Sign In',
    'login.signing_in': 'Signing In...',
    'login.no_account': "Don't have an account?",
    'login.create_account': 'Create Account',
    'login.reset_title': 'Reset Password',
    'login.reset_desc': 'Enter your registered email address and we will send you a link to reset your password.',
    'login.send_reset_link': 'Send Reset Link',

    // Registration Page
    'register.title': 'Join Lumina',
    'register.subtitle': 'Create your academic profile to connect with mentors & advisors',
    'register.as': 'Register As',
    'register.full_name': 'Full Name',
    'register.full_name_placeholder': 'John Doe',
    'register.email': 'University Email',
    'register.email_placeholder': 'john@university.edu',
    'register.password': 'Password',
    'register.confirm_password': 'Confirm Password',
    'register.department': 'Department',
    'register.class': 'Class',
    'register.year': 'Year (Standard)',
    'register.year_1': 'First Year',
    'register.year_2': 'Second Year',
    'register.year_3': 'Third Year',
    'register.year_4': 'Fourth Year',
    'register.enrollment': 'Enrollment / PRN Number',
    'register.enrollment_placeholder': 'e.g. EN2024001',
    'register.designation': 'Designation',
    'register.submit': 'Register Account',
    'register.already_registered': 'Already have an account?',
    'register.sign_in': 'Sign In',

    // Student Dashboard
    'dash.welcome': 'Welcome back, {name}',
    'dash.academic_overview': 'Academic & Mentorship Overview',
    'dash.stat_meetings': 'Active Meetings',
    'dash.stat_tasks': 'Pending Tasks',
    'dash.stat_issues': 'Active Issues',
    'dash.stat_booklet': 'Booklet Completion',
    'dash.mentor_card_title': 'Assigned Faculty Mentor',
    'dash.no_mentor': 'No mentor assigned yet. Please consult your department HOD.',
    'dash.booklet_alert_title': 'Mentorship Booklet Requirement',
    'dash.booklet_alert_desc': 'Complete at least 25% of your digital mentorship booklet across all sections to unlock full platform features.',
    'dash.complete_booklet_btn': 'Fill Booklet Now',
    'dash.upcoming_meetings': 'Upcoming Meetings',
    'dash.no_upcoming_meetings': 'No upcoming meetings scheduled.',
    'dash.schedule_meeting_btn': 'Schedule a Meeting',
    'dash.recent_tasks': 'Actionable Tasks',
    'dash.no_tasks': 'No pending tasks assigned.',
    'dash.quick_actions': 'Quick Actions',

    // Landing Page
    'landing.nav_features': 'Features',
    'landing.nav_portals': 'User Roles',
    'landing.nav_compliance': 'Compliance',
    'landing.nav_security': 'Cloud Platform',
    'landing.nav_thanks': 'Special Thanks',
    'landing.nav_credits': 'Contributors',
    'landing.nav_faqs': 'FAQs',
    'landing.nav_signin': 'Log In Portal',
    'landing.nav_dashboard': 'Go to Dashboard',
    'landing.badge': 'Institutional Mentorship & Student Intelligence Platform',
    'landing.hero_title_1': 'Next-Gen Mentorship,',
    'landing.hero_title_2': 'Zero Paperwork, Infinite Impact.',
    'landing.hero_desc': 'The all-in-one platform unifying student mentorship booklets, AI-powered academic copilots, high-definition WebRTC video meetings, and institutional grievance escalation for premier universities.',
    'landing.cta_get_started': 'Get Started Free',
    'landing.cta_explore': 'Explore Capabilities',
    'landing.stat_students': 'Active Students Mentored',
    'landing.stat_meetings': 'Meetings Conducted',
    'landing.stat_departments': 'Accredited Departments',
    'landing.stat_paperless': 'Paperless Compliance',
    'landing.stat_ratio': '20:1 Max Mentee Ratio',

    // Pilot Recognition
    'landing.pilot_badge': 'TY CSE Core Pilot Recognition',
    'landing.pilot_title': 'Special Thanks & Mentorship Recognition',
    'landing.pilot_desc': 'We extend our heartfelt gratitude and special recognition to Dr. Suwarna Pawar Mam, Head of Department (HOD) of CSE Core, for her visionary leadership, constant guidance, and pioneering initiative in piloting the Lumina Mentorship Platform for the TY CSE Core batch at MIT-ADT University. Her dedicated support and feedback have been instrumental in fostering academic excellence and student success.',

    // Credits
    'landing.credits_tag': 'Project Credits',
    'landing.credits_title': 'Guidance & Contributors',
    'landing.credits_desc': 'Recognizing the faculty mentorship and development team behind the Lumina Mentorship Platform.',
    'landing.guide_under': 'Under Guidance Of',
    'landing.guide_role': 'Assistant Professor',
    'landing.guide_desc': 'Provided faculty mentorship, project governance, and academic alignment throughout development.',
    'landing.lead_tag': 'Team Lead (Student)',
    'landing.lead_role': 'Student Team Lead',
    'landing.lead_desc': 'Lead platform architect and developer overseeing end-to-end system design and deployment.',
    'landing.member_tag': 'Contributor',
    'landing.member_role': 'Student Team Member',
    'landing.member_1_desc': 'Contributor assisting with feature implementations and testing.',
    'landing.member_2_desc': 'Contributor assisting with platform development, feature enhancements, and testing.',

    // Platform Features
    'landing.features_tag': 'Platform Excellence',
    'landing.features_title': 'Built for Modern Institutional Needs',
    'landing.features_desc': 'A battle-tested architecture providing everything your university needs to administer a high-performing, data-driven mentorship framework.',
    'landing.feat_alloc_title': 'Smart Capacity Auto-Allocation',
    'landing.feat_alloc_desc': 'Sequentially allocates unassigned students to available faculty mentors based on enrollment PRN and strict quota caps (max 20 students per mentor), preventing faculty burnout and ensuring fair attention.',
    'landing.feat_booklet_title': 'Paperless Mentorship Booklet',
    'landing.feat_booklet_desc': 'Comprehensive digitized cumulative dossier tracking Personal Profile, Health Records, Family Background, Academic Performance, and Co-curricular Milestones with an enforced 25% minimum onboarding requirement.',
    'landing.feat_copilot_title': 'Gemini AI Academic Copilot',
    'landing.feat_copilot_desc': 'Integrated AI mentorship assistant engineered with institutional prompt safety to guide mentees in defining semester goals, structuring grievance narratives, and generating personalized study schedules.',
    'landing.feat_webrtc_title': 'Serverless WebRTC Video Meetings',
    'landing.feat_webrtc_desc': 'Broadcast-quality 1-on-1 and cohort video conferencing with real-time Firestore signaling, waiting room guest moderation, host controls, screen sharing, and synchronized audio recording.',
    'landing.feat_escalation_title': '4-Tier Grievance Escalation',
    'landing.feat_escalation_desc': 'Structured multi-tier dispute and academic issue resolution hierarchy routing student tickets through Mentor → Section Head → HOD → Dean, featuring immutable audit trails and real-time status updates.',
    'landing.feat_statutory_title': 'Statutory Cells & Student Welfare',
    'landing.feat_statutory_desc': 'Institutional statutory portals for Anti-Ragging, Internal Complaints Committee (ICC), SC/ST Cell, and Student Grievance Redressal with dedicated case workflows and confidential escalation channels.',
    'landing.feat_risk_title': 'Institutional Risk & Early Warning',
    'landing.feat_risk_desc': 'Continuous automated risk evaluation (High, Medium, Low) analyzing real-time CGPA trends, attendance alerts, and booklet submission milestones to trigger timely faculty and counselor interventions.',
    'landing.feat_naac_title': 'NAAC & NIRF Accreditation Reporting',
    'landing.feat_naac_desc': 'One-click compilation of university-grade PDF and Excel compliance dossiers, capturing mentor-mentee interaction logs, attendance ratios, and academic progression sheets ready for regulatory audits.',
    'landing.feat_bulk_title': 'Bulk Ingestion & Data Hygiene',
    'landing.feat_bulk_desc': 'Rapid onboarding of hundreds of student and mentor profiles from CSV or Excel sheets with automated column parsing, honorific trimming, and a built-in 1-click duplicate record purger.',

    // Roles Section
    'landing.roles_tag': 'Tailored Workspaces',
    'landing.roles_title': 'Designed for Every Stakeholder',
    'landing.roles_desc': 'Custom interfaces and permissions tailored specifically for Students, Mentors, HODs, Deans, Section Heads, and Administrators.',
    'landing.role_student_title': '🎓 Student Portal Experience',
    'landing.role_student_desc': 'Fill digital mentorship booklets, track CGPA and attendance, request 1-on-1 meetings with mentors, report issues, and access the Gemini AI academic copilot.',
    'landing.role_student_b1': '25% Mandatory Booklet Completion tracker & profile manager',
    'landing.role_student_b2': 'Request & Join high-definition WebRTC Video Meetings',
    'landing.role_student_b3': 'Direct real-time messaging with your assigned faculty mentor',
    'landing.role_student_b4': 'Submit academic grievances with 4-tier escalation visibility',
    'landing.role_student_b5': 'Gemini AI Copilot for study timetables and milestone planning',
    'landing.role_student_cta': 'Login as Student →',

    'landing.role_mentor_title': '👨‍🏫 Mentor & Faculty Hub',
    'landing.role_mentor_desc': 'Manage your assigned mentee quota (up to 20 students), review digital booklets, host video calls, log meeting notes, and flag high-risk students.',
    'landing.role_mentor_b1': 'Real-time Mentee Directory & capacity monitoring (max 20 students)',
    'landing.role_mentor_b2': 'Review, sign off, and provide qualitative feedback on digital booklets',
    'landing.role_mentor_b3': 'Host WebRTC video calls with waiting room moderation & recording',
    'landing.role_mentor_b4': 'Early risk detection engine to flag academically vulnerable students',
    'landing.role_mentor_b5': 'Escalate unresolved issues directly to Section Heads or HODs',
    'landing.role_mentor_cta': 'Login as Mentor →',

    'landing.role_hod_title': '🏛 HOD Departmental Governance',
    'landing.role_hod_desc': 'Department-wide mentorship governance, auto-allocate unassigned students, inspect risk matrices, generate departmental reports, and re-assign mentors.',
    'landing.role_hod_b1': 'Auto-allocate unassigned students based on enrollment PRN order',
    'landing.role_hod_b2': 'Department High-Risk Matrix & multi-tier issue escalations',
    'landing.role_hod_b3': 'Inspect Student Booklets across all department batches',
    'landing.role_hod_b4': 'Export university-compliant Excel and PDF Mentorship Reports',
    'landing.role_hod_cta': 'HOD Dashboard →',

    'landing.role_dean_title': '🎓 Dean Institutional Analytics',
    'landing.role_dean_desc': 'Institution-level analytics dashboard, department performance comparison, high-risk student overview, and executive accreditation reporting.',
    'landing.role_dean_b1': 'Cross-Department Mentorship Analytics and faculty load index',
    'landing.role_dean_b2': 'Institutional Risk & Escalation Overview across all branches',
    'landing.role_dean_b3': 'Executive PDF & Excel Report Generator for NAAC/NIRF audits',
    'landing.role_dean_b4': 'Direct apex issue resolution and statutory cell coordination',
    'landing.role_dean_cta': 'Dean Portal →',

    'landing.role_section_title': '📋 Section Head Operations',
    'landing.role_section_desc': 'Specialized domain management (Exam Cell, Accounts, Hostel, Transport) to swiftly investigate and resolve forwarded student grievances.',
    'landing.role_section_b1': 'Dedicated queue for section-specific escalated student issues',
    'landing.role_section_b2': 'Direct resolution workflows with audit logging and student notifications',
    'landing.role_section_b3': 'Cross-functional coordination with Faculty Mentors and HODs',
    'landing.role_section_b4': 'Operational bottleneck identification and performance analytics',
    'landing.role_section_cta': 'Section Portal →',

    'landing.role_admin_title': '⚙️ Admin System Operations',
    'landing.role_admin_desc': 'Master control center for user registration, bulk imports, duplicate data cleaning, department name standardization, and platform configuration.',
    'landing.role_admin_b1': 'Bulk CSV/Excel User & Assignment Imports with auto column mapping',
    'landing.role_admin_b2': '1-Click Duplicate Database Record Cleaner and data normalizer',
    'landing.role_admin_b3': 'Statutory Cells account manager & institutional escalation wiring',
    'landing.role_admin_b4': 'Full Role & Permission Management with audit log tracking',
    'landing.role_admin_cta': 'Admin Operations →',

    // Cloud & Ecosystem
    'landing.cloud_tag': '⚡ Cloud & Device Agnostic Architecture',
    'landing.cloud_title': 'Modern, Real-Time Web Experience Across All Devices',
    'landing.cloud_desc': 'Built as an institutional Progressive Web App (PWA) with zero client installations required. Access high-definition video consultations, real-time mentorship booklets, and governance analytics anywhere on mobile, tablet, or desktop.',
    'landing.pwa_title': 'Zero-Install Web Access',
    'landing.pwa_desc': 'Instant, ultra-low latency browser access on Android, iOS, Windows, macOS, and Linux without downloading external installation packages or granting sideload permissions.',
    'landing.sync_title': 'Cloud Firestore Synchronization',
    'landing.sync_desc': 'Changes to student booklets, attendance indicators, meeting bookings, and grievance escalations update in real-time across faculty and student screens simultaneously.',
    'landing.p2p_title': 'Peer-to-Peer WebRTC Video',
    'landing.p2p_desc': 'Encrypted 1-on-1 virtual mentoring sessions with waiting room guest controls, participant admission, real-time screen sharing, and on-device recording capabilities.',
    'landing.badge_mobile': '📱 Mobile Responsive',
    'landing.badge_desktop': '💻 Desktop Optimized',
    'landing.badge_instant': '🚀 Instant Load',
    'landing.badge_realtime': '⚡ Real-Time Snapshots',
    'landing.badge_autosave': '🔄 Auto-Save Booklets',
    'landing.badge_offline': '🛡️ Offline Resilient',
    'landing.badge_e2e': '🔒 End-to-End Encrypted',
    'landing.badge_screenshare': '🎥 Screen Share',
    'landing.badge_av': '🎙️ Audio/Video',
    'landing.sync_status': 'System Verified & Synced with Firestore',
    'landing.feature_access': 'Feature Access',
    'landing.workspace_enabled': 'Full Workspace Privileges Enabled',

    // FAQs
    'landing.faq_tag': 'Got Questions?',
    'landing.faq_title': 'Frequently Asked Questions',
    'landing.faq_q1': 'What is the 25% Booklet Completion requirement?',
    'landing.faq_a1': 'To guarantee data fidelity for institutional records, students must fill at least 25% of their Mentorship Booklet (Personal Info, Academic History, Health, and Goals) during initial onboarding before unlocking full dashboard modules.',
    'landing.faq_q2': 'How does Smart Capacity Auto-Allocation work?',
    'landing.faq_a2': 'The allocation engine sorts unassigned students by enrollment PRN and sequentially pairs them with available faculty mentors within their department. It strictly enforces a 20-student maximum capacity per mentor to ensure fair distribution and dedicated attention.',
    'landing.faq_q3': 'How does the Gemini AI Academic Copilot help students and faculty?',
    'landing.faq_a3': 'Lumina integrates Gemini AI with tailored super-prompts grounded in academic mentorship. Students can draft semester milestones, structure grievance narratives, or request revision plans, while faculty can generate meeting agendas and qualitative guidance.',
    'landing.faq_q4': 'How do WebRTC Video Meetings ensure privacy and host controls?',
    'landing.faq_a4': 'Video sessions run entirely peer-to-peer using native WebRTC with Firestore signaling. Mentors enter as Hosts with full controls—including an active Waiting Room, Admit/Deny permissions, participant kicking, and local audio/screen recording.',
    'landing.faq_q5': 'How does the 4-Tier Issue Escalation process operate?',
    'landing.faq_a5': 'When a student raises an academic or administrative issue, it is first reviewed by their Faculty Mentor. If unresolved, it escalates to the Section Head (e.g., Exam Section), then to the HOD, and finally to the Dean or Statutory Cells, maintaining an immutable audit log throughout.',
    'landing.faq_q6': 'Can HODs and Deans export data for NAAC and NIRF accreditations?',
    'landing.faq_a6': 'Yes. HODs, Deans, and Admins can export comprehensive Excel spreadsheets and university-formatted PDF dossiers containing booklet logs, meeting records, attendance correlations, and grievance resolution metrics.',

    // Footer
    'landing.footer_desc': 'Comprehensive Institutional Mentorship, Academic Intelligence & Analytics Ecosystem. Pioneered at MIT-ADT University for modern higher education.',
    'landing.footer_quick_links': 'Quick Links',
    'landing.footer_institution': 'Institution',
    'landing.footer_rights': 'Lumina Mentorship Platform. All Rights Reserved. MIT-ADT University.'
  },

  mr: {
    // Brand & General
    'brand.name': 'ल्युमिना (Lumina)',
    'brand.kicker': 'ल्युमिना कार्यक्षेत्र',
    'brand.tagline': 'संस्थात्मक मार्गदर्शन व विद्यार्थी बुद्धिमत्ता मंच',
    'brand.subtagline': 'विद्यार्थ्यांच्या यशासाठी कटिबद्ध',
    'brand.portal_student': 'विद्यार्थी पोर्टल',
    'brand.portal_faculty': 'शिक्षक पोर्टल',
    'brand.portal_hod': 'विभाग प्रमुख पोर्टल',
    'brand.portal_dean': 'डीन पोर्टल',
    'brand.portal_admin': 'प्रशासक पोर्टल',
    'brand.portal_section': 'विभाग पोर्टल',

    // Navigation Items
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.messages': 'संदेश',
    'nav.meetings': 'बैठका व चर्चा',
    'nav.issues': 'तक्रारी व समस्या',
    'nav.tasks': 'कार्ये व उद्दिष्टे',
    'nav.profile': 'माझे प्रोफाइल',
    'nav.booklet': 'मार्गदर्शन पुस्तिका',
    'nav.my_students': 'माझे विद्यार्थी',
    'nav.reports': 'अहवाल व विश्लेषण',
    'nav.allocation': 'मार्गदर्शक वाटप',
    'nav.management': 'शैक्षणिक व्यवस्थापन',
    'nav.users': 'वापरकर्ते व निर्देशिका',
    'nav.risk_students': 'जोखमीतील विद्यार्थी',
    'nav.escalations': 'वरिष्ठांकडे पाठवलेल्या तक्रारी',
    'nav.analytics': 'संस्थात्मक विश्लेषण',
    'nav.compliance': 'पुस्तिका अनुपालन',
    'nav.departments': 'विभाग',
    'nav.settings': 'प्लॅटफॉर्म सेटिंग्ज',
    'nav.infrastructure': 'सिस्टम बुद्धिमत्ता',
    'nav.landing': 'मुख्य पृष्ठ',
    'nav.copilot_trigger': 'AI सहाय्यक ✨',
    'nav.logout': 'लॉग आउट',

    // Header Actions
    'header.copilot': 'AI कोपायलट',
    'header.copilot_title': 'ल्युमिना AI कोपायलट उघडा (Ctrl + /)',
    'header.web_issue': 'समस्या नोंदवा',
    'header.web_issue_title': 'वेब त्रुटी किंवा बग नोंदवा',
    'header.pdf_guide': 'मार्गदर्शक पुस्तिका (PDF)',
    'header.pdf_guide_title': 'भूमिका मार्गदर्शिका पुस्तिका डाउनलोड करा (PDF)',
    'header.notifications': 'सूचना',
    'header.mark_all_read': 'सर्व वाचले म्हणून चिन्हांकित करा',
    'header.no_notifications': 'कोणत्याही नवीन सूचना नाहीत',
    'header.profile_tooltip': 'प्रोफाइल पाहण्यासाठी व बदलण्यासाठी क्लिक करा',
    'header.switch_language': 'भाषा बदला',

    // Roles
    'role.student': 'विद्यार्थी',
    'role.mentor': 'मार्गदर्शक प्राध्यापक',
    'role.faculty': 'शिक्षक / प्राध्यापक',
    'role.hod': 'विभाग प्रमुख (HOD)',
    'role.dean': 'अधिष्ठाता (Dean)',
    'role.admin': 'प्रशासक (Admin)',
    'role.section_head': 'विभाग समन्वयक',

    // Common UI & Statuses
    'common.save': 'बदल जतन करा',
    'common.cancel': 'रद्द करा',
    'common.close': 'बंद करा',
    'common.submit': 'प्रस्तुत करा',
    'common.edit': 'संपादित करा',
    'common.delete': 'हटवा',
    'common.search': 'शोधा...',
    'common.filter': 'फिल्टर',
    'common.export': 'निर्यात करा',
    'common.download': 'डाउनलोड करा',
    'common.view': 'पहा',
    'common.retry': 'पुन्हा प्रयत्न करा',
    'common.loading': 'लोड होत आहे...',
    'common.actions': 'कृती',
    'common.status': 'स्थिती',
    'common.date': 'तारीख',
    'common.time': 'वेळ',
    'common.details': 'तपशील',
    'common.none': 'काहीही नाही',
    'common.back': 'मागे जा',
    'common.confirm': 'पुष्टी करा',
    'common.active': 'सक्रिय',
    'common.all': 'सर्व',
    'common.more': 'अधिक',

    // Status Values
    'status.approved': 'मंजूर',
    'status.pending': 'प्रलंबित',
    'status.rejected': 'नाकारले',
    'status.completed': 'पूर्ण झाले',
    'status.in_progress': 'प्रगतीपथावर',
    'status.open': 'सुरू',
    'status.resolved': 'निवारण झाले',
    'status.closed': 'बंद',
    'status.ongoing': 'चालू आहे',
    'status.scheduled': 'नियोजित',
    'status.high': 'उच्च जोखीम',
    'status.medium': 'मध्यम जोखीम',
    'status.low': 'कमी जोखीम',

    // Login Page
    'login.title': 'पुन्हा स्वागत आहे!',
    'login.subtitle': 'आपल्या शैक्षणिक पोर्टलमध्ये प्रवेश करण्यासाठी लॉगिन करा',
    'login.email': 'ईमेल पत्ता',
    'login.email_placeholder': 'student@university.edu',
    'login.password': 'पासवर्ड',
    'login.password_placeholder': '••••••••',
    'login.forgot_password': 'पासवर्ड विसरलात?',
    'login.sign_in': 'लॉगिन करा',
    'login.signing_in': 'लॉगिन होत आहे...',
    'login.no_account': 'नवीन खाते तयार करायचे आहे का?',
    'login.create_account': 'खाते तयार करा',
    'login.reset_title': 'पासवर्ड रीसेट करा',
    'login.reset_desc': 'आपला नोंदणीकृत ईमेल प्रविष्ट करा, पासवर्ड बदलण्यासाठी लिंक पाठवली जाईल.',
    'login.send_reset_link': 'रीसेट लिंक पाठवा',

    // Registration Page
    'register.title': 'ल्युमिनामध्ये सामील व्हा',
    'register.subtitle': 'मार्गदर्शक आणि प्राध्यापकांशी जोडण्यासाठी आपले खाते तयार करा',
    'register.as': 'भूमिका निवडा',
    'register.full_name': 'पूर्ण नाव',
    'register.full_name_placeholder': 'उदा. राहुल जोशी',
    'register.email': 'विद्यापीठ ईमेल',
    'register.email_placeholder': 'rahul@university.edu',
    'register.password': 'पासवर्ड',
    'register.confirm_password': 'पासवर्डची पुष्टी करा',
    'register.department': 'विभाग',
    'register.class': 'वर्ग',
    'register.year': 'वर्ष',
    'register.year_1': 'प्रथम वर्ष',
    'register.year_2': 'द्वितीय वर्ष',
    'register.year_3': 'तृतीय वर्ष',
    'register.year_4': 'अंतिम वर्ष',
    'register.enrollment': 'नोंदणी / पीआरएन (PRN) क्रमांक',
    'register.enrollment_placeholder': 'उदा. EN2024001',
    'register.designation': 'पदनाम',
    'register.submit': 'नोंदणी पूर्ण करा',
    'register.already_registered': 'आधीच खाते आहे का?',
    'register.sign_in': 'लॉगिन करा',

    // Student Dashboard
    'dash.welcome': 'स्वागत आहे, {name}!',
    'dash.academic_overview': 'शैक्षणिक व मार्गदर्शन आढावा',
    'dash.stat_meetings': 'सक्रिय बैठका',
    'dash.stat_tasks': 'प्रलंबित कार्ये',
    'dash.stat_issues': 'सक्रिय समस्या',
    'dash.stat_booklet': 'पुस्तिका पूर्तता',
    'dash.mentor_card_title': 'नियुक्त मार्गदर्शक प्राध्यापक',
    'dash.no_mentor': 'अद्याप मार्गदर्शक नियुक्त केलेला नाही. कृपया विभागप्रमुखांशी संपर्क साधा.',
    'dash.booklet_alert_title': 'मार्गदर्शन पुस्तिका भरणे आवश्यक',
    'dash.booklet_alert_desc': 'प्लॅटफॉर्मची सर्व वैशिष्ट्ये वापरण्यासाठी डिजिटल पुस्तिकेचे किमान २५% भाग पूर्ण करा.',
    'dash.complete_booklet_btn': 'आता पुस्तिका भरा',
    'dash.upcoming_meetings': 'आगामी बैठका',
    'dash.no_upcoming_meetings': 'कोणतीही आगामी बैठक नियोजित नाही.',
    'dash.schedule_meeting_btn': 'बैठकीची विनंती करा',
    'dash.recent_tasks': 'महत्त्वाची कार्ये',
    'dash.no_tasks': 'कोणतेही प्रलंबित कार्य नाही.',
    'dash.quick_actions': 'त्वरित कृती',

    // Landing Page
    'landing.nav_features': 'वैशिष्ट्ये',
    'landing.nav_portals': 'वापरकर्ते भूमिका',
    'landing.nav_compliance': 'अनुपालन',
    'landing.nav_security': 'क्लाउड प्लॅटफॉर्म',
    'landing.nav_thanks': 'विशेष आभार',
    'landing.nav_credits': 'योगदानकर्ते',
    'landing.nav_faqs': 'वारंवार विचारले जाणारे प्रश्न',
    'landing.nav_signin': 'पोर्टल लॉगिन',
    'landing.nav_dashboard': 'डॅशबोर्डवर जा',
    'landing.badge': 'संस्थात्मक मार्गदर्शन आणि विद्यार्थी बुद्धिमत्ता मंच',
    'landing.hero_title_1': 'आधुनिक मार्गदर्शन प्रणाली,',
    'landing.hero_title_2': 'कागदविरहित कार्यपद्धती, अथांग प्रगती.',
    'landing.hero_desc': 'विद्यार्थी मार्गदर्शन पुस्तिका, AI शैक्षणिक सहाय्यक, उच्च दर्जाच्या व्हिडिओ बैठका आणि संस्थात्मक तक्रार निवारण एकत्रित करणारा अग्रगण्य विद्यापीठांसाठीचा संपूर्ण मंच.',
    'landing.cta_get_started': 'विनामूल्य सुरू करा',
    'landing.cta_explore': 'वैशिष्ट्ये व क्षमता पहा',
    'landing.stat_students': 'मार्गदर्शन घेणारे विद्यार्थी',
    'landing.stat_meetings': 'यशस्वी बैठका',
    'landing.stat_departments': 'संलग्न शैक्षणिक विभाग',
    'landing.stat_paperless': 'कागदविरहित अनुपालन',
    'landing.stat_ratio': '२०:१ कमाल विद्यार्थी गुणोत्तर',

    // Pilot Recognition
    'landing.pilot_badge': 'तृतीय वर्ष सीएसई कोर पायलट गौरव',
    'landing.pilot_title': 'विशेष आभार व मार्गदर्शन गौरव',
    'landing.pilot_desc': 'आम्ही डॉ. सुवर्णा पवार मॅम, विभागप्रमुख (HOD), सीएसई कोर, यांचे मनापासून आभार मानतो. त्यांच्या दूरदर्शी नेतृत्वाखाली, निरंतर मार्गदर्शनाखाली आणि पुढाकाराने एमआयटी-एडीटी विद्यापीठातील तृतीय वर्ष सीएसई कोर बॅचसाठी ल्युमिना मेंटरशिप प्लॅटफॉर्मचा यशस्वी पायलट सुरू करण्यात आला. विद्यार्थ्यांच्या शैक्षणिक प्रगतीसाठी त्यांचे सहकार्य मोलाचे ठरले आहे.',

    // Credits
    'landing.credits_tag': 'प्रकल्प श्रेय',
    'landing.credits_title': 'मार्गदर्शन व योगदानकर्ते',
    'landing.credits_desc': 'ल्युमिना प्लॅटफॉर्मच्या निर्मितीमधील प्राध्यापक मार्गदर्शन आणि विद्यार्थी विकास पथकाचा गौरव.',
    'landing.guide_under': 'यांच्या मार्गदर्शनाखाली',
    'landing.guide_role': 'सहाय्यक प्राध्यापक',
    'landing.guide_desc': 'विकास प्रक्रियेदरम्यान प्राध्यापक मार्गदर्शन, प्रकल्प प्रशासन आणि शैक्षणिक समन्वय प्रदान केले.',
    'landing.lead_tag': 'विद्यार्थी पथक प्रमुख',
    'landing.lead_role': 'विद्यार्थी पथक प्रमुख',
    'landing.lead_desc': 'संपूर्ण सिस्टम डिझाइन आणि उपयोजनाचे नेतृत्व करणारे मुख्य आर्किटेक्ट व डेव्हलपर.',
    'landing.member_tag': 'योगदानकर्ता',
    'landing.member_role': 'विद्यार्थी पथक सदस्य',
    'landing.member_1_desc': 'वैशिष्ट्यांची अंमलबजावणी आणि चाचणीमध्ये सहाय्य करणारे योगदानकर्ते.',
    'landing.member_2_desc': 'प्लॅटफॉर्म विकास, सुधारणा आणि चाचणीमध्ये सहाय्य करणारे योगदानकर्ते.',

    // Platform Features
    'landing.features_tag': 'प्लॅटफॉर्मची वैशिष्ट्ये',
    'landing.features_title': 'आधुनिक संस्थात्मक गरजांसाठी सज्ज',
    'landing.features_desc': 'विद्यापीठातील सर्वसमावेशक आणि डेटा-आधारित मार्गदर्शनासाठी एक मजबूत डिजिटल रचना.',
    'landing.feat_alloc_title': 'स्मार्ट स्वयंचलित मार्गदर्शक वाटप',
    'landing.feat_alloc_desc': 'नोंदणी पीआरएन क्रमांक आणि कमाल २० विद्यार्थ्यांच्या मर्यादेनुसार प्राध्यापकांना विद्यार्थ्यांचे समान व न्याय्य वाटप केले जाते.',
    'landing.feat_booklet_title': 'कागदविरहित डिजिटल पुस्तिका',
    'landing.feat_booklet_desc': 'वैयक्तिक माहिती, आरोग्य, शैक्षणिक प्रगती आणि सह-अभ्यासक्रमाच्या नोंदींचे किमान २५% पूर्ततेसह संपूर्ण डिजिटल संचयन.',
    'landing.feat_copilot_title': 'जेमिनी AI शैक्षणिक कोपायलट',
    'landing.feat_copilot_desc': 'अभ्यास योजना, सत्र उद्दिष्टे आणि तक्रारींच्या योग्य मसुद्यासाठी उपयुक्त सुरक्षित संस्थात्मक कृत्रिम बुद्धिमत्ता सहाय्यक.',
    'landing.feat_webrtc_title': 'थेट WebRTC व्हिडिओ बैठका',
    'landing.feat_webrtc_desc': 'प्रतीक्षा कक्ष, स्क्रीन शेअरिंग आणि होस्ट नियंत्रणासह सुरक्षित व थेट १-ऑन-१ किंवा समूह व्हिडिओ बैठका.',
    'landing.feat_escalation_title': '४-स्तरीय तक्रार निवारण यंत्रणा',
    'landing.feat_escalation_desc': 'विद्यार्थी तक्रारींचे मार्गदर्शक → विभाग समन्वयक → विभागप्रमुख → डीन यांच्याकडे पारदर्शक व वेळेत निवारण.',
    'landing.feat_statutory_title': 'वैधानिक समित्या व विद्यार्थी कल्याण',
    'landing.feat_statutory_desc': 'रॅगिंग विरोधी कक्ष, महिला तक्रार निवारण (ICC), एससी/एसटी कक्ष आणि तक्रार निवारणासाठी समर्पित गोपनीय पोर्टल्स.',
    'landing.feat_risk_title': 'जोखीम पूर्वसूचना व शैक्षणिक विश्लेषण',
    'landing.feat_risk_desc': 'सीजीपीए, उपस्थिती आणि पुस्तिका नोंदींवरून शैक्षणिक धोके ओळखून प्राध्यापक हस्तक्षेपासाठी वेळेवर सूचना.',
    'landing.feat_naac_title': 'NAAC व NIRF मूल्यांकन अहवाल',
    'landing.feat_naac_desc': 'नियामक तपासणीसाठी एका क्लिकवर मार्गदर्शक नोंदी, उपस्थिती व शैक्षणिक प्रगतीचे प्रमाणित PDF व Excel अहवाल तयार करा.',
    'landing.feat_bulk_title': 'मोठ्या प्रमाणातील डेटा आयात व शुद्धता',
    'landing.feat_bulk_desc': 'एक्सेल किंवा सीएसव्ही फाईल्समधून शेकडो विद्यार्थ्यांची जलद नोंदणी आणि डुप्लिकेट नोंदी एका क्लिकवर हटवण्याची सोय.',

    // Roles Section
    'landing.roles_tag': 'प्रत्येकासाठी स्वतंत्र कार्यक्षेत्र',
    'landing.roles_title': 'प्रत्येक घटकासाठी विचारपूर्वक डिझाइन केलेले',
    'landing.roles_desc': 'विद्यार्थी, मार्गदर्शक, विभागप्रमुख, डीन आणि प्रशासकांसाठी विशेष अधिकार आणि सुविधा.',
    'landing.role_student_title': '🎓 विद्यार्थी पोर्टल अनुभव',
    'landing.role_student_desc': 'डिजिटल पुस्तिका भरा, सीजीपीए व उपस्थिती तपासा, मार्गदर्शकांशी १-ऑन-१ बैठका आयोजित करा आणि AI सहाय्यक वापरा.',
    'landing.role_student_b1': '२५% अनिवार्य पुस्तिका पूर्तता ट्रॅकर आणि प्रोफाइल व्यवस्थापक',
    'landing.role_student_b2': 'उच्च दर्जाच्या WebRTC व्हिडिओ बैठकांची विनंती करा व सहभागी व्हा',
    'landing.role_student_b3': 'आपल्या नियुक्त मार्गदर्शकाशी थेट रिअल-टाइम संदेशवहन',
    'landing.role_student_b4': '४-स्तरीय तक्रार निवारण स्थिती थेट ट्रॅक करा',
    'landing.role_student_b5': 'अभ्यास वेळापत्रक आणि उद्दिष्टांसाठी जेमिनी AI कोपायलट',
    'landing.role_student_cta': 'विद्यार्थी म्हणून लॉगिन करा →',

    'landing.role_mentor_title': '👨‍🏫 मार्गदर्शक व शिक्षक केंद्र',
    'landing.role_mentor_desc': 'आपल्या विद्यार्थ्यांचा कोटा व्यवस्थापित करा (कमाल २० विद्यार्थी), डिजिटल पुस्तिका तपासा आणि बैठका घ्या.',
    'landing.role_mentor_b1': 'विद्यार्थी निर्देशिका आणि क्षमता निरीक्षण (कमाल २० विद्यार्थी)',
    'landing.role_mentor_b2': 'डिजिटल पुस्तिकांचे पुनरावलोकन, स्वाक्षरी आणि मार्गदर्शन अभिप्राय',
    'landing.role_mentor_b3': 'प्रतीक्षा कक्ष नियंत्रणासह WebRTC व्हिडिओ बैठकांचे आयोजन',
    'landing.role_mentor_b4': 'शैक्षणिकदृष्ट्या अडचणीत असलेल्या विद्यार्थ्यांची त्वरित ओळख',
    'landing.role_mentor_b5': 'न सुटलेल्या समस्या थेट विभाग समन्वयक किंवा HOD कडे पाठवा',
    'landing.role_mentor_cta': 'मार्गदर्शक म्हणून लॉगिन करा →',

    'landing.role_hod_title': '🏛 विभागप्रमुख (HOD) प्रशासन',
    'landing.role_hod_desc': 'विभागस्तरीय मार्गदर्शन व्यवस्थापन, विद्यार्थ्यांना स्वयंचलित मार्गदर्शक वाटप, जोखीम मॅट्रिक्स आणि अहवाल निर्मिती.',
    'landing.role_hod_b1': 'पीआरएन क्रमानुसार विद्यार्थ्यांना स्वयंचलित मार्गदर्शक वाटप',
    'landing.role_hod_b2': 'विभागाचे जोखीम मॅट्रिक्स आणि तक्रार निवारण निरीक्षण',
    'landing.role_hod_b3': 'विभागातील सर्व बॅचेसच्या विद्यार्थी पुस्तिकांची पाहणी',
    'landing.role_hod_b4': 'विद्यापीठ मानकांनुसार Excel आणि PDF अहवाल डाउनलोड करा',
    'landing.role_hod_cta': 'HOD डॅशबोर्ड →',

    'landing.role_dean_title': '🎓 डीन संस्थात्मक विश्लेषण',
    'landing.role_dean_desc': 'सर्व विभागांचे तुलनात्मक विश्लेषण, उच्च-जोखीम विद्यार्थी आढावा आणि सर्वोच्च नियामक अहवाल निर्मिती.',
    'landing.role_dean_b1': 'सर्व विभागांमधील मार्गदर्शन विश्लेषण आणि प्राध्यापक भार निर्देशांक',
    'landing.role_dean_b2': 'सर्व शाखांमधील संस्थात्मक जोखीम आणि तक्रारींचे विहंगावलोकन',
    'landing.role_dean_b3': 'NAAC/NIRF साठी प्रमाणित PDF आणि Excel अहवाल निर्मिती',
    'landing.role_dean_b4': 'सर्वोच्च तक्रार निवारण आणि वैधानिक समित्यांचे समन्वय',
    'landing.role_dean_cta': 'डीन पोर्टल →',

    'landing.role_section_title': '📋 विभाग समन्वयक कामकाज',
    'landing.role_section_desc': 'विशेष शाखा व्यवस्थापन (परीक्षा विभाग, वित्त, वसतिगृह, वाहतूक) याद्वारे विद्यार्थ्यांच्या समस्यांचे जलद निवारण.',
    'landing.role_section_b1': 'विशिष्ट विभागाकडे पाठवलेल्या तक्रारींची स्वतंत्र रांग',
    'landing.role_section_b2': 'ऑडिट लॉग आणि विद्यार्थी सूचनांसह थेट निवारण प्रक्रिया',
    'landing.role_section_b3': 'मार्गदर्शक प्राध्यापक आणि HOD यांच्याशी थेट समन्वय',
    'landing.role_section_b4': 'कामातील अडथळे ओळखणे आणि कार्यक्षमता विश्लेषण',
    'landing.role_section_cta': 'विभाग पोर्टल →',

    'landing.role_admin_title': '⚙️ प्रशासक (Admin) ऑपरेशन्स',
    'landing.role_admin_desc': 'वापरकर्ता नोंदणी, मोठ्या प्रमाणातील डेटा आयात, डुप्लिकेट नोंदी हटवणे आणि प्लॅटफॉर्म सेटिंग्जचे मुख्य नियंत्रण.',
    'landing.role_admin_b1': 'CSV/Excel फाईल्समधून स्वयंचलित मॅपिंगसह वापरकर्ता आयात',
    'landing.role_admin_b2': '१-क्लिकमध्ये डुप्लिकेट डेटाबेस नोंदी हटवणे व शुद्धीकरण',
    'landing.role_admin_b3': 'वैधानिक समित्यांचे खाते व्यवस्थापन व तक्रार जोडणी',
    'landing.role_admin_b4': 'ऑडिट लॉग ट्रॅकिंगसह संपूर्ण भूमिका व परवानग्या व्यवस्थापन',
    'landing.role_admin_cta': 'प्रशासक ऑपरेशन्स →',

    // Cloud & Ecosystem
    'landing.cloud_tag': '⚡ सर्व उपकरणांवर चालणारी क्लाउड रचना',
    'landing.cloud_title': 'कोणत्याही उपकरणावर वेगवान आणि आधुनिक अनुभव',
    'landing.cloud_desc': 'अॅप डाऊनलोड न करता मोबाईल, टॅबलेट किंवा संगणकावर कोणत्याही त्रासाशिवाय वापरता येणारा आधुनिक प्रोग्रेसिव्ह वेब प्लॅटफॉर्म.',
    'landing.pwa_title': 'कोणत्याही इन्स्टॉलेशनची गरज नाही',
    'landing.pwa_desc': 'अँड्रॉइड, आयओएस, विंडोज आणि मॅकवर कोणत्याही बाह्य अॅपशिवाय थेट ब्राउझरमध्ये त्वरित सुरू करा.',
    'landing.sync_title': 'क्लाउड फायरस्टोअर थेट समन्वय',
    'landing.sync_desc': 'पुस्तिका नोंदी, बैठकांचे नियोजन आणि तक्रारींची स्थिती विद्यार्थी आणि प्राध्यापकांच्या स्क्रीनवर एकाच वेळी त्वरित अपडेट होते.',
    'landing.p2p_title': 'सुरक्षित थेट WebRTC व्हिडिओ',
    'landing.p2p_desc': 'प्रतीक्षा कक्ष, स्क्रीन शेअरिंग आणि ऑन-डिव्हाइस रेकॉर्डिंगसह सुरक्षित व्हर्च्युअल मार्गदर्शन सत्रे.',
    'landing.badge_mobile': '📱 मोबाइल अनुकूल',
    'landing.badge_desktop': '💻 संगणक अनुकूल',
    'landing.badge_instant': '🚀 जलद सुरू',
    'landing.badge_realtime': '⚡ थेट अपडेट्स',
    'landing.badge_autosave': '🔄 आपोआप जतन',
    'landing.badge_offline': '🛡️ ऑफलाइन सुरक्षित',
    'landing.badge_e2e': '🔒 संपूर्ण एनक्रिप्टेड',
    'landing.badge_screenshare': '🎥 स्क्रीन शेअरिंग',
    'landing.badge_av': '🎙️ ऑडिओ/व्हिडिओ',
    'landing.sync_status': 'प्रणाली प्रमाणित व फायरस्टोअरशी थेट जोडलेली',
    'landing.feature_access': 'वैशिष्ट्ये उपलब्धता',
    'landing.workspace_enabled': 'संपूर्ण कार्यक्षेत्र अधिकार सक्रिय',

    // FAQs
    'landing.faq_tag': 'काही प्रश्न आहेत का?',
    'landing.faq_title': 'वारंवार विचारले जाणारे प्रश्न (FAQ)',
    'landing.faq_q1': '२५% पुस्तिका पूर्ततेची अट काय आहे?',
    'landing.faq_a1': 'संस्थेच्या नोंदींच्या अचूकतेसाठी, डॅशबोर्डची सर्व वैशिष्ट्ये उघडण्यापूर्वी विद्यार्थ्यांनी वैयक्तिक, शैक्षणिक आणि उद्दिष्टांची किमान २५% माहिती भरणे अनिवार्य आहे.',
    'landing.faq_q2': 'स्मार्ट स्वयंचलित मार्गदर्शक वाटप कसे कार्य करते?',
    'landing.faq_a2': 'प्रणाली नोंदणी क्रमांकांनुसार विद्यार्थ्यांना उपलब्ध प्राध्यापकांशी जोडते आणि प्राध्यापकांमागे कमाल २० विद्यार्थ्यांची मर्यादा काटेकोरपणे पाळते.',
    'landing.faq_q3': 'जेमिनी AI शैक्षणिक कोपायलट कशी मदत करतो?',
    'landing.faq_a3': 'विद्यार्थी अभ्यास योजना आणि सत्राची उद्दिष्टे ठरवू शकतात, तर शिक्षक बैठकीची रूपरेषा आणि मार्गदर्शन टिप्पण्या तयार करू शकतात.',
    'landing.faq_q4': 'WebRTC व्हिडिओ बैठकांमध्ये गोपनीयता आणि नियंत्रण कसे राखले जाते?',
    'landing.faq_a4': 'व्हिडिओ बैठका सुरक्षित WebRTC तंत्रज्ञानाद्वारे चालतात. मार्गदर्शक हे पूर्ण अधिकारांसह होस्ट असतात, ज्यामध्ये प्रतीक्षा कक्ष आणि स्क्रीन शेअरिंगचा समावेश आहे.',
    'landing.faq_q5': '४-स्तरीय तक्रार निवारण प्रक्रिया कशी चालते?',
    'landing.faq_a5': 'विद्यार्थ्यांची तक्रार प्रथम मार्गदर्शकाकडे जाते. तोडगा न निघाल्यास ती विभाग समन्वयक, विभागप्रमुख आणि नंतर डीन किंवा वैधानिक समितीकडे पाठवली जाते.',
    'landing.faq_q6': 'विभागप्रमुख आणि डीन NAAC आणि NIRF साठी डेटा डाउनलोड करू शकतात का?',
    'landing.faq_a6': 'होय. विभागप्रमुख, डीन आणि प्रशासक पुस्तिका नोंदी, बैठकांचे रेकॉर्ड आणि तक्रार निवारणाचे तपशीलवार Excel आणि PDF अहवाल एका क्लिकवर डाउनलोड करू शकतात.',

    // Footer
    'landing.footer_desc': 'सर्वसमावेशक संस्थात्मक मार्गदर्शन, शैक्षणिक बुद्धिमत्ता व विश्लेषण मंच. एमआयटी-एडीटी विद्यापीठात आधुनिक उच्च शिक्षणासाठी विकसित.',
    'landing.footer_quick_links': 'महत्त्वाच्या लिंक्स',
    'landing.footer_institution': 'संस्था',
    'landing.footer_rights': 'ल्युमिना मेंटरशिप प्लॅटफॉर्म. सर्व हक्क राखीव. एमआयटी-एडीटी विद्यापीठ.'
  },

  hi: {
    // Brand & General
    'brand.name': 'ल्यूमिना (Lumina)',
    'brand.kicker': 'ल्यूमिना वर्कस्पेस',
    'brand.tagline': 'संस्थागत मार्गदर्शन एवं छात्र बुद्धिमत्ता मंच',
    'brand.subtagline': 'छात्र सफलता के लिए समर्पित',
    'brand.portal_student': 'छात्र पोर्टल',
    'brand.portal_faculty': 'संकाय पोर्टल',
    'brand.portal_hod': 'विभागाध्यक्ष पोर्टल',
    'brand.portal_dean': 'डीन पोर्टल',
    'brand.portal_admin': 'प्रशासक पोर्टल',
    'brand.portal_section': 'विभाग पोर्टल',

    // Navigation Items
    'nav.dashboard': 'डैशबोर्ड',
    'nav.messages': 'संदेश',
    'nav.meetings': 'बैठकें व चर्चा',
    'nav.issues': 'शिकायतें व समस्याएं',
    'nav.tasks': 'कार्य व लक्ष्य',
    'nav.profile': 'मेरी प्रोफाइल',
    'nav.booklet': 'मार्गदर्शन पुस्तिका',
    'nav.my_students': 'मेरे छात्र',
    'nav.reports': 'रिपोर्ट एवं विश्लेषण',
    'nav.allocation': 'मेंटर आवंटन',
    'nav.management': 'शैक्षणिक प्रबंधन',
    'nav.users': 'उपयोगकर्ता निर्देशिका',
    'nav.risk_students': 'जोखिम में छात्र',
    'nav.escalations': 'उच्च स्तर पर भेजी शिकायतें',
    'nav.analytics': 'संस्थागत एनालिटिक्स',
    'nav.compliance': 'पुस्तिका अनुपालन',
    'nav.departments': 'विभाग',
    'nav.settings': 'प्लेटफ़ॉर्म सेटिंग्स',
    'nav.infrastructure': 'सिस्टम इंटेलिजेंस',
    'nav.landing': 'मुख्य पृष्ठ',
    'nav.copilot_trigger': 'AI कोपायलट ✨',
    'nav.logout': 'लॉग आउट',

    // Header Actions
    'header.copilot': 'AI कोपायलट',
    'header.copilot_title': 'ल्यूमिना AI कोपायलट खोलें (Ctrl + /)',
    'header.web_issue': 'समस्या दर्ज करें',
    'header.web_issue_title': 'वेब समस्या या बग की रिपोर्ट करें',
    'header.pdf_guide': 'मार्गदर्शिका (PDF)',
    'header.pdf_guide_title': 'भूमिका संचालन नियमावली डाउनलोड करें (PDF)',
    'header.notifications': 'सूचनाएं',
    'header.mark_all_read': 'सभी को पढ़ा हुआ चिह्नित करें',
    'header.no_notifications': 'कोई नई सूचना नहीं है',
    'header.profile_tooltip': 'प्रोफ़ाइल देखने व संपादित करने के लिए क्लिक करें',
    'header.switch_language': 'भाषा चुनें',

    // Roles
    'role.student': 'विद्यार्थी / छात्र',
    'role.mentor': 'मेंटर / मार्गदर्शक',
    'role.faculty': 'शिक्षक / प्राध्यापक',
    'role.hod': 'विभागाध्यक्ष (HOD)',
    'role.dean': 'डीन (Dean)',
    'role.admin': 'प्रशासक (Admin)',
    'role.section_head': 'सेक्शन हेड',

    // Common UI & Statuses
    'common.save': 'परिवर्तन सहेजें',
    'common.cancel': 'रद्द करें',
    'common.close': 'बंद करें',
    'common.submit': 'जमा करें',
    'common.edit': 'संपादित करें',
    'common.delete': 'हटाएं',
    'common.search': 'खोजें...',
    'common.filter': 'फ़िल्टर',
    'common.export': 'निर्यात करें',
    'common.download': 'डाउनलोड करें',
    'common.view': 'देखें',
    'common.retry': 'पुनः प्रयास करें',
    'common.loading': 'लोड हो रहा है...',
    'common.actions': 'कार्रवाई',
    'common.status': 'स्थिति',
    'common.date': 'दिनांक',
    'common.time': 'समय',
    'common.details': 'विवरण',
    'common.none': 'कोई नहीं',
    'common.back': 'वापस जाएं',
    'common.confirm': 'पुष्टि करें',
    'common.active': 'सक्रिय',
    'common.all': 'सभी',
    'common.more': 'अधिक',

    // Status Values
    'status.approved': 'स्वीकृत',
    'status.pending': 'लंबित',
    'status.rejected': 'अस्वीकृत',
    'status.completed': 'पूर्ण',
    'status.in_progress': 'प्रगति पर',
    'status.open': 'खुला',
    'status.resolved': 'हल हुआ',
    'status.closed': 'बंद',
    'status.ongoing': 'जारी है',
    'status.scheduled': 'निर्धारित',
    'status.high': 'उच्च जोखिम',
    'status.medium': 'मध्यम जोखिम',
    'status.low': 'कम जोखिम',

    // Login Page
    'login.title': 'पुनः स्वागत है!',
    'login.subtitle': 'अपने शैक्षणिक पोर्टल में प्रवेश के लिए साइन इन करें',
    'login.email': 'ईमेल पता',
    'login.email_placeholder': 'student@university.edu',
    'login.password': 'पासवर्ड',
    'login.password_placeholder': '••••••••',
    'login.forgot_password': 'पासवर्ड भूल गए?',
    'login.sign_in': 'साइन इन करें',
    'login.signing_in': 'साइन इन हो रहा है...',
    'login.no_account': 'खाता नहीं है?',
    'login.create_account': 'नया खाता बनाएं',
    'login.reset_title': 'पासवर्ड रीसेट करें',
    'login.reset_desc': 'अपना पंजीकृत ईमेल दर्ज करें और हम पासवर्ड रीसेट करने का लिंक भेजेंगे।',
    'login.send_reset_link': 'रीसेट लिंक भेजें',

    // Registration Page
    'register.title': 'ल्यूमिना से जुड़ें',
    'register.subtitle': 'मार्गदर्शकों और संकाय से जुड़ने के लिए अपना शैक्षणिक खाता बनाएं',
    'register.as': 'भूमिका चुनें',
    'register.full_name': 'पूरा नाम',
    'register.full_name_placeholder': 'उदा. राहुल शर्मा',
    'register.email': 'विश्वविद्यालय ईमेल',
    'register.email_placeholder': 'rahul@university.edu',
    'register.password': 'पासवर्ड',
    'register.confirm_password': 'पासवर्ड की पुष्टि करें',
    'register.department': 'विभाग',
    'register.class': 'कक्षा',
    'register.year': 'वर्ष',
    'register.year_1': 'प्रथम वर्ष',
    'register.year_2': 'द्वितीय वर्ष',
    'register.year_3': 'तृतीय वर्ष',
    'register.year_4': 'अंतिम वर्ष',
    'register.enrollment': 'नामांकन / पीआरएन (PRN) संख्या',
    'register.enrollment_placeholder': 'उदा. EN2024001',
    'register.designation': 'पदनाम',
    'register.submit': 'पंजीकरण पूरा करें',
    'register.already_registered': 'पहले से खाता है?',
    'register.sign_in': 'साइन इन करें',

    // Student Dashboard
    'dash.welcome': 'स्वागत है, {name}!',
    'dash.academic_overview': 'शैक्षणिक एवं मेंटरशिप समीक्षा',
    'dash.stat_meetings': 'सक्रिय बैठकें',
    'dash.stat_tasks': 'लंबित कार्य',
    'dash.stat_issues': 'सक्रिय समस्याएं',
    'dash.stat_booklet': 'पुस्तिका पूर्णता',
    'dash.mentor_card_title': 'आवंटित मेंटर प्राध्यापक',
    'dash.no_mentor': 'अभी तक कोई मेंटर आवंटित नहीं हुआ है। कृपया अपने विभागाध्यक्ष से संपर्क करें।',
    'dash.booklet_alert_title': 'मेंटरशिप पुस्तिका भरना अनिवार्य',
    'dash.booklet_alert_desc': 'सभी सुविधाओं का लाभ उठाने के लिए डिजिटल पुस्तिका का न्यूनतम २५% भाग अवश्य भरें।',
    'dash.complete_booklet_btn': 'अभी पुस्तिका भरें',
    'dash.upcoming_meetings': 'आगामी बैठकें',
    'dash.no_upcoming_meetings': 'कोई आगामी बैठक निर्धारित नहीं है।',
    'dash.schedule_meeting_btn': 'बैठक का अनुरोध करें',
    'dash.recent_tasks': 'महत्वपूर्ण कार्य',
    'dash.no_tasks': 'कोई लंबित कार्य नहीं है।',
    'dash.quick_actions': 'त्वरित कार्य',

    // Landing Page
    'landing.nav_features': 'विशेषताएं',
    'landing.nav_portals': 'पोर्टल्स',
    'landing.nav_compliance': 'अनुपालन',
    'landing.nav_security': 'सुरक्षा',
    'landing.nav_signin': 'साइन इन',
    'landing.nav_dashboard': 'डैशबोर्ड पर जाएं',
    'landing.badge': 'संस्थागत मेंटरशिप और छात्र बुद्धिमत्ता मंच',
    'landing.hero_title_1': 'अत्याधुनिक मेंटरशिप व्यवस्था,',
    'landing.hero_title_2': 'कागज़रहित संचालन, असीमित परिणाम।',
    'landing.hero_desc': 'छात्र मेंटरशिप बुकलेट, AI शैक्षणिक कोपायलट, उच्च गुणवत्ता वीडियो बैठकें और संस्थागत शिकायत निवारण को एक मंच पर लाने वाली प्रमुख विश्वविद्यालयों की प्रणाली।',
    'landing.cta_get_started': 'निःशुल्क शुरुआत करें',
    'landing.cta_explore': 'वास्तुकला एवं विशेषताएं देखें',
    'landing.stat_students': 'मार्गदर्शन प्राप्त छात्र',
    'landing.stat_meetings': 'संपन्न बैठकें',
    'landing.stat_departments': 'संबंधित शैक्षणिक विभाग',
    'landing.stat_paperless': 'कागज़रहित अनुपालन दर',
    'landing.stat_ratio': '२०:१ अधिकतम छात्र अनुपात',

    // Pilot Recognition
    'landing.pilot_badge': 'तृतीय वर्ष (TY) सीएसई कोर पायलट मान्यता',
    'landing.pilot_title': 'विशेष आभार एवं मार्गदर्शन मान्यता',
    'landing.pilot_desc': 'हम एमआईटी-एडीटी विश्वविद्यालय में टीवाई सीएसई कोर बैच के लिए ल्यूमिना मेंटरशिप प्लेटफॉर्म की शुरुआत करने में उनकी दूरदर्शी अगुवाई, निरंतर मार्गदर्शन और अनुकरणीय पहल के लिए सीएसई कोर की विभागाध्यक्ष (HOD) डॉ. सुवर्णा पवार मैम के प्रति हार्दिक आभार और विशेष मान्यता व्यक्त करते हैं। उनका निरंतर सहयोग और बहुमूल्य प्रतिक्रिया अकादमिक उत्कृष्टता और छात्रों की सफलता को बढ़ावा देने में अत्यंत महत्वपूर्ण रही है।',

    // Credits
    'landing.credits_tag': 'प्रोजेक्ट श्रेय',
    'landing.credits_title': 'मार्गदर्शन एवं योगदानकर्ता',
    'landing.credits_desc': 'ल्यूमिना मेंटरशिप प्लेटफॉर्म के विकास के पीछे संकाय मार्गदर्शन और डेवलपमेंट टीम की मान्यता।',
    'landing.guide_under': 'मार्गदर्शन',
    'landing.guide_role': 'सहायक प्राध्यापक',
    'landing.guide_desc': 'विकास प्रक्रिया के दौरान संकाय मार्गदर्शन, परियोजना संचालन और शैक्षणिक समन्वय प्रदान किया।',
    'landing.lead_tag': 'छात्र टीम लीड',
    'landing.lead_role': 'विद्यार्थी टीम प्रमुख',
    'landing.lead_desc': 'संपूर्ण सिस्टम डिजाइन और डिप्लॉयमेंट की देखरेख करने वाले मुख्य आर्किटेक्ट और डेवलपर।',
    'landing.member_tag': 'योगदानकर्ता',
    'landing.member_role': 'विद्यार्थी टीम सदस्य',
    'landing.member_1_desc': 'सुविधाओं के कार्यान्वयन और परीक्षण में सहायता करने वाले योगदानकर्ता।',
    'landing.member_2_desc': 'प्लेटफॉर्म विकास, नई सुविधाओं के विस्तार और परीक्षण में सहायता करने वाले योगदानकर्ता।',

    // Platform Features
    'landing.features_tag': 'प्लेटफॉर्म उत्कृष्टता',
    'landing.features_title': 'आधुनिक संस्थागत आवश्यकताओं के लिए निर्मित',
    'landing.features_desc': 'उच्च-प्रदर्शन, डेटा-संचालित मेंटरशिप ढांचे का प्रबंधन करने के लिए आपके विश्वविद्यालय के लिए एक सुदृढ़ और सिद्ध आर्किटेक्चर।',
    'landing.feat_alloc_title': 'स्मार्ट स्वतः मेंटर आवंटन',
    'landing.feat_alloc_desc': 'नामांकन पीआरएन क्रम और प्रति मेंटर अधिकतम २० छात्रों की सीमा के आधार पर संकाय मेंटर्स को छात्र निष्पक्षता और संतुलन के साथ आवंटित किए जाते हैं।',
    'landing.feat_booklet_title': 'कागज़रहित डिजिटल मेंटरशिप बुकलेट',
    'landing.feat_booklet_desc': 'व्यक्तिगत प्रोफ़ाइल, स्वास्थ्य, शैक्षणिक प्रदर्शन और सह-पाठ्यचर्या रिकॉर्ड का अनिवार्य न्यूनतम २५% पूर्णता के साथ डिजिटल संचयन।',
    'landing.feat_copilot_title': 'जेमिनी AI शैक्षणिक कोपायलट',
    'landing.feat_copilot_desc': 'सेमेस्टर लक्ष्यों, शिकायत विवरण और अध्ययन समय सारिणी तैयार करने में मदद के लिए संस्थागत सुरक्षा से युक्त कृत्रिम बुद्धिमत्ता।',
    'landing.feat_webrtc_title': 'सर्वरलेस WebRTC वीडियो बैठकें',
    'landing.feat_webrtc_desc': 'प्रतीक्षा कक्ष, स्क्रीन शेयरिंग और होस्ट नियंत्रण के साथ सुरक्षित और उच्च-गुणवत्ता वाली १-ऑन-१ और समूह वीडियो बैठकें।',
    'landing.feat_escalation_title': '४-स्तरीय शिकायत निवारण प्रणाली',
    'landing.feat_escalation_desc': 'छात्र → मेंटर → सेक्शन हेड → विभागाध्यक्ष → डीन तक पारदर्शी, समयबद्ध और ऑडिट रिकॉर्ड से युक्त निवारण प्रणाली।',
    'landing.feat_statutory_title': 'वैधानिक समितियां एवं छात्र कल्याण',
    'landing.feat_statutory_desc': 'रैगिंग-विरोधी, महिला आंतरिक शिकायत समिति (ICC), एससी/एसटी सेल और छात्र शिकायत निवारण के लिए समर्पित गोपनीय चैनल।',
    'landing.feat_risk_title': 'संस्थागत जोखिम एवं प्रारंभिक चेतावनी',
    'landing.feat_risk_desc': 'सीजीपीए और उपस्थिति का विश्लेषण कर उच्च, मध्यम व निम्न जोखिम वाले छात्रों की समय रहते पहचान व संकाय हस्तक्षेप।',
    'landing.feat_naac_title': 'NAAC एवं NIRF प्रत्यायन रिपोर्ट',
    'landing.feat_naac_desc': 'नियामक ऑडिट के लिए मेंटर-मेंटी संवाद, उपस्थिति और शैक्षणिक प्रगति की प्रमाणित पीडीएफ और एक्सेल रिपोर्ट १-क्लिक में तैयार करें।',
    'landing.feat_bulk_title': 'डेटा आयात एवं रिकॉर्ड शुद्धिकरण',
    'landing.feat_bulk_desc': 'सीएसवी या एक्सेल फाइलों से सैकड़ों प्रोफाइल का तीव्र आयात और १-क्लिक में डुप्लिकेट डेटाबेस रिकॉर्ड हटाने की सुविधा।',

    // Roles Section
    'landing.roles_tag': 'अनुकूलित कार्यक्षेत्र',
    'landing.roles_title': 'प्रत्येक हितधारक के लिए विशेष रूप से डिज़ाइन किया गया',
    'landing.roles_desc': 'छात्रों, मेंटर्स, विभागाध्यक्षों, डीन, सेक्शन हेड और प्रशासकों के लिए विशेष इंटरफेस और अनुमतियां।',
    'landing.role_student_title': '🎓 छात्र पोर्टल अनुभव',
    'landing.role_student_desc': 'डिजिटल बुकलेट भरें, सीजीपीए और उपस्थिति ट्रैक करें, मेंटर्स के साथ बैठकें तय करें और जेमिनी AI का लाभ उठाएं।',
    'landing.role_student_b1': '२५% अनिवार्य बुकलेट पूर्णता ट्रैकर एवं प्रोफ़ाइल प्रबंधन',
    'landing.role_student_b2': 'उच्च-गुणवत्ता WebRTC वीडियो बैठकों का अनुरोध करें और जुड़ें',
    'landing.role_student_b3': 'आवंटित मेंटर प्राध्यापक के साथ सीधा रियल-टाइम संदेशवहन',
    'landing.role_student_b4': '४-स्तरीय निवारण दृश्यता के साथ शैक्षणिक शिकायतें दर्ज करें',
    'landing.role_student_b5': 'अध्ययन कार्यक्रम और लक्ष्य निर्धारण के लिए जेमिनी AI कोपायलट',
    'landing.role_student_cta': 'छात्र के रूप में लॉगिन करें →',

    'landing.role_mentor_title': '👨‍🏫 मेंटर एवं संकाय केंद्र',
    'landing.role_mentor_desc': 'अपने आवंटित मेंटी कोटा (अधिकतम २० छात्र) का प्रबंधन करें, डिजिटल बुकलेट जांचें और बैठकें आयोजित करें।',
    'landing.role_mentor_b1': 'रियल-टाइम मेंटी निर्देशिका एवं क्षमता निगरानी (अधिकतम २० छात्र)',
    'landing.role_mentor_b2': 'डिजिटल बुकलेट की समीक्षा, अनुमोदन और गुणात्मक मार्गदर्शन टिप्पणी',
    'landing.role_mentor_b3': 'प्रतीक्षा कक्ष मॉडरेशन के साथ WebRTC वीडियो कॉल आयोजित करें',
    'landing.role_mentor_b4': 'शैक्षणिक रूप से कमजोर छात्रों की त्वरित पहचान व चेतावनी',
    'landing.role_mentor_b5': 'अनसुलझे मुद्दों को सीधे सेक्शन हेड या HOD को अग्रेषित करें',
    'landing.role_mentor_cta': 'मेंटर के रूप में लॉगिन करें →',

    'landing.role_hod_title': '🏛 विभागाध्यक्ष (HOD) प्रशासन',
    'landing.role_hod_desc': 'विभाग-स्तरीय मेंटरशिप प्रबंधन, छात्रों का स्वतः मेंटर आवंटन, जोखिम मैट्रिक्स और रिपोर्ट निर्माण।',
    'landing.role_hod_b1': 'पीआरएन क्रम के आधार पर छात्रों का स्वतः मेंटर आवंटन',
    'landing.role_hod_b2': 'विभागीय उच्च-जोखिम मैट्रिक्स और बहु-स्तरीय शिकायत समीक्षा',
    'landing.role_hod_b3': 'विभाग के सभी बैचों के छात्र बुकलेट रिकॉर्ड का निरीक्षण',
    'landing.role_hod_b4': 'विश्वविद्यालय मानकों के अनुरूप एक्सेल और पीडीएफ रिपोर्ट डाउनलोड',
    'landing.role_hod_cta': 'HOD डैशबोर्ड →',

    'landing.role_dean_title': '🎓 डीन संस्थागत एनालिटिक्स',
    'landing.role_dean_desc': 'संस्था-स्तरीय एनालिटिक्स डैशबोर्ड, विभाग तुलना, उच्च-जोखिम छात्र समीक्षा और सर्वोच्च प्रत्यायन रिपोर्टिंग।',
    'landing.role_dean_b1': 'सभी विभागों का मेंटरशिप विश्लेषण और संकाय कार्यभार सूचकांक',
    'landing.role_dean_b2': 'सभी शाखाओं में संस्थागत जोखिम और शिकायतों का समग्र अवलोकन',
    'landing.role_dean_b3': 'NAAC/NIRF ऑडिट के लिए कार्यकारी पीडीएफ और एक्सेल रिपोर्ट जनरेटर',
    'landing.role_dean_b4': 'शीर्ष शिकायत निवारण और वैधानिक समितियों का समन्वय',
    'landing.role_dean_cta': 'डीन पोर्टल →',

    'landing.role_section_title': '📋 सेक्शन हेड संचालन',
    'landing.role_section_desc': 'विशेष क्षेत्र प्रबंधन (परीक्षा सेल, लेखा, छात्रावास, परिवहन) ताकि छात्र समस्याओं का त्वरित समाधान हो सके।',
    'landing.role_section_b1': 'विशिष्ट सेक्शन को भेजी गई छात्र समस्याओं की समर्पित कतार',
    'landing.role_section_b2': 'ऑडिट लॉग और छात्र सूचनाओं के साथ सीधे निवारण वर्कफ़्लो',
    'landing.role_section_b3': 'संकाय मेंटर्स और HOD के साथ अंतर-विभागीय समन्वय',
    'landing.role_section_b4': 'कार्य संचालन की अड़चनों की पहचान और प्रदर्शन विश्लेषण',
    'landing.role_section_cta': 'सेक्शन पोर्टल →',

    'landing.role_admin_title': '⚙️ एडमिन सिस्टम संचालन',
    'landing.role_admin_desc': 'उपयोगकर्ता पंजीकरण, बल्क डेटा आयात, डुप्लिकेट डेटा सफ़ाई और प्लेटफ़ॉर्म सेटिंग्स का मास्टर नियंत्रण केंद्र।',
    'landing.role_admin_b1': 'कॉलम मैपिंग के साथ सीएसवी/एक्सेल से उपयोगकर्ता बल्क आयात',
    'landing.role_admin_b2': '१-क्लिक डुप्लिकेट डेटाबेस रिकॉर्ड क्लीनर और सामान्यीकरण',
    'landing.role_admin_b3': 'वैधानिक समितियों का खाता प्रबंधन और शिकायत रूटिंग',
    'landing.role_admin_b4': 'ऑडिट लॉग ट्रैकिंग के साथ संपूर्ण भूमिका व अनुमति प्रबंधन',
    'landing.role_admin_cta': 'एडमिन संचालन →',

    // Cloud & Ecosystem
    'landing.cloud_tag': '⚡ क्लाउड एवं डिवाइस अनुकूल आर्किटेक्चर',
    'landing.cloud_title': 'सभी डिवाइसों पर आधुनिक, रियल-टाइम वेब अनुभव',
    'landing.cloud_desc': 'बिना किसी ऐप इंस्टॉलेशन के मोबाइल, टैबलेट और डेस्कटॉप पर हाई-डेफिनिशन वीडियो, डिजिटल बुकलेट और एनालिटिक्स तक निर्बाध पहुंच।',
    'landing.pwa_title': 'शून्य-इंस्टॉल वेब पहुंच',
    'landing.pwa_desc': 'एंड्रॉइड, आईओएस, विंडोज और मैक पर किसी बाहरी पैकेज या अनुमति के बिना तुरंत ब्राउज़र में खोलें।',
    'landing.sync_title': 'क्लाउड फायरस्टोर सिंक्रोनाइज़ेशन',
    'landing.sync_desc': 'छात्र बुकलेट, उपस्थिति, बैठक और शिकायतों की स्थिति संकाय और छात्र स्क्रीन पर एक साथ तुरंत अपडेट होती है।',
    'landing.p2p_title': 'सुरक्षित पीयर-टू-पीयर WebRTC वीडियो',
    'landing.p2p_desc': 'प्रतीक्षा कक्ष, स्क्रीन शेयरिंग और स्थानीय रिकॉर्डिंग के साथ सुरक्षित १-ऑन-१ और समूह मेंटरशिप सत्र।',
    'landing.badge_mobile': '📱 मोबाइल अनुकूल',
    'landing.badge_desktop': '💻 डेस्कटॉप अनुकूल',
    'landing.badge_instant': '🚀 त्वरित लोड',
    'landing.badge_realtime': '⚡ रियल-टाइम स्नैपशॉट',
    'landing.badge_autosave': '🔄 स्वतः सहेजना',
    'landing.badge_offline': '🛡️ ऑफ़लाइन सुरक्षित',
    'landing.badge_e2e': '🔒 एंड-टू-एंड एन्क्रिप्टेड',
    'landing.badge_screenshare': '🎥 स्क्रीन शेयर',
    'landing.badge_av': '🎙️ ऑडियो/वीडियो',
    'landing.sync_status': 'सिस्टम सत्यापित एवं फायरस्टोर से सिंक्रनाइज़',
    'landing.feature_access': 'सुविधा पहुंच',
    'landing.workspace_enabled': 'पूर्ण कार्यक्षेत्र विशेषाधिकार सक्षम',

    // FAQs
    'landing.faq_tag': 'कोई प्रश्न हैं?',
    'landing.faq_title': 'अक्सर पूछे जाने वाले प्रश्न (FAQ)',
    'landing.faq_q1': '२५% बुकलेट पूर्णता की क्या आवश्यकता है?',
    'landing.faq_a1': 'संस्थागत रिकॉर्ड की प्रामाणिकता सुनिश्चित करने के लिए, डैशबोर्ड की सभी सुविधाएं खोलने से पहले छात्रों को व्यक्तिगत, शैक्षणिक और स्वास्थ्य विवरण का न्यूनतम २५% भाग भरना अनिवार्य है।',
    'landing.faq_q2': 'स्मार्ट स्वतः क्षमता आवंटन कैसे कार्य करता है?',
    'landing.faq_a2': 'आवंटन प्रणाली छात्रों को पीआरएन क्रम से उपलब्ध शिक्षकों से जोड़ती है और प्रति शिक्षक अधिकतम २० छात्रों की सीमा का कड़ाई से पालन करती है।',
    'landing.faq_q3': 'जेमिनी AI शैक्षणिक कोपायलट कैसे सहायता करता है?',
    'landing.faq_a3': 'छात्र अध्ययन योजनाएं और शिकायत प्रारूप तैयार कर सकते हैं, जबकि संकाय बैठक की रूपरेखा और मार्गदर्शन नोट्स तैयार कर सकते हैं।',
    'landing.faq_q4': 'WebRTC वीडियो बैठकों में गोपनीयता और नियंत्रण कैसे सुनिश्चित होता है?',
    'landing.faq_a4': 'वीडियो सत्र सुरक्षित WebRTC तकनीक से चलते हैं। मेंटर्स प्रतीक्षा कक्ष नियंत्रण, स्क्रीन शेयरिंग और रिकॉर्डिंग अधिकारों के साथ होस्ट होते हैं।',
    'landing.faq_q5': '४-स्तरीय शिकायत निवारण प्रक्रिया कैसे संचालित होती है?',
    'landing.faq_a5': 'छात्र की शिकायत पहले मेंटर के पास जाती है। समाधान न होने पर यह सेक्शन हेड, विभागाध्यक्ष और फिर डीन या वैधानिक समिति को अग्रेषित की जाती है।',
    'landing.faq_q6': 'क्या विभागाध्यक्ष और डीन NAAC और NIRF के लिए डेटा डाउनलोड कर सकते हैं?',
    'landing.faq_a6': 'हाँ, विभागाध्यक्ष, डीन और प्रशासक बुकलेट रिकॉर्ड, बैठक लॉग और शिकायत निवारण की विस्तृत एक्सेल और पीडीएफ रिपोर्ट १-क्लिक में डाउनलोड कर सकते हैं।',

    // Footer
    'landing.footer_desc': 'व्यापक संस्थागत मेंटरशिप, शैक्षणिक बुद्धिमत्ता और एनालिटिक्स इकोसिस्टम। आधुनिक उच्च शिक्षा के लिए एमआईटी-एडीटी विश्वविद्यालय में विकसित।',
    'landing.footer_quick_links': 'महत्वपूर्ण लिंक्स',
    'landing.footer_institution': 'संस्था',
    'landing.footer_rights': 'ल्यूमिना मेंटरशिप प्लेटफ़ॉर्म। सर्वाधिकार सुरक्षित। एमआईटी-एडीटी विश्वविद्यालय।'
  }
};

let currentLocale = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || DEFAULT_LOCALE;
if (!['en', 'mr', 'hi'].includes(currentLocale)) {
  currentLocale = DEFAULT_LOCALE;
}

/**
 * Get active locale code ('en', 'mr', 'hi')
 */
export function getLanguage() {
  return currentLocale;
}

/**
 * Translate a key into the active locale with optional interpolation
 * @param {string} key
 * @param {string} fallback
 * @param {Record<string, string|number>} params
 */
export function t(key, fallback = '', params = {}) {
  const dict = translations[currentLocale] || translations.en;
  let text = dict[key] || translations.en[key] || fallback || key;

  if (params && typeof params === 'object') {
    Object.keys(params).forEach(k => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]));
    });
  }
  return text;
}

/**
 * Set active language, persist to localStorage, update document attribute, and broadcast event
 * @param {'en'|'mr'|'hi'} lang
 */
export function setLanguage(lang) {
  if (!['en', 'mr', 'hi'].includes(lang)) return;
  currentLocale = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    console.warn('Could not save language preference:', e);
  }

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
  }

  // Dispatch global custom event for reactive UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lumina:lang-changed', {
      detail: { lang, labels: translations[lang] }
    }));
  }
}

/**
 * Register callback for language change
 * @param {(detail: { lang: string }) => void} callback
 */
export function onLanguageChange(callback) {
  if (typeof window !== 'undefined') {
    window.addEventListener('lumina:lang-changed', (e) => callback(e.detail));
  }
}

/**
 * Render language selector widget
 * @param {'header'|'landing'|'auth'|'sidebar'} variant
 */
export function renderLanguageSelector(variant = 'header') {
  const lang = getLanguage();

  if (variant === 'header') {
    return `
      <div class="lumina-lang-toggle" id="lumina-global-lang-toggle" role="group" aria-label="Select Language">
        <i class="ph ph-translate lang-icon-globe" title="Change Language / भाषा बदला"></i>
        ${SUPPORTED_LANGUAGES.map(item => `
          <button
            type="button"
            class="lumina-lang-pill ${lang === item.code ? 'active' : ''}"
            data-lang-code="${item.code}"
            title="${item.label} (${item.code.toUpperCase()})"
            aria-pressed="${lang === item.code}">
            <span class="lang-short">${item.shortLabel}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  if (variant === 'landing') {
    return `
      <div class="landing-lang-switcher" id="landing-lang-switcher">
        <div class="lumina-lang-toggle landing-style" role="group" aria-label="Select Language">
          <i class="ph ph-translate lang-icon-globe" style="font-size:1.05rem;color:var(--accent);"></i>
          ${SUPPORTED_LANGUAGES.map(item => `
            <button
              type="button"
              class="lumina-lang-pill ${lang === item.code ? 'active' : ''}"
              data-lang-code="${item.code}"
              title="${item.label}">
              <span class="lang-short">${item.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Auth / Card style
  return `
    <div class="auth-lang-selector" style="display:inline-flex;align-items:center;background:var(--bg-secondary);border:1px solid var(--border);border-radius:24px;padding:3px 6px;gap:3px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <i class="ph ph-translate" style="font-size:0.95rem;color:var(--accent);margin-left:4px;margin-right:2px;"></i>
      ${SUPPORTED_LANGUAGES.map(item => `
        <button
          type="button"
          class="auth-lang-btn ${lang === item.code ? 'active' : ''}"
          data-lang-code="${item.code}"
          style="border:none;background:${lang === item.code ? 'var(--accent)' : 'transparent'};color:${lang === item.code ? '#ffffff' : 'var(--text-secondary)'};font-size:0.75rem;font-weight:600;padding:4px 9px;border-radius:14px;cursor:pointer;transition:all 0.2s ease;">
          ${item.shortLabel}
        </button>
      `).join('')}
    </div>
  `;
}

/**
 * Attach global click delegation for all language selector buttons
 */
if (typeof document !== 'undefined') {
  // Set initial html lang attribute
  document.documentElement.setAttribute('lang', currentLocale);
  document.documentElement.setAttribute('data-lang', currentLocale);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang-code]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const code = btn.getAttribute('data-lang-code');
      if (code && code !== currentLocale) {
        setLanguage(code);
      }
    }
  });
}
