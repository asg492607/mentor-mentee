// Guided Tour feature disabled
export function startTour() {
  // Remove any leftover tour DOM elements if present
  document.querySelectorAll('.tour-spotlight, .tour-popover, .tour-beacon').forEach(el => el.remove());
  document.body.style.overflow = '';
}
