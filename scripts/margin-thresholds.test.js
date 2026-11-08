import test from 'node:test';
import assert from 'node:assert/strict';
import { marginStatus } from '../src/scripts/core/margin-thresholds.js';
import { createEmptyBudget } from '../src/scripts/core/period-model.js';
import { normalizeImport,validateData } from '../src/scripts/core/storage.js';

test('seuils de marge : limites, priorité aux négatifs et intervalle neutre',()=>{
  for(const [amount,status] of [[-1,'negative'],[0,'warning'],[50,'warning'],[50.01,'neutral'],[99.99,'neutral'],[100,'positive']])assert.equal(marginStatus(amount,{}),status);
});
test('seuils personnalisés : validation et conservation à l’import/export',()=>{
  const data=createEmptyBudget();data.marginThresholds={warning:75,positive:150};
  assert.equal(marginStatus(75,data),'warning');assert.equal(marginStatus(150,data),'positive');
  assert.deepEqual(normalizeImport(JSON.parse(JSON.stringify(data))),data);
  data.marginThresholds.positive=75;assert.throws(()=>validateData(data),/seuil vert/);
});
