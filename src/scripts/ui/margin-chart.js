import { MONTHS, euro, shortEuro } from '../core/model.js';

const CHART = Object.freeze({
  width: 560,
  height: 250,
  left: 60,
  right: 14,
  top: 15,
  bottom: 37,
});

function niceStep(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

function chartScale(values) {
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const step = niceStep(Math.max((maximum - minimum) / 4, 1));
  const lower = Math.floor((minimum - step * 0.2) / step) * step;
  const upper = Math.ceil((maximum + step * 0.2) / step) * step;

  return {
    lower,
    upper,
    ticks: Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, i) => lower + i * step),
  };
}

function pointCoordinates(values, scale) {
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const y = value => CHART.top + (scale.upper - value) / (scale.upper - scale.lower) * plotHeight;

  return {
    y,
    points: values.map((value, index) => ({
      value,
      x: CHART.left + index * plotWidth / (values.length - 1),
      y: y(value),
    })),
  };
}

const position = value => Number(value.toFixed(2));

/** Graphe SVG sans dépendance : rendu dérivé des prévisions, jamais de données persistées. */
export function marginLineChart(months) {
  if (!Array.isArray(months) || months.length !== MONTHS.length) {
    throw new Error('Le graphique de marge attend les douze mois de l’année.');
  }

  const values = months.map(month => {
    const value = Number(month.cashflow);
    if (!Number.isFinite(value)) throw new Error('La marge mensuelle doit être un nombre valide.');
    return value;
  });
  const scale = chartScale(values);
  const { y, points } = pointCoordinates(values, scale);
  const bottom = CHART.height - CHART.bottom;
  const right = CHART.width - CHART.right;
  const linePoints = points.map(point => `${position(point.x)},${position(point.y)}`).join(' ');
  const areaPoints = `${CHART.left},${bottom} ${linePoints} ${right},${bottom}`;
  const grid = scale.ticks.map(tick => `
    <line class="margin-grid-line${tick === 0 ? ' margin-zero-line' : ''}" x1="${CHART.left}" x2="${right}" y1="${position(y(tick))}" y2="${position(y(tick))}" />
    <text class="chart-text" x="${CHART.left - 10}" y="${position(y(tick) + 4)}" text-anchor="end">${shortEuro(tick)}</text>
  `).join('');
  const labels = points.map((point, index) => `
    <text class="chart-text" x="${position(point.x)}" y="${CHART.height - 10}" text-anchor="middle">${MONTHS[index].slice(0, 3)}</text>
  `).join('');
  const markers = points.map((point, index) => {
    const status = point.value < 0 ? 'negative' : 'positive';
    const label = `${MONTHS[index]} : ${euro(point.value)}`;
    return `<circle class="margin-point ${status}" cx="${position(point.x)}" cy="${position(point.y)}" r="4.6" tabindex="0" aria-label="${label}"><title>${label}</title></circle>`;
  }).join('');

  return `<div class="chart-wrap margin-chart">
    <svg viewBox="0 0 ${CHART.width} ${CHART.height}" role="img" aria-labelledby="margin-chart-title margin-chart-description">
      <title id="margin-chart-title">Évolution de la marge mensuelle</title>
      <desc id="margin-chart-description">Reste disponible prévisionnel de janvier à décembre. ${points.map((point, index) => `${MONTHS[index]} : ${euro(point.value)}`).join(' ; ')}.</desc>
      <defs><linearGradient id="margin-area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#acd0b8" stop-opacity=".19"/><stop offset="100%" stop-color="#acd0b8" stop-opacity="0"/></linearGradient></defs>
      ${grid}
      <polygon class="margin-area" points="${areaPoints}" />
      <polyline class="margin-path" points="${linePoints}" />
      ${markers}
      ${labels}
    </svg>
    <div class="margin-chart-legend"><span><i class="margin-legend-line"></i>Marge mensuelle</span></div>
  </div>`;
}
