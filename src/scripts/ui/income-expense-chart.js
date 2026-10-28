import { MONTHS, euro, shortEuro } from '../core/model.js';

// Le tracé SVG reste indépendant du DOM et des données enregistrées.
const SIZE = Object.freeze({ width: 760, height: 210, left: 88, right: 22, top: 16, bottom: 32 });
const coordinate = value => Number(value.toFixed(2));

function readableStep(maximum) {
  const target = Math.max(maximum / 4, 1);
  const exponent = 10 ** Math.floor(Math.log10(target));
  const mantissa = target / exponent;
  return (mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10) * exponent;
}

function chartCoordinates(records) {
  const maxValue = Math.max(0, ...records.flatMap(record => [record.income, record.expenses]));
  const minValue = Math.min(0, ...records.flatMap(record => [record.income, record.expenses]));
  const step = readableStep(Math.max(maxValue - minValue, 1));
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const min = Math.min(0, Math.floor(minValue / step) * step);
  const plotWidth = SIZE.width - SIZE.left - SIZE.right;
  const plotHeight = SIZE.height - SIZE.top - SIZE.bottom;
  const y = value => SIZE.top + ((max - value) / (max - min)) * plotHeight;
  const x = index => SIZE.left + (records.length === 1 ? plotWidth / 2 : index * plotWidth / (records.length - 1));
  return { y, x, min, max, step };
}

function drawSeries(records, coordinates, key, className, startMonth) {
  const points = records.map((record, index) => ({
    month: MONTHS[startMonth + index],
    amount: record[key],
    x: coordinate(coordinates.x(index)),
    y: coordinate(coordinates.y(record[key])),
  }));

  const line = `<polyline class="income-expense-line ${className}" points="${points.map(point => `${point.x},${point.y}`).join(' ')}" />`;
  const markers = points.map(point => `<circle class="income-expense-point ${className}" cx="${point.x}" cy="${point.y}" r="4.3" tabindex="0" aria-label="${point.month} : ${euro(point.amount)}"><title>${point.month} : ${euro(point.amount)}</title></circle>`).join('');
  return line + markers;
}

/** Graphique de comparaison prévu sur la période finissant au mois choisi. */
export function incomeExpenseLineChart(months, selectedMonth) {
  if (!Array.isArray(months) || months.length !== 12) {
    throw new Error('Le graphique revenus / dépenses attend douze mois de données.');
  }
  if (!Number.isInteger(selectedMonth) || selectedMonth < 0 || selectedMonth > 11) {
    throw new Error('Le mois sélectionné est invalide.');
  }
  const startMonth = Math.max(0, selectedMonth - 5);
  const records = months.slice(startMonth, selectedMonth + 1).map(({ income, expenses }) => {
    if (!Number.isFinite(income) || !Number.isFinite(expenses)) {
      throw new Error('Les revenus et dépenses doivent être des nombres valides.');
    }
    return { income, expenses };
  });
  const coordinates = chartCoordinates(records);
  const gridTicks = [];
  for (let value = coordinates.min; value <= coordinates.max + coordinates.step * .01; value += coordinates.step) {
    gridTicks.push(value);
  }
  const grid = gridTicks.map(value => `<line class="income-expense-grid${value === 0 ? ' income-expense-zero' : ''}" x1="${SIZE.left}" x2="${SIZE.width - SIZE.right}" y1="${coordinate(coordinates.y(value))}" y2="${coordinate(coordinates.y(value))}" /><text class="income-expense-axis" x="${SIZE.left - 13}" y="${coordinate(coordinates.y(value) + 4)}" text-anchor="end">${shortEuro(value)}</text>`).join('');
  const labels = records.map((_, index) => `<text class="income-expense-axis" x="${coordinate(coordinates.x(index))}" y="${SIZE.height - 9}" text-anchor="middle">${MONTHS[startMonth + index].slice(0, 3)}</text>`).join('');
  const incomeSeries = drawSeries(records, coordinates, 'income', 'income-series', startMonth);
  const expenseSeries = drawSeries(records, coordinates, 'expenses', 'expense-series', startMonth);
  const description = records.map((item, i) => `${MONTHS[startMonth + i]} : revenus ${euro(item.income)}, dépenses ${euro(item.expenses)}`).join(' ; ');

  return `<div class="chart-wrap income-expense-chart"><svg viewBox="0 0 ${SIZE.width} ${SIZE.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="income-expense-title income-expense-description">
    <title id="income-expense-title">Revenus et dépenses par mois</title>
    <desc id="income-expense-description">${description}</desc>
    ${grid}
    ${incomeSeries}
    ${expenseSeries}
    ${labels}
  </svg></div>`;
}
