export function createChart(containerOrId, type, data, options = {}) {
  if (typeof window === 'undefined' || !window.Chart) return null;

  const canvas = typeof containerOrId === 'string'
    ? document.getElementById(containerOrId)
    : containerOrId;

  if (!canvas) return null;

  // Auto-destroy any existing chart on this canvas to prevent Canvas reuse errors
  const existing = window.Chart.getChart(canvas);
  if (existing) {
    existing.destroy();
  }

  const isLight = (document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme')) === 'light';
  const textColor = isLight ? '#475569' : '#9999cc';
  const borderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)';

  window.Chart.defaults.color = textColor;
  window.Chart.defaults.borderColor = borderColor;
  window.Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isLight ? '#0f172a' : '#eeeeff',
          font: { family: "'Inter', sans-serif", size: 12 }
        }
      }
    }
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Adjust scales for line/bar charts
  if (type === 'line' || type === 'bar') {
    mergedOptions.scales = mergedOptions.scales || {};
    mergedOptions.scales.y = mergedOptions.scales.y || {};
    mergedOptions.scales.x = mergedOptions.scales.x || {};

    mergedOptions.scales.y.grid = mergedOptions.scales.y.grid || { color: borderColor };
    mergedOptions.scales.y.ticks = mergedOptions.scales.y.ticks || { color: textColor };
    mergedOptions.scales.x.grid = mergedOptions.scales.x.grid || { display: false };
    mergedOptions.scales.x.ticks = mergedOptions.scales.x.ticks || { color: textColor };
  }

  // Common colors for charts
  if (data.datasets) {
    data.datasets.forEach(dataset => {
      if (!dataset.backgroundColor) {
        if (type === 'line') {
          dataset.borderColor = '#7c6aff';
          dataset.backgroundColor = 'rgba(124, 106, 255, 0.1)';
          dataset.fill = true;
          dataset.tension = 0.4;
        } else if (type === 'bar') {
          dataset.backgroundColor = '#7c6aff';
          dataset.borderRadius = 4;
        } else if (type === 'doughnut' || type === 'pie') {
          dataset.backgroundColor = [
            '#7c6aff', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa'
          ];
          dataset.borderWidth = 0;
        }
      }
    });
  }

  return new window.Chart(canvas, {
    type,
    data,
    options: mergedOptions
  });
}

export function destroyChart(chartInstance) {
  if (chartInstance && typeof chartInstance.destroy === 'function') {
    chartInstance.destroy();
  }
}
