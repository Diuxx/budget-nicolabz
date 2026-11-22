import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData, monthlyBudget, blankYearBalances } from '../src/scripts/core/model.js';
import { normalizeImport as normalizeLegacy, validateData as validateLegacy } from '../src/scripts/core/legacy-storage.js';
import { getPeriod, periodTotals } from '../src/scripts/core/period-model.js';
import { normalizeImport } from '../src/scripts/core/storage.js';

function mockOldBackup() {
  const demo=createDemoData();
  return {version:1,settings:{salaryTarget:3200,pelMinimum:200,livretTarget:350,peaTarget:150,loanPayment:205,minMargin:300,loanAmount:4600,loanMonths:24},years:demo.years,
    n26:{'2026':{expenses:Array(12).fill(40),details:[]},'2027':{expenses:Array(12).fill(null),details:[]}},
    gear:{motorcyclePrice:4000,items:[{selected:true,price:200,quantity:2}]}};
}

test('migration v1 : comptes, budget et projets repris',()=>{
  const old=mockOldBackup();const data=normalizeLegacy(old);
  assert.equal(data.version,3);
  assert.equal(data.accounts[0].name,'N26');
  assert.deepEqual(data.accounts[0].balances['2026'],blankYearBalances());
  assert.equal(data.accounts[0].legacyExpenses['2026'].expenses[0],40);
  assert.equal(data.projects[0].target,4400);
});

test('migration : figer les cellules liées sans changer les prévisions',()=>{
  const old=mockOldBackup();old.version=2;old.accounts=[];old.projects=[];old.transactions=[];
  const line=old.years['2026'].lines[0];line.links={'9':'salaryTarget'};old.settings.salaryTarget=4100;
  const before=monthlyBudget(old,'2026',9).cashflow;
  const data=normalizeLegacy(old);
  assert.equal(monthlyBudget(data,'2026',9).cashflow,before);
  assert.equal(data.years['2026'].lines[0].amounts[9],4100);
  assert.deepEqual(data.years['2026'].lines[0].links,{});
  assert.deepEqual(data.settings,{});
  assert.equal(data.legacySettings.loanAmount,4600);
  assert.deepEqual(data.years['2027'].minMargins,Array(12).fill(300));
  assert.equal(old.version,2);assert.equal(line.links['9'],'salaryTarget');
  assert.deepEqual(normalizeLegacy(data),data);
});

test('sauvegarde historique valide et montants corrompus rejetés',()=>{
  const data=createDemoData();assert.doesNotThrow(()=>validateLegacy(data));
  data.years['2026'].lines[0].amounts=[1,2];
  assert.throws(()=>validateLegacy(data),/12 montants/);
});

test('transactions historiques reliées à un compte inexistant rejetées',()=>{
  const data=createDemoData();data.transactions[0].accountId='inconnu';
  assert.throws(()=>validateLegacy(data),/Compte de transaction inconnu/);
});

test('dates historiques impossibles rejetées',()=>{
  const data=createDemoData();data.transactions[0].date='2026-02-31';
  assert.throws(()=>validateLegacy(data),/Date de transaction invalide/);
});

test('migration des anciennes prévisions sans invention de réel ni double comptage des transactions',()=>{
  const old=createDemoData();old.years['2026'].lines[0].amounts[0]=3500;
  const before=structuredClone(old),data=normalizeImport(old),p=getPeriod(data,'2026-01');
  assert.equal(data.version,1);assert.deepEqual(old,before);
  assert.equal(periodTotals(data,p).planned.margin,monthlyBudget(old,'2026',0).cashflow);
  assert.ok([...p.incomes,...p.expenses].every(item=>item.realAmount===null));
  assert.deepEqual(data.legacyTransactions,old.transactions);assert.deepEqual(data.projects,old.projects);
  assert.deepEqual(data.accounts.find(a=>a.id==='demo-a1').balances,old.accounts[0].balances);
  assert.deepEqual(normalizeImport(JSON.parse(JSON.stringify(data))),data);
});

test('mois vides ignorés pendant la migration, seuils et montants négatifs préservés',()=>{
  const old=createDemoData();for(const line of old.years['2027'].lines)line.amounts=Array(12).fill(null);
  old.years['2026'].lines[0].amounts[0]=-100;old.years['2026'].lines[8].amounts[0]=-20;
  const data=normalizeImport(old);assert.equal(getPeriod(data,'2027-01'),undefined);
  assert.equal(periodTotals(data,getPeriod(data,'2026-01')).planned.margin,monthlyBudget(old,'2026',0).cashflow);
});
