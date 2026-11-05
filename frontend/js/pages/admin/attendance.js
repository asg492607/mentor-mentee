export async function render(container) {
  const page = await import('../mentor/attendance.js');
  return page.render(container);
}
