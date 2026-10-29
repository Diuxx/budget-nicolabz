import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const css = readFileSync(new URL('../src/styles/period-budget.css', import.meta.url), 'utf8');

function styleFor(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Sélecteur absent : ${selector}`);
  const bodyStart = css.indexOf('{', start);
  return css.slice(bodyStart + 1, css.indexOf('}', bodyStart));
}

test('les indicateurs annuels sont séparés verticalement du graphique', () => {
  const rules = styleFor('.period-metrics');
  assert.match(rules, /display:\s*grid;/);
  assert.match(rules, /gap:\s*var\(--card-gap\);/);
  assert.match(rules, /margin-bottom:\s*var\(--card-gap\);/);
});

test('les cartes ne peuvent pas élargir leur piste de grille', () => {
  assert.match(styleFor('.period-metric'), /min-width:\s*0;/);
});
