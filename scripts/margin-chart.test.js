import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { marginLineChart } from '../src/scripts/ui/margin-chart.js';

const testMonths = values => values.map(cashflow => ({ cashflow }));

test('La courbe affiche douze points, une ligne et le repère zéro sans objectif minimal', () => {
  const html = marginLineChart(testMonths([100, 200, 380, 450, 300, 600, 700, 90, 10, -100, -200, 350]));
  assert.equal((html.match(/class="margin-point /g) || []).length, 12);
  assert.match(html, /<polyline class="margin-path"/);
  assert.doesNotMatch(html, /margin-threshold-line|Marge minimale|seuil/);
  assert.match(html, /margin-zero-line/);
  assert.match(html, /Janvier : 100,00/);
  assert.match(html, /Décembre : 350,00/);
  assert.match(html, /class="margin-point negative"/);
  assert.match(html, /class="margin-point positive"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('L’échelle reste valide pour douze marges identiques', () => {
  for (const value of [0, -120, 340]) {
    const html = marginLineChart(testMonths(Array(12).fill(value)));
    assert.equal((html.match(/class="margin-point /g) || []).length, 12);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('Un nombre de mois incorrect ou une marge non numérique est rejeté', () => {
  assert.throws(() => marginLineChart(testMonths([100])), /douze mois/);
  assert.throws(() => marginLineChart(testMonths(Array(12).fill('erreur'))), /nombre valide/);
});

test('Le halo Web Awesome est désactivé pour les champs, pas pour les boutons', () => {
  const css = readFileSync(new URL('../src/styles/webawesome.css', import.meta.url), 'utf8');
  const native = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');
  assert.match(css, /wa-input, wa-select, wa-textarea\s*\{\s*--wa-focus-ring: none;/);
  assert.match(css, /wa-select:focus-within::part\(combobox\)/);
  assert.match(css, /--wa-color-focus: #acd0b8/);
  assert.match(native, /button:focus-visible,a:focus-visible\{outline:2px solid var\(--sage\)/);
});

test('Les anciennes valeurs de seuil ne modifient ni la courbe ni les infobulles',()=>{
  const months=testMonths(Array(12).fill(500));
  const original=marginLineChart(months);
  months.forEach((month,index)=>{month.threshold=index%2?9000:0;});
  assert.equal(marginLineChart(months),original);
  assert.doesNotMatch(original,/seuil|minimum|objectif/i);
});
