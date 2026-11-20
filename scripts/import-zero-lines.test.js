import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetDemo } from '../src/scripts/core/period-model.js';
import { readImport } from '../src/scripts/core/storage.js';

test('import : supprime les lignes sans montant, conserve le réel et les financements',async()=>{
  const data=createBudgetDemo(),period=data.periods[0];
  const salary=period.incomes[0];
  period.incomes.push({...salary,id:'bonus-zero',name:'Prime',plannedAmount:0,realAmount:null});
  period.incomes.push({...salary,id:'bonus-paid',plannedAmount:0,realAmount:100});
  salary.plannedAmount=0;salary.realAmount=0;
  period.expenses.push({...period.expenses[0],id:'expense-zero',plannedAmount:0,realAmount:0});
  period.expenses.push({...period.expenses[0],id:'expense-paid',plannedAmount:0,realAmount:50});
  const original=JSON.stringify(data);
  const imported=await readImport({name:'budget.json',size:original.length,text:async()=>original});
  assert.ok(!imported.periods[0].incomes.some(item=>item.id==='bonus-zero'));
  assert.ok(imported.periods[0].incomes.some(item=>item.id==='bonus-paid'));
  assert.ok(imported.periods[0].incomes.some(item=>item.id===salary.id));
  assert.ok(!imported.periods[0].expenses.some(item=>item.id==='expense-zero'));
  assert.ok(imported.periods[0].expenses.some(item=>item.id==='expense-paid'));
  assert.equal(JSON.stringify(data),original);
});
