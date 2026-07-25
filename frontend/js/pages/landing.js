export async function render(container) {
  container.innerHTML = `
    <div class="landing-page" style="min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-primary); font-family: 'Inter', sans-serif; width: 100%; max-width: 100vw; overflow-x: hidden; box-sizing: border-box;">
      <style>
        .landing-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 32px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 4px 20px rgba(92, 27, 94, 0.08);
          box-sizing: border-box;
          width: 100%;
          max-width: 100vw;
        }

        .landing-hero-title {
          font-size: 3.25rem;
          font-weight: 800;
          line-height: 1.15;
          margin-bottom: 20px;
          letter-spacing: -0.02em;
          word-break: break-word;
        }

        @media (max-width: 768px) {
          .landing-nav {
            padding: 10px 12px !important;
            gap: 6px !important;
          }
          .landing-brand-logo {
            max-height: 32px !important;
            max-width: 110px !important;
            object-fit: contain !important;
          }
          .landing-brand-text {
            font-size: 1.25rem !important;
          }
          .landing-badge {
            display: none !important;
          }
          .landing-login-btn {
            padding: 6px 12px !important;
            font-size: 0.78rem !important;
            border-radius: 20px !important;
          }
          .desktop-only {
            display: none !important;
          }
          .landing-hero {
            padding: 24px 16px !important;
            text-align: center !important;
            gap: 20px !important;
          }
          .landing-hero-title {
            font-size: 1.75rem !important;
            line-height: 1.25 !important;
          }
          .landing-hero-desc {
            font-size: 0.92rem !important;
            margin-bottom: 18px !important;
          }
          .landing-hero-img {
            width: 100% !important;
            max-width: 320px !important;
          }
        }

        @media (max-width: 400px) {
          .landing-brand-text {
            display: none !important;
          }
          .landing-brand-logo {
            max-height: 28px !important;
            max-width: 95px !important;
          }
          .landing-hero-title {
            font-size: 1.55rem !important;
          }
        }
      </style>
      
      <!-- Navbar -->
      <nav class="landing-nav">
        <div style="display:flex; align-items:center; gap:8px; min-width: 0; flex-shrink: 1;">
          <img src="/assets/images/mit_adt_logo.png" alt="MIT-ADT University Logo" class="landing-brand-logo">
          <div class="landing-brand-text">Lumina</div>
          <span class="landing-badge">MIT-ADT</span>
        </div>
        <div style="display:flex; align-items:center; gap: 6px; flex-shrink: 0;">
          <button id="theme-toggle" class="btn" style="border-radius: 50%; width: 34px; height: 34px; min-width: 34px; padding:0; display:flex; align-items:center; justify-content:center; background: rgba(15,23,42,0.06); border: 1px solid rgba(15,23,42,0.12); color: #1e293b;">
            <svg class="sun-icon" viewBox="0 0 24 24" width="17" height="17" style="display:none;fill:currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/></svg>
            <svg class="moon-icon" viewBox="0 0 24 24" width="17" height="17" style="display:none;fill:currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7c.18 0 .35.02.52.05-.72.82-1.18 1.89-1.25 3.05-.03.58.05 1.15.22 1.69.34 1.12.97 2.1 1.8 2.87.82.76 1.83 1.33 2.95 1.6.51.13 1.04.18 1.57.14 1.12-.08 2.14-.52 2.94-1.21.03.17.05.34.05.52 0 3.86-3.14 7-7 7z"/></svg>
          </button>
          <a href="#/login" class="btn landing-login-btn">Login Portal</a>
        </div>
      </nav>

      <!-- Hero Section -->
      <section class="landing-hero">
        <div>
          <h1 class="landing-hero-title">
            The Future of <br class="desktop-only">
            <span style="background: linear-gradient(90deg, #CE1126 0%, #C2185B 50%, #5C1B5E 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;">Student Mentorship</span>
          </h1>
          <p class="landing-hero-desc">
            Connect students, faculty, and administration through seamless communication, real-time analytics, and automated risk management all in one place.
          </p>
          <div style="display: flex; gap: 16px; justify-content: inherit;">
            <a href="#/login" class="btn" style="background: linear-gradient(135deg, #E67E22 0%, #D35400 100%); color: #ffffff; padding: 16px 38px; font-size: 1.1rem; border-radius: 30px; font-weight: 700; box-shadow: 0 8px 24px rgba(230, 126, 34, 0.4); text-decoration:none;">Get Started Now</a>
          </div>
        </div>
        <div class="landing-hero-img-wrap">
          <img src="/assets/images/hero.png" alt="Dashboard Illustration" class="landing-hero-img">
          <style>
            @keyframes float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-16px); }
              100% { transform: translateY(0px); }
            }
          </style>
        </div>
      </section>

      <!-- Features Section -->
      <section style="background: var(--bg-secondary); padding: 70px 20px; border-top: 1px solid var(--border);">
        <div style="max-width: 1200px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 50px;">
            <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 12px;">Core Capabilities</h2>
            <p style="color: var(--text-muted); font-size: 1.05rem;">Everything your institution needs to ensure student success.</p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px;">
            <div class="card" style="padding: 36px 24px; text-align: center; transition: transform 0.3s;" onmouseover="this.style.transform='translateY(-6px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 2.8rem; margin-bottom: 16px;">🤖</div>
              <h3 style="margin-bottom: 10px; font-size: 1.25rem;">Smart Allocation</h3>
              <p style="color: var(--text-muted); font-size: 0.925rem; line-height: 1.6;">Intelligently distributes students to faculty mentors based on departmental capacity and dynamic workload balancing.</p>
            </div>
            <div class="card" style="padding: 36px 24px; text-align: center; transition: transform 0.3s;" onmouseover="this.style.transform='translateY(-6px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 2.8rem; margin-bottom: 16px;">📊</div>
              <h3 style="margin-bottom: 10px; font-size: 1.25rem;">Risk Assessment</h3>
              <p style="color: var(--text-muted); font-size: 0.925rem; line-height: 1.6;">Automatically computes student risk scores using academic metrics like CGPA and Attendance to flag at-risk students instantly.</p>
            </div>
            <div class="card" style="padding: 36px 24px; text-align: center; transition: transform 0.3s;" onmouseover="this.style.transform='translateY(-6px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 2.8rem; margin-bottom: 16px;">📹</div>
              <h3 style="margin-bottom: 10px; font-size: 1.25rem;">WebRTC Meetings</h3>
              <p style="color: var(--text-muted); font-size: 0.925rem; line-height: 1.6;">Host secure, peer-to-peer video conferencing directly within the platform. Complete with live chat and screen sharing.</p>
            </div>
            <div class="card" style="padding: 36px 24px; text-align: center; transition: transform 0.3s;" onmouseover="this.style.transform='translateY(-6px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 2.8rem; margin-bottom: 16px;">📈</div>
              <h3 style="margin-bottom: 10px; font-size: 1.25rem;">Multi-Tier Escalation</h3>
              <p style="color: var(--text-muted); font-size: 0.925rem; line-height: 1.6;">Robust issue tracking workflow routing from Mentors directly to specific Section Heads, HODs, and the Dean.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Special Thanks & Pilot Recognition Section -->
      <section class="landing-ack-section">
        <div class="landing-ack-card">
          <div style="margin-bottom: 16px;">
            <span class="badge badge-accent" style="font-size: 0.85rem; padding: 6px 16px; border-radius: 20px; font-weight: 700; letter-spacing: 0.04em;">
              TY CSE CORE PILOT RECOGNITION
            </span>
          </div>
          <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 16px; color: var(--text-primary);">
            Special Acknowledgement
          </h2>
          <p style="font-size: 1.1rem; color: var(--text-secondary); line-height: 1.7; max-width: 760px; margin: 0 auto 20px;">
            Our heartfelt gratitude and special thanks to <strong>Dr. Suwarna Pawar Ma'am</strong>, Head of Department (HOD), CSE Core Department, for granting permission and support to pilot the <strong>Lumina Mentorship Platform</strong> in <strong>TY CSE Core</strong>.
          </p>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--primary);">
            CSE Core Department — School of Computer Science & Engineering
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer style="background: var(--bg-secondary); padding: 30px 40px; text-align: center; border-top: 1px solid var(--border); margin-top: auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">Lumina</div>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin:0;">&copy; ${new Date().getFullYear()} Lumina Team. All rights reserved.</p>
        <div style="display: flex; gap: 16px;">
          <a href="#/login" style="color: var(--text-secondary); text-decoration: none; font-size: 0.95rem; font-weight: 500;">Login</a>
        </div>
      </footer>
    </div>
  `;

  // Trigger initial UI theme update
  const event = new Event('DOMContentLoaded');
  document.dispatchEvent(event);
}
