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
            padding: 20px 16px;
          }
          .nav-links {
            display: none;
          }
          .landing-header {
            padding: 10px 12px;
          }
          .college-logo-img {
            height: 32px;
          }
          .hero-section {
            padding: 40px 16px 30px 16px;
          }
          .hero-pill {
            font-size: 0.78rem;
            padding: 6px 14px;
          }
          .brand-subtitle {
            display: none !important;
          }
        }

        @media (max-width: 480px) {
          .hero-ctas .btn-gradient,
          .hero-ctas .btn-glass {
            width: 100%;
            justify-content: center;
          }
          .landing-footer {
            padding: 40px 16px 20px 16px;
          }
          .pilot-ack-card {
            padding: 24px 16px;
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
            <span class="brand-subtitle" style="font-size:0.68rem;color:var(--text-muted);font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">MIT-ADT Mentorship Intelligence</span>
          </div>
        </a>

        <ul class="nav-links">
          <li><a href="#features" class="nav-link">Features</a></li>
          <li><a href="#download-app" class="nav-link" style="display:flex;align-items:center;gap:6px;color:#10b981;font-weight:700;"><i class="ph ph-device-mobile" style="font-size:1.1rem;"></i> <span>Download App</span></a></li>
          <li><a href="#roles" class="nav-link">User Roles</a></li>
          <li><a href="#special-thanks" class="nav-link">Special Thanks</a></li>
          <li><a href="#contributors" class="nav-link">Contributors</a></li>
          <li><a href="#faq" class="nav-link">FAQs</a></li>
        </ul>

        <div style="display:flex;align-items:center;gap:12px;">
          <a href="/downloads/MIT_ADT_Mentor_Mentee.apk" download="MIT_ADT_Mentor_Mentee.apk" class="btn-gradient" style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 14px rgba(16,185,129,0.35);padding:8px 16px;font-size:0.85rem;display:inline-flex;align-items:center;gap:6px;" title="Download Android APK">
            <i class="ph ph-android-logo" style="font-size:1.1rem;"></i> <span>APK</span>
          </a>
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
          Lumina unifies Students, Faculty Mentors, Heads of Department, Deans, and Statutory Cells into one intelligent institutional ecosystem.
          Accelerate student development through automated capacity balancing, paperless mentorship booklets, real-time risk intelligence, serverless WebRTC video meeting rooms, and 24/7 Gemini-powered AI mentorship assistance.
        </p>

        <div class="hero-ctas">
          ${user ? `
            <a href="#${getRoleDashboardPath(user.role)}" class="btn-gradient">
              Open Dashboard Portal <i class="ph ph-arrow-right"></i>
            </a>
          ` : `
            <a href="#/login" class="btn-gradient" style="padding:14px 36px;font-size:1.05rem;">
              Access Portal Login <i class="ph ph-arrow-right"></i>
            </a>
          `}
          <a href="/downloads/MIT_ADT_Mentor_Mentee.apk" download="MIT_ADT_Mentor_Mentee.apk" class="btn-gradient" style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 8px 24px rgba(16,185,129,0.35);padding:14px 28px;font-size:1.05rem;">
            <i class="ph ph-android-logo" style="font-size:1.3rem;"></i> Download Android APK
          </a>
        </div>

        <!-- Institutional Metrics Showcase -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-val">1,200+</div>
            <div class="metric-lbl">Students Guided</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">20 : 1</div>
            <div class="metric-lbl">Equitable Mentee Ratio</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">100%</div>
            <div class="metric-lbl">Paperless Booklets</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">4-Tier</div>
            <div class="metric-lbl">Grievance Escalation</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">24/7</div>
            <div class="metric-lbl">AI Academic Copilot</div>
          </div>
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

          <!-- Student Team Member Card (Vaibhav Bariyar) -->
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

          <!-- Student Team Member Card (Satwik Dhole) -->
          <div class="feature-card" style="border-top:4px solid #3b82f6;">
            <div class="feature-icon-wrap" style="background:rgba(59,130,246,0.15);color:#3b82f6;">
              <i class="ph ph-user"></i>
            </div>
            <span style="font-size:0.75rem;color:#3b82f6;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              Contributor
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Satwik Dhole</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">Student Team Member</p>
            <p class="feature-card-desc">
              Contributor assisting with platform development, feature enhancements, and testing.
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
            A battle-tested architecture providing everything your university needs to administer a high-performing, data-driven mentorship framework.
          </p>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-git-merge"></i></div>
            <h3 class="feature-card-title">Smart Capacity Auto-Allocation</h3>
            <p class="feature-card-desc">
              Sequentially allocates unassigned students to available faculty mentors based on enrollment PRN and strict quota caps (max 20 students per mentor), preventing faculty burnout and ensuring fair attention.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-book-open"></i></div>
            <h3 class="feature-card-title">Paperless Mentorship Booklet</h3>
            <p class="feature-card-desc">
              Comprehensive digitized cumulative dossier tracking Personal Profile, Health Records, Family Background, Academic Performance, and Co-curricular Milestones with an enforced 25% minimum onboarding requirement.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap" style="background:rgba(168,85,247,0.15);color:#a855f7;"><i class="ph ph-sparkle"></i></div>
            <h3 class="feature-card-title">Gemini AI Academic Copilot</h3>
            <p class="feature-card-desc">
              Integrated AI mentorship assistant engineered with institutional prompt safety to guide mentees in defining semester goals, structuring grievance narratives, and generating personalized study schedules.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-video-camera"></i></div>
            <h3 class="feature-card-title">Serverless WebRTC Video Meetings</h3>
            <p class="feature-card-desc">
              Broadcast-quality 1-on-1 and cohort video conferencing with real-time Firestore signaling, waiting room guest moderation, host controls, screen sharing, and synchronized audio recording.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-tree-structure"></i></div>
            <h3 class="feature-card-title">4-Tier Grievance Escalation</h3>
            <p class="feature-card-desc">
              Structured multi-tier dispute and academic issue resolution hierarchy routing student tickets through Mentor → Section Head → HOD → Dean, featuring immutable audit trails and real-time status updates.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap" style="background:rgba(236,72,153,0.15);color:#ec4899;"><i class="ph ph-shield-check"></i></div>
            <h3 class="feature-card-title">Statutory Cells &amp; Student Welfare</h3>
            <p class="feature-card-desc">
              Institutional statutory portals for Anti-Ragging, Internal Complaints Committee (ICC), SC/ST Cell, and Student Grievance Redressal with dedicated case workflows and confidential escalation channels.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-warning-circle"></i></div>
            <h3 class="feature-card-title">Institutional Risk &amp; Early Warning</h3>
            <p class="feature-card-desc">
              Continuous automated risk evaluation (High, Medium, Low) analyzing real-time CGPA trends, attendance alerts, and booklet submission milestones to trigger timely faculty and counselor interventions.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="ph ph-file-pdf"></i></div>
            <h3 class="feature-card-title">NAAC &amp; NIRF Accreditation Reporting</h3>
            <p class="feature-card-desc">
              One-click compilation of university-grade PDF and Excel compliance dossiers, capturing mentor-mentee interaction logs, attendance ratios, and academic progression sheets ready for regulatory audits.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-file-csv"></i></div>
            <h3 class="feature-card-title">Bulk Ingestion &amp; Data Hygiene</h3>
            <p class="feature-card-desc">
              Rapid onboarding of hundreds of student and mentor profiles from CSV or Excel sheets with automated column parsing, honorific trimming, and a built-in 1-click duplicate record purger.
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
            Custom interfaces and permissions tailored specifically for Students, Mentors, HODs, Deans, Section Heads, and Administrators.
          </p>
        </div>

        <div class="role-tabs-wrap">
          <div class="role-tabs">
            <button class="role-tab-btn active" data-role="student">🎓 Student</button>
            <button class="role-tab-btn" data-role="mentor">👨‍🏫 Mentor / Faculty</button>
            <button class="role-tab-btn" data-role="hod">🏛 HOD</button>
            <button class="role-tab-btn" data-role="dean">🎓 Dean</button>
            <button class="role-tab-btn" data-role="section">📋 Section Head</button>
            <button class="role-tab-btn" data-role="admin">⚙️ Admin</button>
          </div>

          <div class="role-tab-content" id="role-tab-display">
            <!-- Populated dynamically by JS -->
          </div>
        </div>
      </section>

      <!-- Mobile App Showcase & Download Section -->
      <section id="download-app" style="padding:60px 24px;background:linear-gradient(180deg, rgba(108,71,255,0.05) 0%, rgba(16,185,129,0.08) 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border);">
        <div style="max-width:1200px;margin:0 auto;">
          
          <div class="section-header" style="margin-bottom:36px;">
            <span class="section-tag" style="color:#10b981;background:rgba(16,185,129,0.12);padding:4px 12px;border-radius:20px;display:inline-block;font-weight:700;">
              📱 Official Android Application &bull; v1.0.0
            </span>
            <h2 class="section-title" style="margin-top:12px;">Get the MIT-ADT Mentorship App on Your Device</h2>
            <p class="section-desc">
              Experience seamless mentorship on the go. Built specifically for students and faculty with zero browser lag, instant auto-reconnect, and WebRTC video meeting support.
            </p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:32px;align-items:center;">
            
            <!-- Left Column: Details & Download Actions -->
            <div>
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
                <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT Logo" style="height:48px;width:auto;object-fit:contain;" onError="this.style.display='none';">
                <div>
                  <h3 style="margin:0;font-size:1.35rem;font-weight:800;color:var(--text-primary);">MIT-ADT Mentor Mentee</h3>
                  <p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-secondary);">Official Android Release &bull; Package: <code>com.lumina.mentormentee</code></p>
                </div>
              </div>

              <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:28px;">
                <div style="display:flex;align-items:flex-start;gap:12px;">
                  <div style="width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.15);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
                    🛡️
                  </div>
                  <div>
                    <strong style="color:var(--text-primary);font-size:0.92rem;">Zero Browser Error Screens</strong>
                    <p style="margin:2px 0 0;font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">
                      Custom error suppression eliminates Chrome dinosaur pages and displays a clean, branded reconnect interface.
                    </p>
                  </div>
                </div>

                <div style="display:flex;align-items:flex-start;gap:12px;">
                  <div style="width:32px;height:32px;border-radius:8px;background:rgba(108,71,255,0.15);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
                    ⚡
                  </div>
                  <div>
                    <strong style="color:var(--text-primary);font-size:0.92rem;">Instant Auto-Reconnect</strong>
                    <p style="margin:2px 0 0;font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">
                      Automatically detects when mobile data or Wi-Fi is restored and silently reloads your session.
                    </p>
                  </div>
                </div>

                <div style="display:flex;align-items:flex-start;gap:12px;">
                  <div style="width:32px;height:32px;border-radius:8px;background:rgba(236,72,153,0.15);color:#ec4899;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
                    📹
                  </div>
                  <div>
                    <strong style="color:var(--text-primary);font-size:0.92rem;">1-on-1 Video Meetings &amp; Booklet</strong>
                    <p style="margin:2px 0 0;font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">
                      Hardware camera &amp; microphone support for live WebRTC meetings, plus full mobile mentorship booklet tracking.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Direct Download Action Buttons -->
              <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
                <a href="/downloads/MIT_ADT_Mentor_Mentee.apk" download="MIT_ADT_Mentor_Mentee.apk" class="btn-gradient" style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 8px 24px rgba(16,185,129,0.35);padding:14px 28px;font-size:1.05rem;display:inline-flex;align-items:center;gap:10px;">
                  <i class="ph ph-android-logo" style="font-size:1.4rem;"></i>
                  <span>Download APK (Direct)</span>
                </a>
                <span style="font-size:0.8rem;color:var(--text-muted);">
                  Android 7.0+ &bull; APK Size ~4 MB
                </span>
              </div>
            </div>

            <!-- Right Column: Mobile App Preview & QR Code -->
            <div style="background:var(--bg-secondary);border:1.5px solid var(--border);border-radius:20px;padding:28px;box-shadow:0 20px 40px rgba(0,0,0,0.15);display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;">
              
              <!-- Quick Install Guide -->
              <div>
                <h4 style="margin:0 0 14px 0;font-size:1.05rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                  <span>📋 3-Step Quick Install</span>
                </h4>
                <ol style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:10px;font-size:0.85rem;color:var(--text-secondary);">
                  <li>
                    <strong style="color:var(--text-primary);">Download APK</strong>: Tap the download button or scan the QR code.
                  </li>
                  <li>
                    <strong style="color:var(--text-primary);">Install Package</strong>: Open the downloaded <code>.apk</code> and allow installation.
                  </li>
                  <li>
                    <strong style="color:var(--text-primary);">Login &amp; Connect</strong>: Enter your student or faculty email credentials.
                  </li>
                </ol>

                <div style="margin-top:20px;padding:10px 14px;background:var(--bg-primary);border-radius:10px;border:1px solid var(--border);display:flex;align-items:center;gap:8px;">
                  <span style="color:#10b981;font-size:1.1rem;">✓</span>
                  <span style="font-size:0.78rem;color:var(--text-muted);">Compatible with Samsung, Xiaomi, OnePlus, Vivo, Oppo &amp; all Android phones.</span>
                </div>
              </div>

              <!-- Scan QR Code Box -->
              <div style="text-align:center;background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:0 6px 18px rgba(0,0,0,0.1);">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Scan to Download</div>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https%3A%2F%2Fmentor-mentee-asg.web.app%2Fdownloads%2FMIT_ADT_Mentor_Mentee.apk" alt="Scan QR Code to Download APK" style="width:130px;height:130px;border-radius:8px;display:block;margin:0 auto;background:#fff;padding:6px;">
                <div style="font-size:0.7rem;color:var(--accent);margin-top:8px;font-weight:600;">📱 Point Phone Camera</div>
              </div>

            </div>

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
              <span>What is the 25% Booklet Completion requirement?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              To guarantee data fidelity for institutional records, students must fill at least 25% of their Mentorship Booklet (Personal Info, Academic History, Health, and Goals) during initial onboarding before unlocking full dashboard modules.
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>How does Smart Capacity Auto-Allocation work?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              The allocation engine sorts unassigned students by enrollment PRN and sequentially pairs them with available faculty mentors within their department. It strictly enforces a 20-student maximum capacity per mentor to ensure fair distribution and dedicated attention.
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>How does the Gemini AI Academic Copilot help students and faculty?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              Lumina integrates Gemini AI with tailored super-prompts grounded in academic mentorship. Students can draft semester milestones, structure grievance statements, or request revision plans, while faculty can generate meeting agendas and qualitative guidance.
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>How do WebRTC Video Meetings ensure privacy and host controls?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              Video sessions run entirely peer-to-peer using native WebRTC with Firestore signaling. Mentors enter as Hosts with full controls—including an active Waiting Room, Admit/Deny permissions, participant kicking, and local audio/screen recording.
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>How does the 4-Tier Issue Escalation process operate?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              When a student raises an academic or administrative issue, it is first reviewed by their Faculty Mentor. If unresolved, it escalates to the Section Head (e.g., Exam Section), then to the HOD, and finally to the Dean or Statutory Cells, maintaining an immutable audit log throughout.
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>Can HODs and Deans export data for NAAC and NIRF accreditations?</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              Yes. HODs, Deans, and Admins can export comprehensive Excel spreadsheets and university-formatted PDF dossiers containing booklet logs, meeting records, attendance correlations, and grievance resolution metrics.
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
              Comprehensive Institutional Mentorship, Academic Intelligence &amp; Analytics Ecosystem. Pioneered at MIT-ADT University for modern higher education.
            </p>
          </div>

          <div>
            <h4 style="color:#fff;font-size:0.9rem;font-weight:700;margin-bottom:14px;">Quick Links</h4>
            <ul style="list-style:none;padding:0;margin:0;font-size:0.84rem;display:flex;flex-direction:column;gap:8px;">
              <li><a href="#/login" style="color:#94a3b8;text-decoration:none;">Portal Login</a></li>
              <li><a href="#special-thanks" style="color:#94a3b8;text-decoration:none;">TY CSE Core Pilot Recognition</a></li>
              <li><a href="#contributors" style="color:#94a3b8;text-decoration:none;">Project Guidance &amp; Contributors</a></li>
              <li><a href="#features" style="color:#94a3b8;text-decoration:none;">Platform Features</a></li>
              <li><a href="#roles" style="color:#94a3b8;text-decoration:none;">Role Workspaces</a></li>
              <li><a href="#download-app" style="color:#94a3b8;text-decoration:none;">Android Mobile App</a></li>
            </ul>
          </div>

          <div>
            <h4 style="color:#fff;font-size:0.9rem;font-weight:700;margin-bottom:14px;">Institution</h4>
            <p style="font-size:0.84rem;line-height:1.6;color:#94a3b8;">
              MIT ADT University, Pune<br>
              School of Computing — TY CSE Core Pilot<br>
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
      desc: 'Fill digital mentorship booklets, track CGPA and attendance, request 1-on-1 meetings with mentors, report issues, and access the Gemini AI academic copilot.',
      bullets: [
        '25% Mandatory Booklet Completion tracker & profile manager',
        'Request & Join high-definition WebRTC Video Meetings',
        'Direct real-time messaging with your assigned faculty mentor',
        'Submit academic grievances with 4-tier escalation visibility',
        'Gemini AI Copilot for study timetables and milestone planning'
      ],
      ctaText: 'Login as Student →',
      ctaHref: '#/login'
    },
    mentor: {
      title: '👨‍🏫 Mentor & Faculty Hub',
      desc: 'Manage your assigned mentee quota (up to 20 students), review digital booklets, host video calls, log meeting notes, and flag high-risk students.',
      bullets: [
        'Real-time Mentee Directory & capacity monitoring (max 20 students)',
        'Review, sign off, and provide qualitative feedback on digital booklets',
        'Host WebRTC video calls with waiting room moderation & recording',
        'Early risk detection engine to flag academically vulnerable students',
        'Escalate unresolved issues directly to Section Heads or HODs'
      ],
      ctaText: 'Login as Mentor →',
      ctaHref: '#/login'
    },
    hod: {
      title: '🏛 HOD Departmental Governance',
      desc: 'Department-wide mentorship governance, auto-allocate unassigned students, inspect risk matrices, generate departmental reports, and re-assign mentors.',
      bullets: [
        'Auto-allocate unassigned students based on enrollment PRN order',
        'Department High-Risk Matrix & multi-tier issue escalations',
        'Inspect Student Booklets across all department batches',
        'Export university-compliant Excel and PDF Mentorship Reports'
      ],
      ctaText: 'HOD Dashboard →',
      ctaHref: '#/login'
    },
    dean: {
      title: '🎓 Dean Institutional Analytics',
      desc: 'Institution-level analytics dashboard, department performance comparison, high-risk student overview, and executive accreditation reporting.',
      bullets: [
        'Cross-Department Mentorship Analytics and faculty load index',
        'Institutional Risk & Escalation Overview across all branches',
        'Executive PDF & Excel Report Generator for NAAC/NIRF audits',
        'Direct apex issue resolution and statutory cell coordination'
      ],
      ctaText: 'Dean Portal →',
      ctaHref: '#/login'
    },
    section: {
      title: '📋 Section Head Operations',
      desc: 'Specialized domain management (Exam Cell, Accounts, Hostel, Transport) to swiftly investigate and resolve forwarded student grievances.',
      bullets: [
        'Dedicated queue for section-specific escalated student issues',
        'Direct resolution workflows with audit logging and student notifications',
        'Cross-functional coordination with Faculty Mentors and HODs',
        'Operational bottleneck identification and performance analytics'
      ],
      ctaText: 'Section Portal →',
      ctaHref: '#/login'
    },
    admin: {
      title: '⚙️ Admin System Operations',
      desc: 'Master control center for user registration, bulk imports, duplicate data cleaning, department name standardization, and platform configuration.',
      bullets: [
        'Bulk CSV/Excel User & Assignment Imports with auto column mapping',
        '1-Click Duplicate Database Record Cleaner and data normalizer',
        'Statutory Cells account manager & institutional escalation wiring',
        'Full Role & Permission Management with audit log tracking'
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
      const targetBtn = e.currentTarget || e.target.closest('.role-tab-btn');
      container.querySelectorAll('.role-tab-btn').forEach(b => b.classList.remove('active'));
      if (targetBtn) {
        targetBtn.classList.add('active');
        renderRoleTab(targetBtn.dataset.role);
      }
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
