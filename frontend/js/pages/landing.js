export async function render(container) {
  container.innerHTML = `
    <div class="landing-page" style="min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-default); font-family: 'Inter', sans-serif;">
      
      <!-- Navbar -->
      <nav style="display: flex; justify-content: space-between; align-items: center; padding: 20px 60px; background: rgba(var(--bg-default-rgb), 0.85); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; border-bottom: 1px solid var(--border-color);">
        <div style="font-size: 1.75rem; font-weight: 800; color: var(--primary); letter-spacing: -0.5px;">mentor<span style="color:var(--accent);">-mentee</span></div>
        <div style="display:flex; align-items:center; gap: 20px;">
          <button id="theme-toggle" class="btn btn-ghost" style="border-radius: 50%;">
            <svg class="sun-icon" viewBox="0 0 24 24" width="22" height="22" style="display:none;fill:currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/></svg>
            <svg class="moon-icon" viewBox="0 0 24 24" width="22" height="22" style="display:none;fill:currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7c.18 0 .35.02.52.05-.72.82-1.18 1.89-1.25 3.05-.03.58.05 1.15.22 1.69.34 1.12.97 2.1 1.8 2.87.82.76 1.83 1.33 2.95 1.6.51.13 1.04.18 1.57.14 1.12-.08 2.14-.52 2.94-1.21.03.17.05.34.05.52 0 3.86-3.14 7-7 7z"/></svg>
          </button>
          <a href="#/login" class="btn btn-primary" style="border-radius:30px; padding: 10px 24px; font-weight: 600; box-shadow: 0 4px 14px rgba(124,106,255,0.4);">Login Portal</a>
        </div>
      </nav>

      <!-- Hero Section -->
      <section style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; padding: 80px 60px; max-width: 1400px; margin: 0 auto;">
        <div style="padding-right: 20px;">
          <h1 style="font-size: 4rem; font-weight: 800; line-height: 1.1; margin-bottom: 24px;">
            The Future of <br>
            <span style="background: linear-gradient(90deg, var(--primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Student Mentorship</span>
          </h1>
          <p style="font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 40px; line-height: 1.6;">
            Connect students, faculty, and administration through seamless communication, real-time analytics, and automated risk management all in one place.
          </p>
          <div style="display: flex; gap: 16px;">
            <a href="#/login" class="btn btn-primary" style="padding: 16px 36px; font-size: 1.1rem; border-radius: 30px; font-weight: 600; box-shadow: 0 8px 24px rgba(124,106,255,0.4);">Get Started Now</a>
          </div>
        </div>
        <div style="position: relative; text-align: center;">
          <!-- Using the generated image -->
          <img src="/assets/images/hero.png" alt="Dashboard Illustration" style="max-width: 100%; width: 550px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); animation: float 6s ease-in-out infinite;">
          <style>
            @keyframes float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-20px); }
              100% { transform: translateY(0px); }
            }
          </style>
        </div>
      </section>

      <!-- Features Section -->
      <section style="background: var(--bg-surface); padding: 100px 40px; border-top: 1px solid var(--border-color);">
        <div style="max-width: 1200px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 60px;">
            <h2 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 16px;">Core Capabilities</h2>
            <p style="color: var(--text-muted); font-size: 1.1rem;">Everything your institution needs to ensure student success.</p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px;">
            <div class="card" style="padding: 40px 30px; text-align: center; transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 3rem; margin-bottom: 20px; text-shadow: 0 0 20px rgba(124,106,255,0.5);">🤖</div>
              <h3 style="margin-bottom: 12px; font-size: 1.3rem;">Smart Allocation</h3>
              <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6;">Intelligently distributes students to faculty mentors based on departmental capacity and dynamic workload balancing.</p>
            </div>
            <div class="card" style="padding: 40px 30px; text-align: center; transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 3rem; margin-bottom: 20px; text-shadow: 0 0 20px rgba(255,107,107,0.5);">📊</div>
              <h3 style="margin-bottom: 12px; font-size: 1.3rem;">Risk Assessment</h3>
              <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6;">Automatically computes student risk scores using academic metrics like CGPA and Attendance to flag at-risk students instantly.</p>
            </div>
            <div class="card" style="padding: 40px 30px; text-align: center; transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 3rem; margin-bottom: 20px; text-shadow: 0 0 20px rgba(50,215,160,0.5);">📹</div>
              <h3 style="margin-bottom: 12px; font-size: 1.3rem;">WebRTC Meetings</h3>
              <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6;">Host secure, peer-to-peer video conferencing directly within the platform. Complete with live chat and screen sharing.</p>
            </div>
            <div class="card" style="padding: 40px 30px; text-align: center; transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="font-size: 3rem; margin-bottom: 20px; text-shadow: 0 0 20px rgba(255,165,0,0.5);">📈</div>
              <h3 style="margin-bottom: 12px; font-size: 1.3rem;">Multi-Tier Escalation</h3>
              <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6;">Robust issue tracking workflow routing from Mentors directly to specific Section Heads, HODs, and the Dean.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Contributors Section -->
      <section style="padding: 100px 40px; background: linear-gradient(180deg, var(--bg-default) 0%, rgba(124,106,255,0.05) 100%);">
        <div style="max-width: 1100px; margin: 0 auto; text-align: center;">
          <h2 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 16px;">Meet the Team</h2>
          <p style="color: var(--text-muted); font-size: 1.1rem; margin-bottom: 80px;">The brilliant minds behind mentor-mentee.</p>
          
          <!-- Guide Highlight -->
          <div style="margin-bottom: 80px; display: flex; justify-content: center;">
            <div class="card" style="display: flex; flex-direction: column; align-items: center; padding: 40px 60px; border: 2px solid var(--primary); box-shadow: 0 10px 30px rgba(124,106,255,0.15);">
              <img src="https://api.dicebear.com/7.x/notionists/svg?seed=DrThorat&backgroundColor=7c6aff" alt="Dr. Nilesh Thorat" style="width: 100px; height: 100px; border-radius: 50%; margin-bottom: 20px; border: 3px solid var(--primary);">
              <h3 style="font-size: 1.8rem; margin-bottom: 8px;">Dr. Nilesh Thorat</h3>
              <span class="badge badge-primary" style="font-size: 0.9rem; padding: 6px 16px;">Project Guide</span>
            </div>
          </div>

          <!-- Development Team -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px;">
            <div class="card" style="padding: 40px 20px; display: flex; flex-direction: column; align-items: center;">
              <img src="https://api.dicebear.com/7.x/notionists/svg?seed=AtharvaGandhi&backgroundColor=17a2b8" alt="Atharva Gandhi" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 20px; border: 3px solid var(--info);">
              <h3 style="font-size: 1.3rem; margin-bottom: 6px;">Atharva Gandhi</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem; font-weight: 500;">Developer & Contributor</p>
            </div>
            
            <div class="card" style="padding: 40px 20px; display: flex; flex-direction: column; align-items: center;">
              <img src="https://api.dicebear.com/7.x/notionists/svg?seed=VaibhavBariyar&backgroundColor=ffc107" alt="Vaibhav Bariyar" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 20px; border: 3px solid var(--warning);">
              <h3 style="font-size: 1.3rem; margin-bottom: 6px;">Vaibhav Bariyar</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem; font-weight: 500;">Developer & Contributor</p>
            </div>
            
            <div class="card" style="padding: 40px 20px; display: flex; flex-direction: column; align-items: center;">
              <img src="https://api.dicebear.com/7.x/notionists/svg?seed=SatwikDhole&backgroundColor=28a745" alt="Satwik Dhole" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 20px; border: 3px solid var(--success);">
              <h3 style="font-size: 1.3rem; margin-bottom: 6px;">Satwik Dhole</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem; font-weight: 500;">Developer & Contributor</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer style="background: var(--bg-surface); padding: 40px 40px; text-align: center; border-top: 1px solid var(--border-color); margin-top: auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
        <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">mentor<span style="color:var(--accent);">-mentee</span></div>
        <p style="color: var(--text-muted); font-size: 0.95rem;">&copy; ${new Date().getFullYear()} mentor-mentee Team. All rights reserved.</p>
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
