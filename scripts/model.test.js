import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData, monthlyBudget, annualBudget, migrateLegacyData, spendingBreakdown, projectProgress, dailyActivity, blankYearBalances } from '../src/scripts/core/model.js';
import { validateData, normalizeImport } from '../src/scripts/core/storage.js';

function mockOldBackup() {
  const demo=createDemoData();
  return {version:1,settings:demo.settings,years:demo.years,
    n26:{'2026':{expenses:Array(12).fill(40),details:[]},'2027':{expenses:Array(12).fill(null),details:[]}},
    gear:{motorcyclePrice:4000,items:[{selected:true,price:200,quantity:2}]}};
}

test('budget mensuel : les postes sont déduits une seule fois',()=>{
  const data=createDemoData();const month=monthlyBudget(data,'2026',9);
  assert.equal(month.income,3200);
  assert.equal(month.expenses,1745);
  assert.equal(month.savings,850);
  assert.equal(month.cashflow,605);
});
test('les douze mois se regroupent correctement',()=>{
  const summary=annualBudget(createDemoData(),'2026');
  assert.equal(summary.income,38400);
  assert.equal(summary.cashflow,7285);
  assert.equal(summary.wealthSavings,8400);
});
test('migration v1 : comptes, budget et projets repris',()=>{
  const old=mockOldBackup();const data=normalizeImport(old);
  assert.equal(data.version,2);
  assert.equal(data.accounts[0].name,'N26');
  assert.deepEqual(data.accounts[0].balances['2026'],blankYearBalances());
  assert.equal(data.accounts[0].legacyExpenses['2026'].expenses[0],40);
  assert.equal(data.projects[0].target,4400);
});
test('modifier un projet ou compte ne crée pas de double déduction',()=>{
  const data=normalizeImport(mockOldBackup());
  const before=monthlyBudget(data,'2026',9).cashflow;
  data.projects[0].saved=2000;
  data.accounts[0].balances['2026'][9]=150;
  data.accounts[0].legacyExpenses['2026'].expenses[9]=120;
  assert.equal(monthlyBudget(data,'2026',9).cashflow,before);
});
test('liaison de salaire : les paramètres recalculent les prévisions',()=>{
  const data=createDemoData();
  const salary=data.years['2026'].lines.find(line=>line.label==='Salaire');
  salary.links={'9':'salaryTarget'};
  const before=monthlyBudget(data,'2026',9).cashflow;
  data.settings.salaryTarget+=100;
  assert.equal(monthlyBudget(data,'2026',9).cashflow,before+100);
});
test('répartition des dépenses sans l’épargne',()=>{
  const data=createDemoData();
  assert.equal(spendingBreakdown(data,'2026',9).reduce((n,r)=>n+r.value,0),1745);
});
test('transactions datées et progression des projets',()=>{
  const data=createDemoData();
  assert.equal(dailyActivity(data.transactions,'2026',9).reduce((a,b)=>a+b,0),8);
  assert.equal(projectProgress({target:400,saved:100}),0.25);
  assert.equal(projectProgress({target:400,saved:500}),1);
});
test('sauvegarde valide et montants corrompus rejetés',()=>{
  const data=createDemoData();assert.doesNotThrow(()=>validateData(data));
  data.years['2026'].lines[0].amounts=[1,2];
  assert.throws(()=>validateData(data),/12 montants/);
});
test('transactions reliées à un compte inexistant rejetées',()=>{
  const data=createDemoData();data.transactions[0].accountId='inconnu';
  assert.throws(()=>validateData(data),/Compte de transaction inconnu/);
});
test('dates impossibles rejetées',()=>{
  const data=createDemoData();data.transactions[0].date='2026-02-31';
  assert.throws(()=>validateData(data),/Date de transaction invalide/);
});
