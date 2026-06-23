export function startTour(tourId, steps, force = false) {
  if (!steps || steps.length === 0) return;
  if (!force && localStorage.getItem(`hasSeenTour_${tourId}`)) return;

  let currentStepIndex = 0;
  let spotlight, popover, overlay;

  function init() {
    // Prevent scrolling on body to keep tour smooth
    document.body.style.overflow = 'hidden';

    // Create the dark overlay/spotlight element
    spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';
    
    // Create beacon
    const beacon = document.createElement('div');
    beacon.className = 'tour-beacon';
    spotlight.appendChild(beacon);
    
    document.body.appendChild(spotlight);

    // Create the popover card
    popover = document.createElement('div');
    popover.className = 'tour-popover card card-glass fade-in';
    document.body.appendChild(popover);

    renderStep();

    // Handle window resize
    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    renderStep();
  }

  function renderStep() {
    const step = steps[currentStepIndex];
    let targetEl = null;

    if (step.selector) {
      targetEl = document.querySelector(step.selector);
    }

    if (targetEl) {
      // Scroll target into view if needed
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Wait for scroll to finish
      setTimeout(() => {
        const rect = targetEl.getBoundingClientRect();
        const padding = 8;
        
        spotlight.style.top = `${rect.top - padding + window.scrollY}px`;
        spotlight.style.left = `${rect.left - padding + window.scrollX}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
        spotlight.style.opacity = '1';
        spotlight.style.borderRadius = getComputedStyle(targetEl).borderRadius || '8px';

        positionPopover(rect, step.position || 'bottom');
      }, 300);
    } else {
      // If no element found, center the popover and hide spotlight
      spotlight.style.opacity = '0';
      popover.style.top = '50%';
      popover.style.left = '50%';
      popover.style.transform = 'translate(-50%, -50%)';
    }

    // Render popover content
    const isLast = currentStepIndex === steps.length - 1;
    const isFirst = currentStepIndex === 0;

    popover.innerHTML = `
      <div class="tour-popover-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; background: linear-gradient(135deg, #fff 0%, #c4b5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${step.title}</h3>
        <span style="font-size: 0.75rem; color: rgba(255,255,255,0.4); font-weight: 600; padding: 2px 8px; background: rgba(255,255,255,0.1); border-radius: 12px;">${currentStepIndex + 1} / ${steps.length}</span>
      </div>
      <p style="margin: 0 0 20px; font-size: 0.95rem; color: rgba(255,255,255,0.7); line-height: 1.5;">${step.desc}</p>
      <div class="tour-popover-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <button class="btn btn-ghost btn-sm tour-btn-skip" style="padding-left: 0; color: rgba(255,255,255,0.5);">Skip Tour</button>
        <div style="display: flex; gap: 8px;">
          ${!isFirst ? `<button class="btn btn-secondary btn-sm tour-btn-prev">Back</button>` : ''}
          <button class="btn btn-primary btn-sm tour-btn-next">${isLast ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    `;

    // Attach event listeners
    popover.querySelector('.tour-btn-skip').onclick = () => finishTour(false);
    if (!isFirst) {
      popover.querySelector('.tour-btn-prev').onclick = () => {
        currentStepIndex--;
        renderStep();
      };
    }
    popover.querySelector('.tour-btn-next').onclick = () => {
      if (isLast) {
        finishTour(true);
      } else {
        currentStepIndex++;
        renderStep();
      }
    };
  }

  function positionPopover(rect, position) {
    const popoverRect = popover.getBoundingClientRect();
    const gap = 16;
    let top, left;

    switch (position) {
      case 'bottom':
        top = rect.bottom + gap + window.scrollY;
        left = rect.left + window.scrollX + (rect.width / 2) - (popoverRect.width / 2);
        break;
      case 'top':
        top = rect.top - popoverRect.height - gap + window.scrollY;
        left = rect.left + window.scrollX + (rect.width / 2) - (popoverRect.width / 2);
        break;
      case 'right':
        top = rect.top + window.scrollY + (rect.height / 2) - (popoverRect.height / 2);
        left = rect.right + gap + window.scrollX;
        break;
      case 'left':
        top = rect.top + window.scrollY + (rect.height / 2) - (popoverRect.height / 2);
        left = rect.left - popoverRect.width - gap + window.scrollX;
        break;
      default:
        top = rect.bottom + gap + window.scrollY;
        left = rect.left + window.scrollX;
    }

    // Keep within bounds
    if (left < 16) left = 16;
    if (top < 16) top = 16;
    if (left + popoverRect.width > window.innerWidth - 16) left = window.innerWidth - popoverRect.width - 16;
    if (top + popoverRect.height > window.innerHeight - 16) top = window.innerHeight - popoverRect.height - 16;

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.transform = 'none'; // reset centered transform if any
  }

  function finishTour(withCelebration = false) {
    localStorage.setItem(`hasSeenTour_${tourId}`, 'true');
    spotlight.style.opacity = '0';
    popover.style.opacity = '0';
    
    if (withCelebration) celebrate();

    setTimeout(() => {
      spotlight.remove();
      popover.remove();
      document.body.style.overflow = '';
      window.removeEventListener('resize', handleResize);
    }, 300);
  }

  function celebrate() {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#34d399', '#fcd34d'];
    for (let i = 0; i < 60; i++) {
      const conf = document.createElement('div');
      conf.style.position = 'fixed';
      conf.style.width = '10px';
      conf.style.height = '10px';
      conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      conf.style.top = '50%';
      conf.style.left = '50%';
      conf.style.zIndex = '10000';
      conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      conf.style.pointerEvents = 'none';
      
      const angle = Math.random() * Math.PI * 2;
      const velocity = 10 + Math.random() * 20;
      const tx = Math.cos(angle) * velocity * 20;
      const ty = Math.sin(angle) * velocity * 20;
      
      conf.animate([
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ], {
        duration: 1000 + Math.random() * 1000,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
      });
      
      document.body.appendChild(conf);
      setTimeout(() => conf.remove(), 2000);
    }
  }

  // Delay init slightly to ensure DOM is fully rendered
  setTimeout(init, 500);
}
