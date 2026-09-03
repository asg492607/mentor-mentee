import { showModal, hideModal } from './modal.js';
import { WebIssueService } from '../services.js';
import { AIService } from '../services/ai-service.js';
import { getUserProfile } from '../auth.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils.js';

export function openWebIssueModal() {
  const user = getUserProfile();
  const currentUrl = window.location.href;

  const content = `
    <form id="web-issue-form" class="flex flex-col gap-4">
      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Issue Title <span style="color:#ef4444;">*</span></label>
        <input type="text" id="web-issue-title" class="form-input" placeholder="e.g. Booking modal not loading on mobile" required>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Category</label>
          <select id="web-issue-category" class="form-select">
            <option value="UI / UX Bug">UI / UX Bug</option>
            <option value="Portal Error">Portal Feature Error</option>
            <option value="Data / Booklet Issue">Data / Booklet Issue</option>
            <option value="Performance">Performance / Slow</option>
            <option value="Feature Request">Feature Request</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Priority</label>
          <select id="web-issue-priority" class="form-select">
            <option value="Low">Low</option>
            <option value="Medium" selected>Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <label class="form-label" style="font-weight:600;margin:0;">Issue Description / Steps <span style="color:#ef4444;">*</span></label>
          <button type="button" class="btn-ai-sparkle" id="btn-web-issue-ai-polish">
            <i class="ph-bold ph-sparkle"></i> ✨ AI Polish
          </button>
        </div>
        <textarea id="web-issue-desc" class="form-textarea" rows="4" placeholder="Explain what happened, expected result, and steps to reproduce..." required></textarea>
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight:600;font-size:0.78rem;color:var(--text-muted);">Current Route URL</label>
        <input type="text" id="web-issue-url" class="form-input" value="${escapeHtml(currentUrl)}" readonly style="background:var(--bg-secondary);font-family:monospace;font-size:0.78rem;">
      </div>
    </form>
  `;

  showModal({
    title: '🐞 Report Web Issue / Bug',
    content: content,
    confirmText: 'Submit Issue',
    cancelText: 'Cancel',
    size: 'md',
    onConfirm: async (close) => {
      const title = document.getElementById('web-issue-title')?.value.trim();
      const category = document.getElementById('web-issue-category')?.value;
      const priority = document.getElementById('web-issue-priority')?.value;
      const description = document.getElementById('web-issue-desc')?.value.trim();
      const pageUrl = document.getElementById('web-issue-url')?.value;

      if (!title || !description) {
        showToast('Please enter both Issue Title and Description.', 'warning');
        return;
      }

      try {
        await WebIssueService.submitIssue({
          title,
          category,
          priority,
          description,
          pageUrl,
          reporterId: user?.id || user?.uid || 'anonymous',
          reporterName: user?.name || 'Anonymous User',
          reporterRole: user?.role || 'GUEST',
          reporterEmail: user?.email || ''
        });

        showToast('🐞 Web Issue submitted successfully! Admin will review it.', 'success');
        close();
      } catch (err) {
        console.error('Failed to submit web issue:', err);
        showToast('Failed to submit issue. Please try again.', 'error');
      }
    }
  });

  // Attach AI Polish listener
  setTimeout(() => {
    document.getElementById('btn-web-issue-ai-polish')?.addEventListener('click', async () => {
      const title = document.getElementById('web-issue-title')?.value.trim();
      const desc = document.getElementById('web-issue-desc')?.value.trim();
      const category = document.getElementById('web-issue-category')?.value;
      const priority = document.getElementById('web-issue-priority')?.value;

      if (!title && !desc) {
        showToast('Please enter an issue title or rough description first.', 'warning');
        return;
      }

      const aiBtn = document.getElementById('btn-web-issue-ai-polish');
      if (aiBtn) {
        aiBtn.disabled = true;
        aiBtn.innerHTML = 'Polishing...';
      }

      try {
        const polished = await AIService.polishIssueDescription({
          title: title || 'Web Platform Issue',
          description: desc || title,
          category,
          priority
        });
        const descEl = document.getElementById('web-issue-desc');
        if (descEl) descEl.value = polished;
        showToast('✨ Issue description polished with AI!', 'success');
      } catch (err) {
        console.error('AI Polish error:', err);
        showToast('Could not polish with AI.', 'error');
      } finally {
        if (aiBtn) {
          aiBtn.disabled = false;
          aiBtn.innerHTML = '<i class="ph-bold ph-sparkle"></i> ✨ AI Polish';
        }
      }
    });
  }, 100);
}
