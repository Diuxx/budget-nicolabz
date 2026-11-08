import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetDemo } from '../src/scripts/core/period-model.js';
import { normalizeImport, readImport, validateData, loadData } from '../src/scripts/core/storage.js';

test('Pécule v1 : aller-retour JSON sans perte, y compris les financements',async()=>{
  const data=createBudgetDemo();
  const imported=await readImport({name:'budget.json',size:1000,text:async()=>JSON.stringify(data)});
  assert.equal(imported.version,1);
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

test('une sauvegarde locale v4 est conservée et copiée au format courant',()=>{
  const old=JSON.stringify({...createBudgetDemo(),version:4});
  const values=new Map([['marge:budget:v4',old]]);
  const previous=globalThis.localStorage;
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    assert.equal(loadData().version,1);
    assert.equal(values.get('marge:budget:v4'),old);
    assert.equal(JSON.parse(values.get('pecule:budget:v1')).version,1);
    assert.deepEqual(loadData(),JSON.parse(values.get('pecule:budget:v1')));
  }finally{globalThis.localStorage=previous;}
});
