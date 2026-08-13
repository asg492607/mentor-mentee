import { getUserProfile } from '../auth.js';
import { navigateTo } from '../router.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="landing-page" style="min-height:100vh;display:flex;flex-direction:column;background:var(--bg-primary);font-family:'Outfit','Inter',sans-serif;color:var(--text-primary);overflow-x:hidden;">
      <style>
        /* ── Modern Landing Page Styling ── */
        .landing-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          padding: 14px 32px;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s ease;
        }

        [data-theme="light"] .landing-header {
          background: rgba(255, 255, 255, 0.88);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .brand-logo-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          color: var(--text-primary);
        }

        .college-logo-img {
          height: 42px;
          width: auto;
          object-fit: contain;
          filter: drop-shadow(0 2px 8px rgba(0,0,0,0.15));
        }

        .brand-logo-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6c47ff, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 800;
          font-size: 1.3rem;
          box-shadow: 0 4px 14px rgba(108, 71, 255, 0.35);
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 28px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .nav-link:hover {
          color: var(--accent);
        }

        .hero-section {
          position: relative;
          padding: 70px 24px 60px 24px;
          max-width: 1240px;
          margin: 0 auto;
          text-align: center;
        }

        .hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          border-radius: 30px;
          background: rgba(108, 71, 255, 0.12);
          border: 1px solid rgba(108, 71, 255, 0.25);
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 24px;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }

        .hero-title {
          font-size: clamp(2.4rem, 5vw, 4.2rem);
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.03em;
          margin-bottom: 20px;
          background: linear-gradient(135deg, var(--text-primary) 30%, var(--text-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-title span {
          background: linear-gradient(135deg, #6c47ff, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-desc {
          font-size: clamp(1rem, 2vw, 1.2rem);
          color: var(--text-secondary);
          max-width: 760px;
          margin: 0 auto 36px auto;
          line-height: 1.6;
        }

        .hero-ctas {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 60px;
        }

        .btn-gradient {
          background: linear-gradient(135deg, #6c47ff, #a855f7);
          color: #ffffff !important;
          border: none;
          padding: 14px 32px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 8px 24px rgba(108, 71, 255, 0.35);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-gradient:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(108, 71, 255, 0.5);
        }

        .btn-glass {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border);
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.25s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-glass:hover {
          background: var(--bg-card-hover);
          border-color: var(--accent);
          transform: translateY(-2px);
        }

        /* ── Metric Cards Grid ── */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          max-width: 1100px;
          margin: 0 auto 80px auto;
          padding: 0 16px;
        }

        .metric-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .metric-card:hover {
          transform: translateY(-4px);
          border-color: rgba(108, 71, 255, 0.4);
        }

        .metric-val {
          font-size: 2.2rem;
          font-weight: 800;
          background: linear-gradient(135deg, #6c47ff, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }

        .metric-lbl {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* ── Special Thanks & Pilot Card ── */
        .pilot-ack-card {
          background: linear-gradient(135deg, rgba(108, 71, 255, 0.12), rgba(168, 85, 247, 0.12));
          border: 1.5px solid rgba(108, 71, 255, 0.3);
          border-radius: 24px;
          padding: 40px 32px;
          max-width: 1100px;
          margin: 0 auto 80px auto;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        /* ── Section Title ── */
        .section-header {
          text-align: center;
          max-width: 700px;
          margin: 0 auto 50px auto;
          padding: 0 16px;
        }

        .section-tag {
          color: var(--accent);
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
          display: block;
        }

        .section-title {
          font-size: clamp(1.8rem, 3.5vw, 2.6rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
        }

        .section-desc {
          color: var(--text-secondary);
          font-size: 0.98rem;
          line-height: 1.6;
        }

        /* ── Feature Cards Grid ── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto 100px auto;
          padding: 0 24px;
        }

        .feature-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .feature-card:hover {
          transform: translateY(-6px);
          border-color: rgba(108, 71, 255, 0.4);
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }

        .feature-icon-wrap {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: rgba(108, 71, 255, 0.12);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          margin-bottom: 20px;
        }

        .feature-card-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .feature-card-desc {
          color: var(--text-secondary);
          font-size: 0.88rem;
          line-height: 1.65;
        }

        /* ── Interactive Role Tabs ── */
        .role-tabs-wrap {
          max-width: 1100px;
          margin: 0 auto 100px auto;
          padding: 0 24px;
        }

        .role-tabs {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 32px;
        }

        .role-tab-btn {
          padding: 10px 22px;
          border-radius: 30px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .role-tab-btn.active {
          background: linear-gradient(135deg, #6c47ff, #a855f7);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 4px 16px rgba(108, 71, 255, 0.35);
        }

        .role-tab-content {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 36px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: center;
        }

        @media (max-width: 768px) {
          .role-tab-content {
            grid-template-columns: 1fr;
          }
          .nav-links {
            display: none;
          }
          .landing-header {
            padding: 12px 16px;
          }
          .college-logo-img {
            height: 34px;
          }
        }

        /* ── FAQ Accordion ── */
        .faq-wrap {
          max-width: 800px;
          margin: 0 auto 100px auto;
          padding: 0 24px;
        }

        .faq-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 14px;
          margin-bottom: 12px;
          overflow: hidden;
          transition: border-color 0.2s ease;
        }

        .faq-question {
          padding: 18px 24px;
          font-weight: 700;
          font-size: 0.98rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .faq-answer {
          padding: 0 24px 20px 24px;
          color: var(--text-secondary);
          font-size: 0.88rem;
          line-height: 1.6;
          display: none;
        }

        .faq-item.active .faq-answer {
          display: block;
        }

        .faq-item.active .faq-chevron {
          transform: rotate(180deg);
        }

        /* ── Footer ── */
        .landing-footer {
          background: #090d16;
          color: #94a3b8;
          padding: 60px 32px 30px 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: auto;
        }
      </style>

      <!-- Navigation Header -->
      <header class="landing-header">
        <a href="#/landing" class="brand-logo-wrap">
          <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT University Logo" class="college-logo-img" onError="this.style.display='none';">
          <div style="display:flex;flex-direction:column;">
            <span style="font-weight:800;font-size:1.2rem;letter-spacing:-0.02em;">Lumina</span>
            <span style="font-size:0.68rem;color:var(--text-muted);font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">MIT-ADT Mentorship Intelligence</span>
          </div>
        </a>

        <ul class="nav-links">
          <li><a href="#features" class="nav-link">Features</a></li>
          <li><a href="#roles" class="nav-link">User Roles</a></li>
          <li><a href="#special-thanks" class="nav-link">Special Thanks</a></li>
          <li><a href="#contributors" class="nav-link">Contributors</a></li>
          <li><a href="#faq" class="nav-link">FAQs</a></li>
        </ul>

        <div style="display:flex;align-items:center;gap:12px;">
          ${user ? `
            <a href="#${getRoleDashboardPath(user.role)}" class="btn-gradient" style="padding:8px 20px;font-size:0.88rem;">
              Go to Dashboard →
            </a>
          ` : `
            <a href="#/login" class="btn-gradient" style="padding:8px 20px;font-size:0.88rem;">Log In Portal →</a>
          `}
        </div>
      </header>

      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-pill">
          <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT Logo" style="height:20px;width:auto;" onError="this.style.display='none';">
          <span>🚀 MIT-ADT University — TY CSE Core Pilot &amp; Mentorship Ecosystem</span>
        </div>

        <h1 class="hero-title">
          Empowering Next-Gen Mentorship, <span>Student Growth</span> &amp; Analytics
        </h1>

        <p class="hero-desc">
          Lumina unifies Students, Mentors, HODs, Deans, and Admins into one seamless platform.
          Featuring automated capacity allocation, paperless mentorship booklets, real-time risk intelligence, and WebRTC video meeting rooms.
        </p>

        <div class="hero-ctas">
          ${user ? `
            <a href="#${getRoleDashboardPath(user.role)}" class="btn-gradient">
              Open Dashboard Portal <i class="ph ph-arrow-right"></i>
            </a>
          ` : `
            <a href="#/login" class="btn-gradient" style="padding:14px 40px;font-size:1.05rem;">
              Access Portal Login <i class="ph ph-arrow-right"></i>
            </a>
          `}
        </div>

      </section>

      <!-- Special Thanks & Pilot Recognition Section -->
      <section id="special-thanks" style="padding:40px 24px 20px 24px;">
        <div class="pilot-ack-card">
          <div style="display:flex;justify-content:center;align-items:center;gap:14px;margin-bottom:16px;">
            <img src="/assets/images/mit_adt_logo.png" alt="MIT ADT University Logo" style="height:54px;width:auto;object-fit:contain;" onError="this.style.display='none';">
            <span class="badge badge-accent" style="font-size:0.85rem;padding:6px 16px;border-radius:20px;font-weight:700;letter-spacing:0.04em;">
              TY CSE Core Pilot Recognition
            </span>
          </div>

          <h2 style="font-size:1.8rem;font-weight:800;margin-bottom:14px;color:var(--text-primary);">
            Special Thanks &amp; Mentorship Recognition
          </h2>

          <p style="font-size:1.02rem;color:var(--text-secondary);max-width:880px;margin:0 auto;line-height:1.7;">
            We extend our heartfelt gratitude and special recognition to <strong>Dr. Suwarna Pawar Mam</strong>, Head of Department (HOD) of 
            <strong>CSE Core</strong>, for her visionary leadership, constant guidance, and pioneering initiative in piloting the 
            Lumina Mentorship Platform for the <strong>TY CSE Core</strong> batch at <strong>MIT-ADT University</strong>. 
            Her dedicated support and feedback have been instrumental in fostering academic excellence and student success.
          </p>
        </div>
      </section>

      <!-- Dedicated Project Guidance & Contributors Section -->
      <section id="contributors" style="padding:40px 0 60px 0;">
        <div class="section-header">
          <span class="section-tag">Project Credits</span>
          <h2 class="section-title">Guidance &amp; Contributors</h2>
          <p class="section-desc">
            Recognizing the faculty mentorship and development team behind the Lumina Mentorship Platform.
          </p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:1100px;margin:0 auto;padding:0 24px;">
          
          <!-- Faculty Guide Card -->
          <div class="feature-card" style="border-top:4px solid var(--accent);">
            <div class="feature-icon-wrap" style="background:rgba(108,71,255,0.15);color:var(--accent);">
              <i class="ph ph-graduation-cap"></i>
            </div>
            <span style="font-size:0.75rem;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              Under Guidance Of
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Dr. Nilesh Thorat</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">Assistant Professor</p>
            <p class="feature-card-desc">
              Provided faculty mentorship, project governance, and academic alignment throughout development.
            </p>
          </div>

          <!-- Student Team Lead Card -->
          <div class="feature-card" style="border-top:4px solid #a855f7;">
            <div class="feature-icon-wrap" style="background:rgba(168,85,247,0.15);color:#a855f7;">
              <i class="ph ph-crown"></i>
            </div>
            <span style="font-size:0.75rem;color:#a855f7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              Team Lead (Student)
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Atharva Gandhi</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">Student Team Lead</p>
            <p class="feature-card-desc">
              Lead platform architect and developer overseeing end-to-end system design and deployment.
            </p>
          </div>

          <!-- Student Team Member Card -->
          <div class="feature-card" style="border-top:4px solid #ec4899;">
            <div class="feature-icon-wrap" style="background:rgba(236,72,153,0.15);color:#ec4899;">
              <i class="ph ph-user"></i>
            </div>
            <span style="font-size:0.75rem;color:#ec4899;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              Contributor
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Vaibhav Bariyar</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">Student Team Member</p>
            <p class="feature-card-desc">
              Contributor assisting with feature implementations and testing.
            </p>
          </div>

        </div>
      </section>

      <!-- Core Features Section -->
      <section id="features" style="padding:40px 0;">
        <div class="section-header">
          <span class="section-tag">Platform Excellence</span>
          <h2 class="section-title">Built for Modern Institutional Needs</h2>
          <p class="section-desc">
            Everything your university needs to run a high-performing mentorship framework from day one.
          </p>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-git-merge"></i></div>
            <h3 class="feature-card-title">Smart Capacity Auto-Allocation</h3>
            <p class="feature-card-desc">
              Sequentially allocates unassigned students to available faculty mentors based on enrollment numbers and capacity limits (max 20 students per mentor).
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-book-open"></i></div>
            <h3 class="feature-card-title">Paperless Mentorship Booklet</h3>
            <p class="feature-card-desc">
              Digitized booklet tracking Personal Profile, Health Records, Family Details, Academic Marks, and Co-curricular Activities with mandatory 50% completion enforcement.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-warning-circle"></i></div>
            <h3 class="feature-card-title">Institutional Risk Engine</h3>
            <p class="feature-card-desc">
              Automatic early-warning risk evaluation (High, Medium, Low) based on CGPA, attendance thresholds, and booklet filing status.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-video-camera"></i></div>
            <h3 class="feature-card-title">Real-Time Chat &amp; Video Calls</h3>
            <p class="feature-card-desc">
              Integrated 1-on-1 and group video meeting rooms powered by WebRTC signaling, plus real-time instant messaging between mentors and mentees.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-file-csv"></i></div>
            <h3 class="feature-card-title">Bulk Import &amp; Assignment Sheets</h3>
            <p class="feature-card-desc">
              Import hundreds of students/mentors from CSV/Excel in seconds. Automatically parses columns, cleans titles, and forward-fills mentor names.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-broom"></i></div>
            <h3 class="feature-card-title">Data Cleanup &amp; Standardization</h3>
            <p class="feature-card-desc">
              Built-in duplicate record cleaner and department name migration tool (e.g., standardizing CSE-CORE into BTech CSE - Core with 1 click).
            </p>
          </div>
        </div>
      </section>

      <!-- Role-Based Features Section -->
      <section id="roles" style="padding:40px 0;">
        <div class="section-header">
          <span class="section-tag">Tailored Workspaces</span>
          <h2 class="section-title">Designed for Every Stakeholder</h2>
          <p class="section-desc">
            Custom interfaces and permissions tailored specifically for Students, Mentors, HODs, Deans, and Admins.
          </p>
        </div>

        <div class="role-tabs-wrap">
          <div class="role-tabs">
            <button class="role-tab-btn active" data-role="student">🎓 Student</button>
            <button class="role-tab-btn" data-role="mentor">👨‍🏫 Mentor / Faculty</button>
            <button class="role-tab-btn" data-role="hod">🏛 HOD</button>
            <button class="role-tab-btn" data-role="dean">🎓 Dean</button>
            <button class="role-tab-btn" data-role="admin">⚙️ Admin</button>
          </div>

          <div class="role-tab-content" id="role-tab-display">
            <!-- Populated dynamically by JS -->
          </div>
        </div>
      </section>

      <!-- FAQ Section -->
      <section id="faq" style="padding:40px 0;">
        <div class="section-header">
          <span class="section-tag">Got Questions?</span>
          <h2 class="section-title">Frequently Asked Questions</h2>
        </div>

        <div class="faq-wrap">
          <div class="faq-item active">
            <div class="faq-question">
              <span>What is the 50% Booklet Completion requirement?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              To ensure data completeness, students logging into Lumina must fill at least 50% of their Mentorship Booklet (personal, family, academic details) during initial setup.
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>How does Auto-Allocation work?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              Auto-allocation sorts unassigned students by enrollment number and matches them to available mentors in their department based on remaining capacity (up to 20 students per mentor).
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>Can HODs and Deans inspect student booklets?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              Yes! HODs, Deans, and Admins have full read access to inspect any student's mentorship booklet, risk level, and meeting history.
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>Can we bulk import user lists from Excel/CSV?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              Absoluely. Admins and HODs can upload Excel or CSV sheets containing user profiles or mentor assignments. Duplicate emails and IDs are automatically skipped.
            </div>
          </div>
        </div>
      </section>

      <!-- Footer Banner -->
      <footer class="landing-footer">
        <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;margin-bottom:40px;">
          <div>
            <div class="brand-logo-wrap" style="margin-bottom:14px;">
              <img src="/assets/images/mit_adt_logo.png" alt="MIT ADT Logo" style="height:36px;width:auto;object-fit:contain;" onError="this.style.display='none';">
              <span style="font-weight:800;font-size:1.2rem;color:#fff;">Lumina</span>
            </div>
            <p style="font-size:0.84rem;line-height:1.6;color:#94a3b8;">
              Comprehensive Institutional Mentorship &amp; Analytics Ecosystem. Developed for MIT ADT University &amp; Academic Institutions.
            </p>
          </div>

          <div>
            <h4 style="color:#fff;font-size:0.9rem;font-weight:700;margin-bottom:14px;">Quick Links</h4>
            <ul style="list-style:none;padding:0;margin:0;font-size:0.84rem;display:flex;flex-direction:column;gap:8px;">
              <li><a href="#/login" style="color:#94a3b8;text-decoration:none;">Portal Login</a></li>
              <li><a href="#special-thanks" style="color:#94a3b8;text-decoration:none;">TY CSE Core Pilot Recognition</a></li>
              <li><a href="#contributors" style="color:#94a3b8;text-decoration:none;">Project Guidance &amp; Contributors</a></li>
              <li><a href="#features" style="color:#94a3b8;text-decoration:none;">Platform Features</a></li>
            </ul>
          </div>

          <div>
            <h4 style="color:#fff;font-size:0.9rem;font-weight:700;margin-bottom:14px;">Institution</h4>
            <p style="font-size:0.84rem;line-height:1.6;color:#94a3b8;">
              MIT ADT University, Pune<br>
              Mentorship Framework &amp; NAAC / NIRF Analytics
            </p>
          </div>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;text-align:center;font-size:0.78rem;color:#64748b;">
          &copy; ${new Date().getFullYear()} Lumina Mentorship Platform. All Rights Reserved. MIT-ADT University.
        </div>
      </footer>
    </div>
  `;

  // ── Role Tab Data ─────────────────────────────────────────────────────────
  const roleData = {
    student: {
      title: '🎓 Student Portal Experience',
      desc: 'Fill digital mentorship booklets, track CGPA and attendance, request 1-on-1 meetings with mentors, report issues, and join live video sessions.',
      bullets: [
        '50% Mandatory Booklet Completion tracker',
        'Request & Join WebRTC Video Meetings',
        'Direct Messaging with assigned Mentor',
        'Track Academic Tasks & Issue Status'
      ],
      ctaText: 'Login as Student →',
      ctaHref: '#/login'
    },
    mentor: {
      title: '👨‍🏫 Mentor & Faculty Hub',
      desc: 'Manage your assigned mentee quota (up to 20 students), inspect student booklets, schedule meeting slots, log notes, and flag high-risk students.',
      bullets: [
        'Real-time Mentee Directory & Capacity counter',
        'Inspect Student Digital Booklets',
        'Approve Meeting Requests & Host Video Calls',
        'Raise & Monitor Student Risk Status'
      ],
      ctaText: 'Login as Mentor →',
      ctaHref: '#/login'
    },
    hod: {
      title: '🏛 HOD Departmental Control',
      desc: 'Department-wide mentorship governance, auto-allocate unassigned students, inspect risk matrices, generate departmental reports, and re-assign mentors.',
      bullets: [
        'Auto-Allocate Unassigned Department Students',
        'Department High-Risk Matrix & Escalations',
        'Inspect Student Booklets across Department',
        'Export Excel / PDF Mentorship Reports'
      ],
      ctaText: 'HOD Dashboard →',
      ctaHref: '#/login'
    },
    dean: {
      title: '🎓 Dean Institution Analytics',
      desc: 'Institution-level analytics dashboard, department performance comparison, high-risk student overview, and executive accreditation reporting.',
      bullets: [
        'Cross-Department Mentorship Analytics',
        'Institutional Risk & Escalation Overview',
        'Executive PDF & Excel Report Generator',
        'Monitor Mentorship Coverage'
      ],
      ctaText: 'Dean Portal →',
      ctaHref: '#/login'
    },
    admin: {
      title: '⚙️ Admin System Operations',
      desc: 'Complete control over user registration, bulk imports, duplicate data cleaning, department name standardization, and platform configuration.',
      bullets: [
        'Bulk CSV/Excel User & Assignment Imports',
        '1-Click Duplicate Database Record Cleaner',
        'Department Name Standardization & Class Creator',
        'Full Role & Permission Management'
      ],
      ctaText: 'Admin Operations →',
      ctaHref: '#/login'
    }
  };

  const roleTabDisplay = container.querySelector('#role-tab-display');

  function renderRoleTab(roleKey) {
    const data = roleData[roleKey];
    if (!data || !roleTabDisplay) return;

    roleTabDisplay.innerHTML = `
      <div>
        <h3 style="font-size:1.4rem;font-weight:800;margin-bottom:12px;color:var(--text-primary);">${data.title}</h3>
        <p style="color:var(--text-secondary);font-size:0.92rem;line-height:1.6;margin-bottom:20px;">${data.desc}</p>
        <ul style="list-style:none;padding:0;margin:0 0 24px 0;display:flex;flex-direction:column;gap:10px;">
          ${data.bullets.map(b => `
            <li style="display:flex;align-items:center;gap:10px;font-size:0.88rem;color:var(--text-primary);font-weight:500;">
              <span style="color:var(--success);font-weight:800;">✓</span> ${b}
            </li>
          `).join('')}
        </ul>
        <a href="${user ? '#' + getRoleDashboardPath(user.role) : data.ctaHref}" class="btn-gradient" style="padding:10px 24px;font-size:0.9rem;">
          ${user ? 'Go to Dashboard →' : data.ctaText}
        </a>
      </div>
      <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border);">
          <div style="width:12px;height:12px;border-radius:50%;background:#ef4444;"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:#f59e0b;"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:#22c55e;"></div>
          <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;font-family:monospace;">lumina://${roleKey}/workspace</span>
        </div>
        <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;">
          <p style="margin:0 0 10px 0;"><strong>Active Role:</strong> <span class="badge badge-accent">${roleKey.toUpperCase()}</span></p>
          <p style="margin:0 0 10px 0;"><strong>Status:</strong> System Verified &amp; Synced with Firestore</p>
          <p style="margin:0;"><strong>Feature Access:</strong> Full Workspace Privileges Enabled</p>
        </div>
      </div>
    `;
  }

  // Wire Role Tab buttons
  container.querySelectorAll('.role-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      container.querySelectorAll('.role-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderRoleTab(e.target.dataset.role);
    });
  });

  // Initial tab render
  renderRoleTab('student');

  // FAQ Accordion Toggle
  container.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', (e) => {
      const item = e.currentTarget.parentElement;
      item.classList.toggle('active');
    });
  });
}

function getRoleDashboardPath(role) {
  if (!role) return '/login';
  switch (role.toUpperCase()) {
    case 'STUDENT':  return '/student/dashboard';
    case 'FACULTY':
    case 'MENTOR':   return '/mentor/dashboard';
    case 'HOD':      return '/hod/dashboard';
    case 'DEAN':     return '/dean/dashboard';
    case 'SECTION_HEAD': return '/section/dashboard';
    case 'ADMIN':    return '/admin/dashboard';
    default:         return '/student/dashboard';
  }
}
