import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetDemo } from '../src/scripts/core/period-model.js';
import { normalizeImport, readImport, validateData } from '../src/scripts/core/storage.js';

test('Pécule v1 : aller-retour JSON sans perte, y compris les financements',async()=>{
  const data=createBudgetDemo();
  const imported=await readImport({name:'budget.json',size:1000,text:async()=>JSON.stringify(data)});
  assert.equal(imported.version,1);
  assert.deepEqual(imported,data);
  assert.deepEqual(normalizeImport(imported),data);
});

test('un projet de type crédit est conservé dans les sauvegardes',async()=>{
  const data=createBudgetDemo();
  data.projects.push({id:'credit-auto',name:'Crédit auto',description:'',type:'credit',target:12500,saved:0});
  data.periods[0].expenses.push({...data.periods[0].expenses[0],id:'payment',type:'credit',projectId:'credit-auto'});
  const imported=await readImport({name:'budget.json',size:1000,text:async()=>JSON.stringify(data)});
  assert.deepEqual(imported,data);
  assert.deepEqual(normalizeImport(imported),data);
});

test('les exports v4 sont convertis en v1 sans modifier la source',()=>{
  const old={...createBudgetDemo(),version:4};
  const converted=normalizeImport(old);
  assert.equal(converted.version,1);
  assert.deepEqual(converted.periods,old.periods);
  assert.equal(old.version,4);
  assert.throws(()=>validateData(old));
});
