export function showLoader() {
  const existing = document.getElementById('global-loader');
  if (existing) return;

  const loaderHtml = `
    <div class="loader-overlay" id="global-loader">
      <div class="spinner"></div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', loaderHtml);
}

export function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.remove();
  }
}
