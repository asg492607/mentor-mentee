export function showModal(options) {
  const { title, content, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', size = 'md' } = options;
  
  const root = document.getElementById('modal-root');
  if (!root) return;

  const maxWidth = size === 'lg' ? '800px' : size === 'sm' ? '400px' : '500px';

  const modalHtml = `
    <div class="modal-overlay" id="custom-modal-overlay">
      <div class="modal" style="max-width: ${maxWidth}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" id="custom-modal-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="custom-modal-cancel">${cancelText}</button>
          <button class="btn btn-primary" id="custom-modal-confirm">${confirmText}</button>
        </div>
      </div>
    </div>
  `;

  root.innerHTML = modalHtml;

  const closeBtn = document.getElementById('custom-modal-close');
  const cancelBtn = document.getElementById('custom-modal-cancel');
  const confirmBtn = document.getElementById('custom-modal-confirm');
  const overlay = document.getElementById('custom-modal-overlay');

  const close = () => {
    hideModal();
    if (onCancel) onCancel();
  };

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  confirmBtn.addEventListener('click', () => {
    if (onConfirm) {
      // Pass a close function so confirm can decide when to close
      onConfirm(hideModal);
    } else {
      hideModal();
    }
  });
  
  // Escape key handler
  const escapeHandler = (e) => {
      if (e.key === 'Escape') {
          close();
          document.removeEventListener('keydown', escapeHandler);
      }
  };
  document.addEventListener('keydown', escapeHandler);
}

export function hideModal() {
  const root = document.getElementById('modal-root');
  if (root) {
    // Add slide out animation before removing
    const modal = root.querySelector('.modal');
    const overlay = root.querySelector('.modal-overlay');
    if(modal && overlay) {
        modal.style.animation = 'slideDown var(--transition-fast) reverse forwards';
        overlay.style.animation = 'fadeIn var(--transition-fast) reverse forwards';
        setTimeout(() => {
            root.innerHTML = '';
        }, 150);
    } else {
        root.innerHTML = '';
    }
  }
}
