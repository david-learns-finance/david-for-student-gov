/**
 * charts.js
 * Renders the three data charts using Chart.js.
 *
 * TO REPLACE PLACEHOLDER DATA:
 *   Search for "REPLACE" comments below and swap in your real numbers.
 *   Each chart has a clearly labelled data section at the top.
 */

(function () {
  'use strict';

  // Shared colour palette — matches the campaign gold accent
  const GOLD    = '#f0c040';
  const GOLD2   = '#e8a020';
  const MUTED   = 'rgba(255,255,255,0.15)';
  const TEXT     = 'rgba(255,255,255,0.6)';
  const GRID     = 'rgba(255,255,255,0.08)';

  const COLORS = [
    '#f0c040', '#e07030', '#50b8e0', '#70d090',
    '#c060d0', '#e05070', '#40c0b0', '#8090f0'
  ];

  Chart.defaults.color = TEXT;
  Chart.defaults.borderColor = GRID;
  Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";

  document.addEventListener('DOMContentLoaded', function () {
    renderBudgetChart();
    renderTransferChart();
    renderMajorChart();
  });

  // ── Chart 1: Budget pie ──────────────────────────────────────────────────────

  function renderBudgetChart() {
    const el = document.getElementById('budget-chart');
    if (!el) return;

    const labels = [
      'ASB Supplies (4020)',
      'Prof. Services (5110)',
      'Software Subscriptions (5851)',
      'Food (5884)',
      'Transfer Out (7285)'
    ];
    const data = [30000, 30000, 1000, 35000, 40000]; // actual dollar amounts

    const total = data.reduce((a, b) => a + b, 0);

    new Chart(el, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: COLORS,
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        layout: { padding: { top: 80, bottom: 80, left: 80, right: 120 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed;
                const pct = (val / total * 100).toFixed(1);
                return ' $' + val.toLocaleString() + '  (' + pct + '%)';
              }
            }
          }
        }
      },
      plugins: [{
        id: 'outsideLabels',
        afterDraw(chart) {
          const { ctx, data: d, chartArea: { width, height } } = chart;
          const meta = chart.getDatasetMeta(0);
          const cx = meta.data[0] ? meta.data[0].x : width / 2;
          const cy = meta.data[0] ? meta.data[0].y : height / 2;

          meta.data.forEach((arc, i) => {
            const val = d.datasets[0].data[i];
            const pct = (val / total * 100);
            const angle = (arc.startAngle + arc.endAngle) / 2;
            const outerR = arc.outerRadius;

            // Line start (just outside slice)
            const x1 = cx + Math.cos(angle) * (outerR + 6);
            const y1 = cy + Math.sin(angle) * (outerR + 6);
            // Line elbow
            const x2 = cx + Math.cos(angle) * (outerR + 22);
            const y2 = cy + Math.sin(angle) * (outerR + 22);
            // Label anchor
            const labelX = cx + Math.cos(angle) * (outerR + 28);
            const labelY = cy + Math.sin(angle) * (outerR + 28);
            const align = labelX < cx ? 'right' : 'left';

            // Short name — strip account number
            const shortLabel = d.labels[i].replace(/\s*\(\d+\)/, '');
            const valueStr = '$' + (val / 1000).toFixed(0) + 'k (' + pct.toFixed(1) + '%)';

            ctx.save();

            // Leader line
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = COLORS[i];
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label text
            ctx.textAlign = align;
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(255,255,255,0.8)';
            ctx.shadowBlur = 3;

            ctx.fillStyle = '#222';
            ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
            ctx.fillText(shortLabel, labelX, labelY - 7);

            ctx.fillStyle = '#555';
            ctx.font = '10px "Segoe UI", system-ui, sans-serif';
            ctx.fillText(valueStr, labelX, labelY + 7);

            ctx.restore();
          });
        }
      }]
    });
  }

  // ── Chart 2: Transfer trend line ─────────────────────────────────────────────

  function renderTransferChart() {
    const el = document.getElementById('transfer-chart');
    if (!el) return;

    // Source: LPC Student Characteristics reports (Educational Goal: Transfer with/without AA/AS)
    // Each term shows students with a transfer goal; Fall figures are the main census headcount
    const labels = ['Sum 2022', 'Fall 2022', 'Spr 2023', 'Sum 2023', 'Fall 2023', 'Spr 2024', 'Sum 2024'];
    const transferGoal = [2263, 4518, 4221, 2599, 4875, 4731, 2741];
    const headcount    = [3561, 6825, 6618, 3959, 7605, 7502, 4103];
    const pct = transferGoal.map((v, i) => Math.round(v / headcount[i] * 100));

    new Chart(el, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Students with Transfer Goal',
            data: transferGoal,
            borderColor: GOLD,
            backgroundColor: 'rgba(240,192,64,0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: GOLD,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.35,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: '% of Headcount',
            data: pct,
            borderColor: '#50b8e0',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 4],
            pointBackgroundColor: '#50b8e0',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.35,
            yAxisID: 'y2'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { left: 10, right: 10, top: 20, bottom: 10 } },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#444', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            beginAtZero: false,
            ticks: { color: '#444', callback: v => v.toLocaleString() },
            title: { display: true, text: 'Students', color: '#444' }
          },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false },
            min: 50, max: 80,
            title: { display: true, text: '% of Headcount', color: '#2288bb' },
            ticks: { color: '#2288bb', callback: v => v + '%' }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#333', padding: 20, boxWidth: 24, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: ctx => ctx.datasetIndex === 0
                ? ' ' + ctx.parsed.y.toLocaleString() + ' students'
                : ' ' + ctx.parsed.y + '% of headcount'
            }
          }
        }
      }
    });
  }

  // ── Chart 3: Top majors by headcount Fall 2024 (horizontal bar) ───────────────

  function renderMajorChart() {
    const el = document.getElementById('major-chart');
    if (!el) return;

    // Source: Students_Majors_F20-F24_F.pdf — Fall 2024 headcounts aggregated by CIP Family
    // Totals computed by summing all programs within each CIP family for Fall 2024
    const majors = [
      'Business & Management',
      'Computer & Info Sciences',
      'Health Professions',
      'Engineering',
      'Biological Sciences',
      'Liberal Arts & Sciences',
      'Visual & Performing Arts',
      'Family & Consumer Sciences',
      'Communication & Journalism',
      'Mathematics'
    ];
    const counts = [1261, 837, 588, 461, 591, 410, 446, 361, 128, 71];

    new Chart(el, {
      type: 'bar',
      data: {
        labels: majors,
        datasets: [{
          label: 'Students (Fall 2024)',
          data: counts,
          backgroundColor: COLORS,
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            beginAtZero: true,
            ticks: { color: '#444' }
          },
          y: { grid: { display: false }, ticks: { color: '#444' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' ' + ctx.parsed.x.toLocaleString() + ' students'
            }
          }
        }
      }
    });
  }

})();