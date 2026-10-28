import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { incomeExpenseLineChart } from '../src/scripts/ui/income-expense-chart.js';

const year = (income = 3200, expenses = 1450) =>
  Array.from({ length: 12 }, () => ({ income, expenses }));

test('Deux séries et six points de chaque couleur sur la fenêtre glissante', () => {
  const html = incomeExpenseLineChart(year(), 9);
  assert.match(html, /preserveAspectRatio="xMidYMid meet"/);
  assert.equal((html.match(/class="income-expense-line income-series"/g) ?? []).length, 1);
  assert.equal((html.match(/class="income-expense-line expense-series"/g) ?? []).length, 1);
  assert.equal((html.match(/class="income-expense-point income-series"/g) ?? []).length, 6);
  assert.equal((html.match(/class="income-expense-point expense-series"/g) ?? []).length, 6);
  assert.match(html, /Mai : revenus/);
  assert.match(html, /Octobre : revenus/);
  assert.doesNotMatch(html, /Janvier : revenus/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('Le graphique fonctionne avec le premier mois, valeurs nulles et montants négatifs', () => {
  for (const [income, expenses] of [[0, 0], [-250, -100], [450, 450]]) {
    const html = incomeExpenseLineChart(year(income, expenses), 0);
    assert.equal((html.match(/class="income-expense-point income-series"/g) ?? []).length, 1);
    assert.equal((html.match(/class="income-expense-point expense-series"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('Les entrées incomplètes ou invalides sont rejetées', () => {
  assert.throws(() => incomeExpenseLineChart(year().slice(0, 3), 2), /douze mois/);
  assert.throws(() => incomeExpenseLineChart(year(), 12), /mois sélectionné/);
  assert.throws(() => incomeExpenseLineChart(year('abc', 200), 7), /nombres valides/);
});

test('Les options sélectionnées ont un fond sombre et un texte clair', () => {
  const css = readFileSync(new URL('../src/styles/compact.css', import.meta.url), 'utf8');
  assert.match(css, /wa-option:state\(selected\)/);
  assert.match(css, /--wa-form-control-activated-color:\s*#30473b/);
  assert.match(css, /--current-text-color:\s*#f0f2ed/);
  assert.match(css, /background-color:\s*#30473b/);
  assert.match(css, /income-expense-chart svg[^{]*\{[^}]*height:\s*151px/);
});
