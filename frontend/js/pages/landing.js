import { getUserProfile } from '../auth.js';
import { navigateTo } from '../router.js';
import { t, renderLanguageSelector } from '../i18n.js';

export async function render(container) {
  const user = getUserProfile();

  container.innerHTML = `
    <div class="landing-page" style="min-height:100vh;display:flex;flex-direction:column;background:var(--bg-primary);font-family:var(--font);color:var(--text-primary);overflow-x:hidden;">
      <style>
        /* ── Modern Landing Page Styling ── */
        .landing-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          padding: 14px 32px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s ease;
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
          background: #f8fafc;
          color: #64748b;
          padding: 60px 32px 30px 32px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          margin-top: auto;
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .landing-footer h4,
        .landing-footer .brand-logo-wrap span {
          color: #0f172a !important;
        }

        .landing-footer p,
        .landing-footer a {
          color: #64748b !important;
        }

        .landing-footer a:hover {
          color: var(--accent) !important;
        }

        .ecosystem-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px 28px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .ecosystem-card:hover {
          transform: translateY(-6px);
          border-color: rgba(108, 71, 255, 0.4);
          box-shadow: 0 20px 40px rgba(0,0,0,0.12);
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
          <li><a href="#features" class="nav-link">${t('landing.nav_features', 'Features')}</a></li>
          <li><a href="#roles" class="nav-link">${t('landing.nav_portals', 'User Roles')}</a></li>
          <li><a href="#ecosystem" class="nav-link">${t('landing.cloud_tag', 'Cloud Platform')}</a></li>
          <li><a href="#special-thanks" class="nav-link">${t('landing.pilot_badge', 'Special Thanks')}</a></li>
          <li><a href="#contributors" class="nav-link">${t('landing.credits_title', 'Contributors')}</a></li>
          <li><a href="#faq" class="nav-link">${t('landing.faq_title', 'FAQs')}</a></li>
        </ul>

        <div style="display:flex;align-items:center;gap:12px;">
          ${renderLanguageSelector('landing')}
          ${user ? `
            <a href="#${getRoleDashboardPath(user.role)}" class="btn-gradient" style="padding:8px 20px;font-size:0.88rem;">
              ${t('landing.nav_dashboard', 'Go to Dashboard')} →
            </a>
          ` : `
            <a href="#/login" class="btn-gradient" style="padding:8px 20px;font-size:0.88rem;">${t('landing.nav_signin', 'Log In Portal')} →</a>
          `}
        </div>
      </header>

      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-pill">
          <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT Logo" style="height:20px;width:auto;" onError="this.style.display='none';">
          <span>🚀 ${t('landing.badge', 'Institutional Mentorship & Student Intelligence Platform')}</span>
        </div>

        <h1 class="hero-title">
          ${t('landing.hero_title_1', 'Next-Gen Mentorship,')} <span>${t('landing.hero_title_2', 'Zero Paperwork, Infinite Impact.')}</span>
        </h1>

        <p class="hero-desc">
          ${t('landing.hero_desc', 'The all-in-one platform unifying student mentorship booklets, AI-powered academic copilots, high-definition WebRTC video meetings, and institutional grievance escalation for premier universities.')}
        </p>

        <div class="hero-ctas">
          ${user ? `
            <a href="#${getRoleDashboardPath(user.role)}" class="btn-gradient" style="padding:14px 32px;font-size:1.02rem;">
              ${t('landing.nav_dashboard', 'Go to Dashboard')} <i class="ph ph-arrow-right"></i>
            </a>
          ` : `
            <a href="#/login" class="btn-gradient" style="padding:14px 36px;font-size:1.05rem;">
              ${t('landing.cta_get_started', 'Get Started Free')} <i class="ph ph-arrow-right"></i>
            </a>
          `}
          <a href="#features" class="btn-glass" style="padding:14px 28px;font-size:1.02rem;">
            <i class="ph ph-sparkle" style="font-size:1.2rem;color:var(--accent);"></i> ${t('landing.cta_explore', 'Explore Capabilities')}
          </a>
        </div>

        <!-- Institutional Metrics Showcase -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-val">1,200+</div>
            <div class="metric-lbl">${t('landing.stat_students', 'Active Students Mentored')}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">20 : 1</div>
            <div class="metric-lbl">${t('landing.stat_ratio', '20:1 Max Mentee Ratio')}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">100%</div>
            <div class="metric-lbl">${t('landing.stat_paperless', 'Paperless Compliance')}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">4-Tier</div>
            <div class="metric-lbl">${t('landing.feat_escalation_title', 'Grievance Escalation')}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">24/7</div>
            <div class="metric-lbl">${t('landing.feat_copilot_title', 'AI Academic Copilot')}</div>
          </div>
        </div>

      </section>

      <!-- Special Thanks & Pilot Recognition Section -->
      <section id="special-thanks" style="padding:40px 24px 20px 24px;">
        <div class="pilot-ack-card">
          <div style="display:flex;justify-content:center;align-items:center;gap:14px;margin-bottom:16px;">
            <img src="/assets/images/mit_adt_logo.png" alt="MIT ADT University Logo" style="height:54px;width:auto;object-fit:contain;" onError="this.style.display='none';">
            <span class="badge badge-accent" style="font-size:0.85rem;padding:6px 16px;border-radius:20px;font-weight:700;letter-spacing:0.04em;">
              ${t('landing.pilot_badge', 'TY CSE Core Pilot Recognition')}
            </span>
          </div>

          <h2 style="font-size:1.8rem;font-weight:800;margin-bottom:14px;color:var(--text-primary);">
            ${t('landing.pilot_title', 'Special Thanks & Mentorship Recognition')}
          </h2>

          <p style="font-size:1.02rem;color:var(--text-secondary);max-width:880px;margin:0 auto;line-height:1.7;">
            ${t('landing.pilot_desc', 'We extend our heartfelt gratitude and special recognition to Dr. Suwarna Pawar Mam, Head of Department (HOD) of CSE Core, for her visionary leadership, constant guidance, and pioneering initiative in piloting the Lumina Mentorship Platform for the TY CSE Core batch at MIT-ADT University. Her dedicated support and feedback have been instrumental in fostering academic excellence and student success.')}
          </p>
        </div>
      </section>

      <!-- Dedicated Project Guidance & Contributors Section -->
      <section id="contributors" style="padding:40px 0 60px 0;">
        <div class="section-header">
          <span class="section-tag">${t('landing.credits_tag', 'Project Credits')}</span>
          <h2 class="section-title">${t('landing.credits_title', 'Guidance & Contributors')}</h2>
          <p class="section-desc">
            ${t('landing.credits_desc', 'Recognizing the faculty mentorship and development team behind the Lumina Mentorship Platform.')}
          </p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:1100px;margin:0 auto;padding:0 24px;">
          
          <!-- Faculty Guide Card -->
          <div class="feature-card" style="border-top:4px solid var(--accent);">
            <div class="feature-icon-wrap" style="background:rgba(108,71,255,0.15);color:var(--accent);">
              <i class="ph ph-graduation-cap"></i>
            </div>
            <span style="font-size:0.75rem;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              ${t('landing.guide_under', 'Under Guidance Of')}
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Dr. Nilesh Thorat</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">${t('landing.guide_role', 'Assistant Professor')}</p>
            <p class="feature-card-desc">
              ${t('landing.guide_desc', 'Provided faculty mentorship, project governance, and academic alignment throughout development.')}
            </p>
          </div>

          <!-- Student Team Lead Card -->
          <div class="feature-card" style="border-top:4px solid #a855f7;">
            <div class="feature-icon-wrap" style="background:rgba(168,85,247,0.15);color:#a855f7;">
              <i class="ph ph-crown"></i>
            </div>
            <span style="font-size:0.75rem;color:#a855f7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              ${t('landing.lead_tag', 'Team Lead (Student)')}
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Atharva Gandhi</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">${t('landing.lead_role', 'Student Team Lead')}</p>
            <p class="feature-card-desc">
              ${t('landing.lead_desc', 'Lead platform architect and developer overseeing end-to-end system design and deployment.')}
            </p>
          </div>

          <!-- Student Team Member Card (Vaibhav Bariyar) -->
          <div class="feature-card" style="border-top:4px solid #ec4899;">
            <div class="feature-icon-wrap" style="background:rgba(236,72,153,0.15);color:#ec4899;">
              <i class="ph ph-user"></i>
            </div>
            <span style="font-size:0.75rem;color:#ec4899;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              ${t('landing.member_tag', 'Contributor')}
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Vaibhav Bariyar</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">${t('landing.member_role', 'Student Team Member')}</p>
            <p class="feature-card-desc">
              ${t('landing.member_1_desc', 'Contributor assisting with feature implementations and testing.')}
            </p>
          </div>

          <!-- Student Team Member Card (Satwik Dhole) -->
          <div class="feature-card" style="border-top:4px solid #3b82f6;">
            <div class="feature-icon-wrap" style="background:rgba(59,130,246,0.15);color:#3b82f6;">
              <i class="ph ph-user"></i>
            </div>
            <span style="font-size:0.75rem;color:#3b82f6;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">
              ${t('landing.member_tag', 'Contributor')}
            </span>
            <h3 class="feature-card-title" style="font-size:1.3rem;margin-bottom:4px;">Satwik Dhole</h3>
            <p style="font-size:0.88rem;color:var(--text-muted);font-weight:600;margin-bottom:12px;">${t('landing.member_role', 'Student Team Member')}</p>
            <p class="feature-card-desc">
              ${t('landing.member_2_desc', 'Contributor assisting with platform development, feature enhancements, and testing.')}
            </p>
          </div>

        </div>
      </section>

      <!-- Core Features Section -->
      <section id="features" style="padding:40px 0;">
        <div class="section-header">
          <span class="section-tag">${t('landing.features_tag', 'Platform Excellence')}</span>
          <h2 class="section-title">${t('landing.features_title', 'Built for Modern Institutional Needs')}</h2>
          <p class="section-desc">
            ${t('landing.features_desc', 'A battle-tested architecture providing everything your university needs to administer a high-performing, data-driven mentorship framework.')}
          </p>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-git-merge"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_alloc_title', 'Smart Capacity Auto-Allocation')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_alloc_desc', 'Sequentially allocates unassigned students to available faculty mentors based on enrollment PRN and strict quota caps (max 20 students per mentor), preventing faculty burnout and ensuring fair attention.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-book-open"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_booklet_title', 'Paperless Mentorship Booklet')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_booklet_desc', 'Comprehensive digitized cumulative dossier tracking Personal Profile, Health Records, Family Background, Academic Performance, and Co-curricular Milestones with an enforced 25% minimum onboarding requirement.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap" style="background:rgba(168,85,247,0.15);color:#a855f7;"><i class="ph ph-sparkle"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_copilot_title', 'Gemini AI Academic Copilot')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_copilot_desc', 'Integrated AI mentorship assistant engineered with institutional prompt safety to guide mentees in defining semester goals, structuring grievance narratives, and generating personalized study schedules.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-video-camera"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_webrtc_title', 'Serverless WebRTC Video Meetings')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_webrtc_desc', 'Broadcast-quality 1-on-1 and cohort video conferencing with real-time Firestore signaling, waiting room guest moderation, host controls, screen sharing, and synchronized audio recording.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-tree-structure"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_escalation_title', '4-Tier Grievance Escalation')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_escalation_desc', 'Structured multi-tier dispute and academic issue resolution hierarchy routing student tickets through Mentor → Section Head → HOD → Dean, featuring immutable audit trails and real-time status updates.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap" style="background:rgba(236,72,153,0.15);color:#ec4899;"><i class="ph ph-shield-check"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_statutory_title', 'Statutory Cells & Student Welfare')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_statutory_desc', 'Institutional statutory portals for Anti-Ragging, Internal Complaints Committee (ICC), SC/ST Cell, and Student Grievance Redressal with dedicated case workflows and confidential escalation channels.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-warning-circle"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_risk_title', 'Institutional Risk & Early Warning')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_risk_desc', 'Continuous automated risk evaluation (High, Medium, Low) analyzing real-time CGPA trends, attendance alerts, and booklet submission milestones to trigger timely faculty and counselor interventions.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="ph ph-file-pdf"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_naac_title', 'NAAC & NIRF Accreditation Reporting')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_naac_desc', 'One-click compilation of university-grade PDF and Excel compliance dossiers, capturing mentor-mentee interaction logs, attendance ratios, and academic progression sheets ready for regulatory audits.')}
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon-wrap"><i class="ph ph-file-csv"></i></div>
            <h3 class="feature-card-title">${t('landing.feat_bulk_title', 'Bulk Ingestion & Data Hygiene')}</h3>
            <p class="feature-card-desc">
              ${t('landing.feat_bulk_desc', 'Rapid onboarding of hundreds of student and mentor profiles from CSV or Excel sheets with automated column parsing, honorific trimming, and a built-in 1-click duplicate record purger.')}
            </p>
          </div>
        </div>
      </section>

      <!-- Role-Based Features Section -->
      <section id="roles" style="padding:40px 0;">
        <div class="section-header">
          <span class="section-tag">${t('landing.roles_tag', 'Tailored Workspaces')}</span>
          <h2 class="section-title">${t('landing.roles_title', 'Designed for Every Stakeholder')}</h2>
          <p class="section-desc">
            ${t('landing.roles_desc', 'Custom interfaces and permissions tailored specifically for Students, Mentors, HODs, Deans, Section Heads, and Administrators.')}
          </p>
        </div>

        <div class="role-tabs-wrap">
          <div class="role-tabs">
            <button class="role-tab-btn active" data-role="student">🎓 ${t('role.student', 'Student')}</button>
            <button class="role-tab-btn" data-role="mentor">👨‍🏫 ${t('role.mentor', 'Mentor / Faculty')}</button>
            <button class="role-tab-btn" data-role="hod">🏛 ${t('role.hod', 'HOD')}</button>
            <button class="role-tab-btn" data-role="dean">🎓 ${t('role.dean', 'Dean')}</button>
            <button class="role-tab-btn" data-role="section">📋 ${t('role.section_head', 'Section Head')}</button>
            <button class="role-tab-btn" data-role="admin">⚙️ ${t('role.admin', 'Admin')}</button>
          </div>

          <div class="role-tab-content" id="role-tab-display">
            <!-- Populated dynamically by JS -->
          </div>
        </div>
      </section>

      <!-- Cloud & Mobile Architecture Showcase Section -->
      <section id="ecosystem" style="padding:60px 24px;background:linear-gradient(180deg, rgba(108,71,255,0.04) 0%, rgba(59,130,246,0.06) 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border);">
        <div style="max-width:1200px;margin:0 auto;">
          
          <div class="section-header" style="margin-bottom:44px;">
            <span class="section-tag" style="color:var(--accent);background:rgba(108,71,255,0.12);padding:4px 14px;border-radius:20px;display:inline-block;font-weight:700;">
              ${t('landing.cloud_tag', '⚡ Cloud & Device Agnostic Architecture')}
            </span>
            <h2 class="section-title" style="margin-top:12px;">${t('landing.cloud_title', 'Modern, Real-Time Web Experience Across All Devices')}</h2>
            <p class="section-desc">
              ${t('landing.cloud_desc', 'Built as an institutional Progressive Web App (PWA) with zero client installations required. Access high-definition video consultations, real-time mentorship booklets, and governance analytics anywhere on mobile, tablet, or desktop.')}
            </p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:28px;align-items:stretch;">
            
            <!-- Feature Box 1: Device Agnostic & PWA -->
            <div class="ecosystem-card">
              <div>
                <div style="width:48px;height:48px;border-radius:14px;background:rgba(108,71,255,0.15);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin-bottom:18px;">
                  <i class="ph ph-browsers"></i>
                </div>
                <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;">${t('landing.pwa_title', 'Zero-Install Web Access')}</h3>
                <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin-bottom:18px;">
                  ${t('landing.pwa_desc', 'Instant, ultra-low latency browser access on Android, iOS, Windows, macOS, and Linux without downloading external installation packages or granting sideload permissions.')}
                </p>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border);">
                <span class="badge badge-accent" style="font-size:0.75rem;">${t('landing.badge_mobile', '📱 Mobile Responsive')}</span>
                <span class="badge badge-accent" style="font-size:0.75rem;">${t('landing.badge_desktop', '💻 Desktop Optimized')}</span>
                <span class="badge badge-accent" style="font-size:0.75rem;">${t('landing.badge_instant', '🚀 Instant Load')}</span>
              </div>
            </div>

            <!-- Feature Box 2: Firestore Real-Time Sync -->
            <div class="ecosystem-card">
              <div>
                <div style="width:48px;height:48px;border-radius:14px;background:rgba(16,185,129,0.15);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin-bottom:18px;">
                  <i class="ph ph-arrows-clockwise"></i>
                </div>
                <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;">${t('landing.sync_title', 'Cloud Firestore Synchronization')}</h3>
                <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin-bottom:18px;">
                  ${t('landing.sync_desc', 'Changes to student booklets, attendance indicators, meeting bookings, and grievance escalations update in real-time across faculty and student screens simultaneously.')}
                </p>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border);">
                <span class="badge badge-success" style="font-size:0.75rem;">${t('landing.badge_realtime', '⚡ Real-Time Snapshots')}</span>
                <span class="badge badge-success" style="font-size:0.75rem;">${t('landing.badge_autosave', '🔄 Auto-Save Booklets')}</span>
                <span class="badge badge-success" style="font-size:0.75rem;">${t('landing.badge_offline', '🛡️ Offline Resilient')}</span>
              </div>
            </div>

            <!-- Feature Box 3: Enterprise Security & WebRTC -->
            <div class="ecosystem-card">
              <div>
                <div style="width:48px;height:48px;border-radius:14px;background:rgba(236,72,153,0.15);color:#ec4899;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin-bottom:18px;">
                  <i class="ph ph-video-camera"></i>
                </div>
                <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-bottom:10px;">${t('landing.p2p_title', 'Peer-to-Peer WebRTC Video')}</h3>
                <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin-bottom:18px;">
                  ${t('landing.p2p_desc', 'Encrypted 1-on-1 virtual mentoring sessions with waiting room guest controls, participant admission, real-time screen sharing, and on-device recording capabilities.')}
                </p>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border);">
                <span class="badge" style="font-size:0.75rem;background:rgba(236,72,153,0.12);color:#ec4899;border:1px solid rgba(236,72,153,0.3);">${t('landing.badge_e2e', '🔒 End-to-End Encrypted')}</span>
                <span class="badge" style="font-size:0.75rem;background:rgba(236,72,153,0.12);color:#ec4899;border:1px solid rgba(236,72,153,0.3);">${t('landing.badge_screenshare', '🎥 Screen Share')}</span>
                <span class="badge" style="font-size:0.75rem;background:rgba(236,72,153,0.12);color:#ec4899;border:1px solid rgba(236,72,153,0.3);">${t('landing.badge_av', '🎙️ Audio/Video')}</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      <!-- FAQ Section -->
      <section id="faq" style="padding:40px 0;">
        <div class="section-header">
          <span class="section-tag">${t('landing.faq_tag', 'Got Questions?')}</span>
          <h2 class="section-title">${t('landing.faq_title', 'Frequently Asked Questions')}</h2>
        </div>

        <div class="faq-wrap">
          <div class="faq-item active">
            <div class="faq-question">
              <span>${t('landing.faq_q1', 'What is the 25% Booklet Completion requirement?')}</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              ${t('landing.faq_a1', 'To guarantee data fidelity for institutional records, students must fill at least 25% of their Mentorship Booklet (Personal Info, Academic History, Health, and Goals) during initial onboarding before unlocking full dashboard modules.')}
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>${t('landing.faq_q2', 'How does Smart Capacity Auto-Allocation work?')}</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              ${t('landing.faq_a2', 'The allocation engine sorts unassigned students by enrollment PRN and sequentially pairs them with available faculty mentors within their department. It strictly enforces a 20-student maximum capacity per mentor to ensure fair distribution and dedicated attention.')}
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>${t('landing.faq_q3', 'How does the Gemini AI Academic Copilot help students and faculty?')}</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              ${t('landing.faq_a3', 'Lumina integrates Gemini AI with tailored super-prompts grounded in academic mentorship. Students can draft semester milestones, structure grievance narratives, or request revision plans, while faculty can generate meeting agendas and qualitative guidance.')}
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>${t('landing.faq_q4', 'How do WebRTC Video Meetings ensure privacy and host controls?')}</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              ${t('landing.faq_a4', 'Video sessions run entirely peer-to-peer using native WebRTC with Firestore signaling. Mentors enter as Hosts with full controls—including an active Waiting Room, Admit/Deny permissions, participant kicking, and local audio/screen recording.')}
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>${t('landing.faq_q5', 'How does the 4-Tier Issue Escalation process operate?')}</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              ${t('landing.faq_a5', 'When a student raises an academic or administrative issue, it is first reviewed by their Faculty Mentor. If unresolved, it escalates to the Section Head (e.g., Exam Section), then to the HOD, and finally to the Dean or Statutory Cells, maintaining an immutable audit log throughout.')}
            </div>
          </div>

          <div class="faq-item">
            <div class="faq-question">
              <span>${t('landing.faq_q6', 'Can HODs and Deans export data for NAAC and NIRF accreditations?')}</span>
              <span class="faq-chevron">▼</span>
            </div>
            <div class="faq-answer">
              ${t('landing.faq_a6', 'Yes. HODs, Deans, and Admins can export comprehensive Excel spreadsheets and university-formatted PDF dossiers containing booklet logs, meeting records, attendance correlations, and grievance resolution metrics.')}
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
              <span style="font-weight:800;font-size:1.2rem;color:#0f172a;">Lumina</span>
            </div>
            <p style="font-size:0.84rem;line-height:1.6;color:#64748b;">
              ${t('landing.footer_desc', 'Comprehensive Institutional Mentorship, Academic Intelligence & Analytics Ecosystem. Pioneered at MIT-ADT University for modern higher education.')}
            </p>
          </div>

          <div>
            <h4 style="color:#0f172a;font-size:0.9rem;font-weight:700;margin-bottom:14px;">${t('landing.footer_quick_links', 'Quick Links')}</h4>
            <ul style="list-style:none;padding:0;margin:0;font-size:0.84rem;display:flex;flex-direction:column;gap:8px;">
              <li><a href="#/login" style="color:#64748b;text-decoration:none;">${t('landing.nav_signin', 'Portal Login')}</a></li>
              <li><a href="#special-thanks" style="color:#64748b;text-decoration:none;">${t('landing.pilot_badge', 'TY CSE Core Pilot Recognition')}</a></li>
              <li><a href="#contributors" style="color:#64748b;text-decoration:none;">${t('landing.credits_title', 'Project Guidance & Contributors')}</a></li>
              <li><a href="#features" style="color:#64748b;text-decoration:none;">${t('landing.features_tag', 'Platform Features')}</a></li>
              <li><a href="#roles" style="color:#64748b;text-decoration:none;">${t('landing.roles_tag', 'Role Workspaces')}</a></li>
              <li><a href="#ecosystem" style="color:#64748b;text-decoration:none;">${t('landing.cloud_tag', 'Cloud Architecture & Security')}</a></li>
            </ul>
          </div>

          <div>
            <h4 style="color:#0f172a;font-size:0.9rem;font-weight:700;margin-bottom:14px;">${t('landing.footer_institution', 'Institution')}</h4>
            <p style="font-size:0.84rem;line-height:1.6;color:#64748b;">
              MIT ADT University, Pune<br>
              School of Computing — TY CSE Core Pilot<br>
              Mentorship Framework &amp; NAAC / NIRF Analytics
            </p>
          </div>
        </div>

        <div style="border-top:1px solid rgba(0,0,0,0.08);padding-top:24px;text-align:center;font-size:0.78rem;color:#64748b;">
          &copy; ${new Date().getFullYear()} ${t('landing.footer_rights', 'Lumina Mentorship Platform. All Rights Reserved. MIT-ADT University.')}
        </div>
      </footer>
    </div>
  `;

  // ── Role Tab Data Function (dynamically localized) ──────────────────────────
  function getRoleData(roleKey) {
    switch (roleKey) {
      case 'student':
        return {
          title: t('landing.role_student_title', '🎓 Student Portal Experience'),
          desc: t('landing.role_student_desc', 'Fill digital mentorship booklets, track CGPA and attendance, request 1-on-1 meetings with mentors, report issues, and access the Gemini AI academic copilot.'),
          bullets: [
            t('landing.role_student_b1', '25% Mandatory Booklet Completion tracker & profile manager'),
            t('landing.role_student_b2', 'Request & Join high-definition WebRTC Video Meetings'),
            t('landing.role_student_b3', 'Direct real-time messaging with your assigned faculty mentor'),
            t('landing.role_student_b4', 'Submit academic grievances with 4-tier escalation visibility'),
            t('landing.role_student_b5', 'Gemini AI Copilot for study timetables and milestone planning')
          ],
          ctaText: t('landing.role_student_cta', 'Login as Student →'),
          ctaHref: '#/login'
        };
      case 'mentor':
        return {
          title: t('landing.role_mentor_title', '👨‍🏫 Mentor & Faculty Hub'),
          desc: t('landing.role_mentor_desc', 'Manage your assigned mentee quota (up to 20 students), review digital booklets, host video calls, log meeting notes, and flag high-risk students.'),
          bullets: [
            t('landing.role_mentor_b1', 'Real-time Mentee Directory & capacity monitoring (max 20 students)'),
            t('landing.role_mentor_b2', 'Review, sign off, and provide qualitative feedback on digital booklets'),
            t('landing.role_mentor_b3', 'Host WebRTC video calls with waiting room moderation & recording'),
            t('landing.role_mentor_b4', 'Early risk detection engine to flag academically vulnerable students'),
            t('landing.role_mentor_b5', 'Escalate unresolved issues directly to Section Heads or HODs')
          ],
          ctaText: t('landing.role_mentor_cta', 'Login as Mentor →'),
          ctaHref: '#/login'
        };
      case 'hod':
        return {
          title: t('landing.role_hod_title', '🏛 HOD Departmental Governance'),
          desc: t('landing.role_hod_desc', 'Department-wide mentorship governance, auto-allocate unassigned students, inspect risk matrices, generate departmental reports, and re-assign mentors.'),
          bullets: [
            t('landing.role_hod_b1', 'Auto-allocate unassigned students based on enrollment PRN order'),
            t('landing.role_hod_b2', 'Department High-Risk Matrix & multi-tier issue escalations'),
            t('landing.role_hod_b3', 'Inspect Student Booklets across all department batches'),
            t('landing.role_hod_b4', 'Export university-compliant Excel and PDF Mentorship Reports')
          ],
          ctaText: t('landing.role_hod_cta', 'HOD Dashboard →'),
          ctaHref: '#/login'
        };
      case 'dean':
        return {
          title: t('landing.role_dean_title', '🎓 Dean Institutional Analytics'),
          desc: t('landing.role_dean_desc', 'Institution-level analytics dashboard, department performance comparison, high-risk student overview, and executive accreditation reporting.'),
          bullets: [
            t('landing.role_dean_b1', 'Cross-Department Mentorship Analytics and faculty load index'),
            t('landing.role_dean_b2', 'Institutional Risk & Escalation Overview across all branches'),
            t('landing.role_dean_b3', 'Executive PDF & Excel Report Generator for NAAC/NIRF audits'),
            t('landing.role_dean_b4', 'Direct apex issue resolution and statutory cell coordination')
          ],
          ctaText: t('landing.role_dean_cta', 'Dean Portal →'),
          ctaHref: '#/login'
        };
      case 'section':
        return {
          title: t('landing.role_section_title', '📋 Section Head Operations'),
          desc: t('landing.role_section_desc', 'Specialized domain management (Exam Cell, Accounts, Hostel, Transport) to swiftly investigate and resolve forwarded student grievances.'),
          bullets: [
            t('landing.role_section_b1', 'Dedicated queue for section-specific escalated student issues'),
            t('landing.role_section_b2', 'Direct resolution workflows with audit logging and student notifications'),
            t('landing.role_section_b3', 'Cross-functional coordination with Faculty Mentors and HODs'),
            t('landing.role_section_b4', 'Operational bottleneck identification and performance analytics')
          ],
          ctaText: t('landing.role_section_cta', 'Section Portal →'),
          ctaHref: '#/login'
        };
      case 'admin':
        return {
          title: t('landing.role_admin_title', '⚙️ Admin System Operations'),
          desc: t('landing.role_admin_desc', 'Master control center for user registration, bulk imports, duplicate data cleaning, department name standardization, and platform configuration.'),
          bullets: [
            t('landing.role_admin_b1', 'Bulk CSV/Excel User & Assignment Imports with auto column mapping'),
            t('landing.role_admin_b2', '1-Click Duplicate Database Record Cleaner and data normalizer'),
            t('landing.role_admin_b3', 'Statutory Cells account manager & institutional escalation wiring'),
            t('landing.role_admin_b4', 'Full Role & Permission Management with audit log tracking')
          ],
          ctaText: t('landing.role_admin_cta', 'Admin Operations →'),
          ctaHref: '#/login'
        };
      default:
        return null;
    }
  }

  const roleTabDisplay = container.querySelector('#role-tab-display');

  function renderRoleTab(roleKey) {
    const data = getRoleData(roleKey);
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
          ${user ? (t('landing.nav_dashboard', 'Go to Dashboard') + ' →') : data.ctaText}
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
          <p style="margin:0 0 10px 0;"><strong>${t('landing.roles_tag', 'Active Role')}:</strong> <span class="badge badge-accent">${roleKey.toUpperCase()}</span></p>
          <p style="margin:0 0 10px 0;"><strong>${t('common.status', 'Status')}:</strong> ${t('landing.sync_status', 'System Verified & Synced with Firestore')}</p>
          <p style="margin:0;"><strong>${t('landing.feature_access', 'Feature Access')}:</strong> ${t('landing.workspace_enabled', 'Full Workspace Privileges Enabled')}</p>
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
