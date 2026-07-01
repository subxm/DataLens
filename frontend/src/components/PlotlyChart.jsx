import React, { useEffect, useRef } from 'react';

const PlotlyChart = ({ spec, theme = 'dark', height = '250px' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;

    const renderChart = async () => {
      // Wait for Plotly to load from CDN if it's not ready yet
      let attempts = 0;
      while (!window.Plotly && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.Plotly || !containerRef.current) return;

      const isDark = theme === 'dark';
      const textColor = isDark ? '#E2E8F0' : '#374151'; // slate-200 vs gray-700
      const gridColor = isDark ? '#334155' : '#E5E7EB'; // slate-700 vs gray-200

      // Adjust layout parameters to match active theme
      const updatedLayout = {
        ...spec.layout,
        autosize: true,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          family: 'Inter, sans-serif',
          color: textColor,
          size: 11
        },
        xaxis: {
          ...spec.layout?.xaxis,
          gridcolor: gridColor,
          zerolinecolor: gridColor,
          tickcolor: gridColor,
          title: spec.layout?.xaxis?.title ? {
            ...spec.layout.xaxis.title,
            font: { family: 'Inter, sans-serif', color: textColor, size: 12 }
          } : undefined
        },
        yaxis: {
          ...spec.layout?.yaxis,
          gridcolor: gridColor,
          zerolinecolor: gridColor,
          tickcolor: gridColor,
          title: spec.layout?.yaxis?.title ? {
            ...spec.layout.yaxis.title,
            font: { family: 'Inter, sans-serif', color: textColor, size: 12 }
          } : undefined
        }
      };

      try {
        window.Plotly.newPlot(
          containerRef.current,
          spec.data,
          updatedLayout,
          {
            responsive: true,
            displayModeBar: false,
          }
        );
      } catch (err) {
        console.error("Plotly render error: ", err);
      }
    };

    renderChart();

    const handleResize = () => {
      if (containerRef.current && window.Plotly) {
        try {
          window.Plotly.Plots.resize(containerRef.current);
        } catch (e) {}
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && window.Plotly) {
        try {
          window.Plotly.Plots.purge(containerRef.current);
        } catch (e) {}
      }
    };
  }, [spec, theme]);

  return (
    <div 
      ref={containerRef} 
      className="w-full rounded-lg overflow-hidden bg-slate-900/10 p-2" 
      style={{ height }} 
    />
  );
};

export default PlotlyChart;
