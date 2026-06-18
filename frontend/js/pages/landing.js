export async function render(container) {
  container.innerHTML = `
    <div class="landing-page" style="min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-default);">
      
      <!-- Navbar -->
      <nav style="display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; background: rgba(var(--bg-default-rgb), 0.8); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 100; border-bottom: 1px solid var(--border-color);">
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">MentorOS</div>
        <div>
          <button id="theme-toggle" class="btn btn-ghost" style="margin-right: 16px;">
            <svg class="sun-icon" viewBox="0 0 24 24" width="20" height="20" style="display:none;fill:currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/></svg>
            <svg class="moon-icon" viewBox="0 0 24 24" width="20" height="20" style="display:none;fill:currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7c.18 0 .35.02.52.05-.72.82-1.18 1.89-1.25 3.05-.03.58.05 1.15.22 1.69.34 1.12.97 2.1 1.8 2.87.82.76 1.83 1.33 2.95 1.6.51.13 1.04.18 1.57.14 1.12-.08 2.14-.52 2.94-1.21.03.17.05.34.05.52 0 3.86-3.14 7-7 7z"/></svg>
          </button>
          <a href="#/login" class="btn btn-primary">Login / Get Started</a>
        </div>
      </nav>

      <!-- Hero Section -->
      <section style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 100px 20px;">
        <h1 style="font-size: 3.5rem; font-weight: 800; margin-bottom: 20px; background: linear-gradient(90deg, var(--primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Elevate Student Success</h1>
        <p style="font-size: 1.2rem; color: var(--text-secondary); max-width: 600px; margin-bottom: 40px; line-height: 1.6;">
          MentorOS is a next-generation Student Mentorship Platform. It connects students, faculty, and administration through seamless communication, real-time analytics, and automated risk management.
        </p>
        <div style="display: flex; gap: 16px;">
          <a href="#/login" class="btn btn-primary" style="padding: 12px 32px; font-size: 1.1rem; border-radius: 30px;">Get Started</a>
        </div>
      </section>

      <!-- Features Section -->
      <section style="background: var(--bg-surface); padding: 80px 20px;">
        <div style="max-width: 1200px; margin: 0 auto;">
          <h2 style="font-size: 2.2rem; text-align: center; margin-bottom: 60px;">Platform Features</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
            <div class="card" style="padding: 30px; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 16px;">🤖</div>
              <h3 style="margin-bottom: 12px;">Auto-Allocation Engine</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem;">Intelligently distributes students to faculty mentors based on departmental capacity and workload balance.</p>
            </div>
            <div class="card" style="padding: 30px; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 16px;">📊</div>
              <h3 style="margin-bottom: 12px;">Risk Assessment</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem;">Automatically computes student risk scores using academic metrics like CGPA and Attendance to flag at-risk students.</p>
            </div>
            <div class="card" style="padding: 30px; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 16px;">📹</div>
              <h3 style="margin-bottom: 12px;">Built-in WebRTC Meetings</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem;">Host secure, peer-to-peer video conferencing directly within the platform with live chat and screen sharing.</p>
            </div>
            <div class="card" style="padding: 30px; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 16px;">📈</div>
              <h3 style="margin-bottom: 12px;">Multi-Tier Escalation</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem;">Robust issue tracking workflow routing from Mentors to HODs, Section Heads, and the Dean seamlessly.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Contributors Section -->
      <section style="padding: 80px 20px;">
        <div style="max-width: 1000px; margin: 0 auto; text-align: center;">
          <h2 style="font-size: 2.2rem; margin-bottom: 16px;">Meet the Team</h2>
          <p style="color: var(--text-muted); margin-bottom: 60px;">The brilliant minds behind MentorOS.</p>
          
          <!-- Guide -->
          <div style="margin-bottom: 50px;">
            <div class="card" style="display: inline-block; padding: 24px 48px; border: 2px solid var(--primary);">
              <h3 style="font-size: 1.5rem; margin-bottom: 8px;">Dr. Nilesh Thorat</h3>
              <p style="color: var(--primary); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem;">Project Guide</p>
            </div>
          </div>

          <!-- Team -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; justify-content: center;">
            <div class="card" style="padding: 24px;">
              <div class="avatar" style="width: 64px; height: 64px; font-size: 1.5rem; margin: 0 auto 16px auto; background: var(--info);">AG</div>
              <h3 style="font-size: 1.2rem;">Atharva Gandhi</h3>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">Developer & Contributor</p>
            </div>
            <div class="card" style="padding: 24px;">
              <div class="avatar" style="width: 64px; height: 64px; font-size: 1.5rem; margin: 0 auto 16px auto; background: var(--warning);">VB</div>
              <h3 style="font-size: 1.2rem;">Vaibhav Bariyar</h3>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">Developer & Contributor</p>
            </div>
            <div class="card" style="padding: 24px;">
              <div class="avatar" style="width: 64px; height: 64px; font-size: 1.5rem; margin: 0 auto 16px auto; background: var(--success);">SD</div>
              <h3 style="font-size: 1.2rem;">Satwik Dhole</h3>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">Developer & Contributor</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer style="background: var(--bg-surface); padding: 40px 20px; text-align: center; border-top: 1px solid var(--border-color); margin-top: auto;">
        <p style="color: var(--text-muted); font-size: 0.9rem;">&copy; ${new Date().getFullYear()} MentorOS. All rights reserved.</p>
      </footer>
    </div>
  `;

  // Trigger initial UI theme update
  const event = new Event('DOMContentLoaded');
  document.dispatchEvent(event);
}
