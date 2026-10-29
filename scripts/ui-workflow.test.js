import test from 'node:test';import assert from 'node:assert/strict';
import {environment} from './ui-test-env.js';
import {shiftPeriod} from '../src/scripts/core/period-model.js';

test('parcours mensuel : copie, saisie prévu/réel, financement et sauvegarde',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?workflow-refactor');
  const date=env.saved().periods[0].date;
  env.action('next-month');assert.equal(env.saved().periods.length,1);
  env.action('create-period');let next=env.saved().periods.find(p=>p.date===shiftPeriod(date,1));
  assert.ok(next);assert.equal(next.incomes[0].realAmount,null);assert.equal(next.incomes[0].plannedAmount,3200);
  env.action('add-expense');
  Object.assign(env.controls.name,{value:'Test dépense'});env.controls.plannedAmount.value='100';env.controls.realAmount.value='0';env.controls.incomeId.value=next.incomes[0].id;
  env.submit();next=env.saved().periods.find(p=>p.date===shiftPeriod(date,1));
  assert.equal(next.expenses.at(-1).realAmount,0);assert.equal(next.expenses.at(-1).plannedAmount,100);assert.equal(next.expenses.at(-1).accountId,'main');
  env.action('edit-expense',next.expenses.at(-1).id);env.controls.plannedAmount.value='-5';env.submit();
  assert.equal(env.saved().periods.at(-1).expenses.at(-1).plannedAmount,100);
  env.controls.plannedAmount.value='150';env.submit();assert.equal(env.saved().periods.at(-1).expenses.at(-1).plannedAmount,150);
  assert.equal(Object.hasOwn(env.saved().periods.at(-1),'minMargin'),false);
  env.action('delete-income',next.incomes[0].id);assert.ok(env.toast.textContent.includes('finance encore'));
  env.action('prev-month');assert.equal(env.saved().periods[0].incomes[0].plannedAmount,3200);
});
test('un revenu transféré conserve ses liens et refuse les cycles',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?transfer-workflow');
  env.action('edit-income','demo-salary');env.controls.deductedFromIncomeId.value='demo-savings';env.submit();
  assert.ok(env.toast.textContent.includes('circulaire'));assert.equal(env.saved().periods[0].incomes[0].deductedFromIncomeId,null);
  env.controls.deductedFromIncomeId.value='';env.controls.plannedAmount.value='3600';env.submit();
  assert.equal(env.saved().periods[0].incomes[0].plannedAmount,3600);
});
test('filtre Todo par origine de financement et présente les cumuls annuels sans changer les données',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?funding-filter-workflow');
  assert.match(env.main.innerHTML,/Filtrer par compte ou revenu/);
  assert.match(env.main.innerHTML,/Épargne annuelle par type/);
  assert.match(env.main.innerHTML,/income:demo-salary/);
  const before=env.saved();
  env.change({id:'fundingFilter',value:'income:demo-salary'});
  assert.match(env.main.innerHTML,/Source de financement sélectionnée/);
  assert.match(env.main.innerHTML,/Loyer/);
  assert.ok(!env.main.innerHTML.includes('demo-expense-999'));
  assert.deepEqual(env.saved(),before);
});

test('pointage limité aux montants et note, sans modification des autres informations',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?record-minimal');
  for(const [kind,collection,id] of [['income','incomes','demo-savings'],['expense','expenses','demo-expense-1']]){
    const before=env.saved().periods[0][collection].find(item=>item.id===id);
    env.action('record-'+kind,id);
    const names=Array.from(env.dialog.html.matchAll(/name="([^"]+)"/g),match=>match[1]);
    assert.deepEqual(names,['plannedAmount','realAmount','note']);
    assert.equal(Number(env.controls.realAmount.value),before.plannedAmount);
    env.controls.realAmount.value='0';env.controls.note.value='À vérifier';env.submit();
    assert.equal(env.dialog.open,false);
    const after=env.saved().periods[0][collection].find(item=>item.id===id);
    assert.deepEqual(after,{...before,realAmount:0,note:'À vérifier'});
    env.action('edit-'+kind,id);
    assert.match(env.dialog.html,/name="accountId"/);
    assert.equal(env.controls.note.value,'À vérifier');
  }
});

test('ouvrir un mois depuis les analyses mémorise la période et réinitialise le filtre',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?open-period-review');
  const source=env.saved().periods[0].date;
  env.action('next-month');env.action('create-period');env.action('prev-month');
  env.change({id:'fundingFilter',value:'income:demo-salary'});
  const target=shiftPeriod(source,1),before=env.saved();
  env.action('open-period',undefined,{period:target});
  assert.equal(env.values.get('marge:selected-period'),target);
  assert.equal(location.hash,'budget');
  assert.match(env.main.innerHTML,/Loyer/);
  assert.deepEqual(env.saved(),before);
  env.action('open-period',undefined,{period:'invalide'});
  assert.equal(env.values.get('marge:selected-period'),target);
  assert.match(env.toast.textContent,/Période invalide/);
});
