import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = ['app','components','budget-presentation','budget-views','management-views','form-dialog'].map(name => readFileSync(new URL(`../src/scripts/ui/${name}.js`, import.meta.url), 'utf8')).join('\n');
const layout = readFileSync(new URL('../_includes/layouts/base.njk', import.meta.url), 'utf8');
const header = readFileSync(new URL('../_includes/components/header.njk', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/compact.css', import.meta.url), 'utf8');

test('Les périodes et les listes déroulantes utilisent wa-select et wa-option', () => {
  assert.match(ui, /<wa-select id="monthSelect"/);
  assert.match(ui, /<wa-select id="yearSelect"/);
  assert.match(ui, /field\.type==='select'.*<wa-select/);
  assert.doesNotMatch(ui, /<select\b/);
});

test('La saisie, les actions et les fenêtres utilisent Web Awesome', () => {
  assert.match(ui, /<wa-input class="form-control"/);
  assert.match(ui, /<wa-textarea class="form-control"/);
  assert.doesNotMatch(ui, /class="form-control margin-control"|data-field="min-margin"/);
  assert.match(ui, /<wa-button id="action-/);
  assert.match(layout, /<wa-dialog id="modal"/);
  assert.match(layout, /<wa-dialog id="syncChoiceDialog"/);
  assert.match(header, /<wa-button type="button" appearance="plain"/);
});

test('Les styles compacts gardent les points de rupture tablette et mobile', () => {
  assert.match(layout, /styles\/compact\.css/);
  assert.match(styles, /max-width: 1190px/);
  assert.match(styles, /max-width: 880px/);
  assert.match(styles, /max-width: 590px/);
  assert.match(styles, /\.dashboard-grid \{/);
});
