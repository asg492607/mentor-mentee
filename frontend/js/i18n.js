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
    'landing.nav_portals': 'Portals',
    'landing.nav_compliance': 'Compliance',
    'landing.nav_security': 'Security',
    'landing.nav_signin': 'Sign In',
    'landing.nav_dashboard': 'Go to Dashboard',
    'landing.badge': 'Institutional Mentorship & Student Intelligence',
    'landing.hero_title_1': 'Next-Gen Mentorship,',
    'landing.hero_title_2': 'Zero Paperwork, Infinite Impact.',
    'landing.hero_desc': 'The all-in-one platform unifying student mentorship booklets, AI-powered academic copilots, high-definition WebRTC video meetings, and institutional grievance escalation for premier universities.',
    'landing.cta_get_started': 'Get Started Free',
    'landing.cta_explore': 'Explore System Architecture',
    'landing.stat_students': 'Active Students Mentored',
    'landing.stat_meetings': 'Meetings Conducted',
    'landing.stat_departments': 'Accredited Departments',
    'landing.stat_paperless': 'Paperless Compliance Rate',
    'landing.features_title': 'Built for Excellence in Higher Education',
    'landing.features_desc': 'Engineered to comply with NAAC & NIRF quality frameworks while delivering a delightful user experience for students, mentors, and administrators.',
    'landing.feature_1_title': 'Paperless Mentorship Booklet',
    'landing.feature_1_desc': 'Digital records for personal, academic, extracurricular, and semester performance with automated versioning.',
    'landing.feature_2_title': 'AI Academic Copilot',
    'landing.feature_2_desc': 'Context-aware intelligence generating study roadmaps, exam prep strategies, and automated meeting minutes.',
    'landing.feature_3_title': 'Real-Time Video Rooms',
    'landing.feature_3_desc': 'Encrypted WebRTC meetings with collaborative whiteboards, live code execution sandbox, and live notes.',
    'landing.feature_4_title': '4-Tier Grievance Escalation',
    'landing.feature_4_desc': 'Seamless escalation pipeline: Student → Mentor → HOD → Dean with audit trails and SLA tracking.'
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
    'landing.nav_portals': 'पोर्टल्स',
    'landing.nav_compliance': 'अनुपालन',
    'landing.nav_security': 'सुरक्षा',
    'landing.nav_signin': 'लॉगिन करा',
    'landing.nav_dashboard': 'डॅशबोर्डवर जा',
    'landing.badge': 'संस्थात्मक मार्गदर्शन आणि विद्यार्थी बुद्धिमत्ता मंच',
    'landing.hero_title_1': 'आधुनिक मार्गदर्शन प्रणाली,',
    'landing.hero_title_2': 'कागदविरहित कार्यपद्धती, अथांग प्रगती.',
    'landing.hero_desc': 'विद्यार्थी मार्गदर्शन पुस्तिका, AI शैक्षणिक सहाय्यक, उच्च दर्जाच्या व्हिडिओ बैठका आणि संस्थात्मक तक्रार निवारण एकत्रित करणारा अग्रगण्य विद्यापीठांसाठीचा संपूर्ण मंच.',
    'landing.cta_get_started': 'विनामूल्य सुरू करा',
    'landing.cta_explore': 'रचना व वैशिष्ट्ये पहा',
    'landing.stat_students': 'मार्गदर्शन घेणारे विद्यार्थी',
    'landing.stat_meetings': 'यशस्वी बैठका',
    'landing.stat_departments': 'संलग्न शैक्षणिक विभाग',
    'landing.stat_paperless': 'कागदविरहित अनुपालन दर',
    'landing.features_title': 'उच्च शिक्षणात गुणवत्तेसाठी सज्ज',
    'landing.features_desc': 'NAAC आणि NIRF मानकांचे पालन करत विद्यार्थी, मार्गदर्शक आणि प्रशासकांसाठी एक उत्कृष्ट अनुभव देण्यासाठी डिझाइन केलेले.',
    'landing.feature_1_title': 'कागदविरहित डिजिटल पुस्तिका',
    'landing.feature_1_desc': 'वैयक्तिक, शैक्षणिक आणि सह-अभ्यासक्रमाच्या नोंदी स्वयंचलित आवृत्त्यांसह सुरक्षित डिजिटल स्वरूपात जतन करा.',
    'landing.feature_2_title': 'AI शैक्षणिक कोपायलट',
    'landing.feature_2_desc': 'अभ्यास योजना, परीक्षा तयारी आणि बैठकींच्या स्वयंचलित टिपणांसाठी कृत्रिम बुद्धिमत्तेचा स्मार्ट वापर.',
    'landing.feature_3_title': 'थेट व्हिडिओ वर्ग व बैठका',
    'landing.feature_3_desc': 'सुरक्षित WebRTC तंत्रज्ञानाद्वारे व्हाइटबोर्ड, कोड सँडबॉक्स आणि थेट नोट्ससह परस्परसंवादी संवाद.',
    'landing.feature_4_title': '४-स्तरीय तक्रार निवारण',
    'landing.feature_4_desc': 'विद्यार्थी → मार्गदर्शक → विभागप्रमुख → डीन अशी पारदर्शक आणि वेळेत तक्रार निवारण व्यवस्था.'
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
    'landing.features_title': 'उच्च शिक्षा में उत्कृष्टता के लिए निर्मित',
    'landing.features_desc': 'NAAC और NIRF गुणवत्ता मानकों के अनुरूप छात्र, मेंटर और प्रशासकों को सर्वोत्तम डिजिटल अनुभव प्रदान करता है।',
    'landing.feature_1_title': 'कागज़रहित मेंटरशिप बुकलेट',
    'landing.feature_1_desc': 'व्यक्तिगत, शैक्षणिक और सह-पाठ्यचर्या रिकॉर्ड का सुरक्षित डिजिटल संचयन और स्वतः संस्करण प्रबंधन।',
    'landing.feature_2_title': 'AI शैक्षणिक कोपायलट',
    'landing.feature_2_desc': 'अध्ययन रोडमैप, परीक्षा तैयारी रणनीतियों और स्वचालित बैठक विवरण के लिए उपयोगी कृत्रिम बुद्धिमत्ता।',
    'landing.feature_3_title': 'लाइव वीडियो बैठकें',
    'landing.feature_3_desc': 'सुरक्षित WebRTC वीडियो, व्हाइटबोर्ड, कोड सैंडबॉक्स और लाइव नोट्स के साथ प्रभावी शैक्षणिक संवाद।',
    'landing.feature_4_title': '४-स्तरीय शिकायत निवारण',
    'landing.feature_4_desc': 'छात्र → मेंटर → विभागाध्यक्ष → डीन तक पारदर्शी, समयबद्ध और ऑडिट युक्त निवारण प्रणाली।'
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
