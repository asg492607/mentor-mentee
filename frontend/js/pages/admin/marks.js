export async function render(container) {
  const page = await import('../section/exams.js');
  return page.render(container);
}
