export function createChart(containerId, type, data, options = {}) {
  const ctx = document.getElementById(containerId);
  if (!ctx) return null;

  // Apply dark theme defaults
  Chart.defaults.color = '#9999cc';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.06)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#eeeeff'
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
      
      mergedOptions.scales.y.grid = mergedOptions.scales.y.grid || { color: 'rgba(255, 255, 255, 0.06)' };
      mergedOptions.scales.x.grid = mergedOptions.scales.x.grid || { display: false };
  }

  // Common colors for charts
  if (data.datasets) {
      data.datasets.forEach(dataset => {
          if (!dataset.backgroundColor) {
              if (type === 'line') {
                  dataset.borderColor = '#7c6aff';
                  dataset.backgroundColor = 'rgba(124, 106, 255, 0.1)';
                  dataset.fill = true;
                  dataset.tension = 0.4; // smooth curves
              } else if (type === 'bar') {
                  dataset.backgroundColor = '#7c6aff';
                  dataset.borderRadius = 4;
              } else if (type === 'doughnut' || type === 'pie') {
                  dataset.backgroundColor = [
                      '#7c6aff', '#34d399', '#fbbf24', '#f87171', '#60a5fa'
                  ];
                  dataset.borderWidth = 0;
              }
          }
      });
  }

  return new Chart(ctx, {
    type,
    data,
    options: mergedOptions
  });
}

export function destroyChart(chartInstance) {
    if (chartInstance) {
        chartInstance.destroy();
    }
}
