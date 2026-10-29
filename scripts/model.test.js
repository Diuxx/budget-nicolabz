import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData, monthlyBudget, annualBudget, migrateLegacyData, spendingBreakdown, projectProgress, dailyActivity, blankYearBalances, adjacentMonth, ensureBudgetYear, carryPreviousMonth } from '../src/scripts/core/model.js';
import { validateData, normalizeImport } from '../src/scripts/core/legacy-storage.js';

function mockOldBackup() {
  const demo=createDemoData();
  return {version:1,settings:{salaryTarget:3200,pelMinimum:200,livretTarget:350,peaTarget:150,loanPayment:205,minMargin:300,loanAmount:4600,loanMonths:24},years:demo.years,
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
  assert.equal(data.version,3);
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
test('migration : figer les cellules liées sans changer les prévisions',()=>{
  const old=mockOldBackup();old.version=2;old.accounts=[];old.projects=[];old.transactions=[];
  const line=old.years['2026'].lines[0];line.links={'9':'salaryTarget'};old.settings.salaryTarget=4100;
  const before=monthlyBudget(old,'2026',9).cashflow;
  const data=normalizeImport(old);
  assert.equal(monthlyBudget(data,'2026',9).cashflow,before);
  assert.equal(data.years['2026'].lines[0].amounts[9],4100);
  assert.deepEqual(data.years['2026'].lines[0].links,{});
  assert.deepEqual(data.settings,{});
  assert.equal(data.legacySettings.loanAmount,4600);
  assert.deepEqual(data.years['2027'].minMargins,Array(12).fill(300));
  assert.equal(old.version,2);assert.equal(line.links['9'],'salaryTarget');
  assert.deepEqual(normalizeImport(data),data);
});

test('les objectifs mensuels changent les alertes sans modifier le budget',()=>{
  const data=createDemoData();const before=monthlyBudget(data,'2026',0).cashflow;
  data.years['2026'].minMargins[0]=1000;data.years['2026'].minMargins[1]=0;
  assert.equal(monthlyBudget(data,'2026',0).threshold,1000);
  assert.equal(monthlyBudget(data,'2026',1).threshold,0);
  assert.equal(monthlyBudget(data,'2027',0).threshold,300);
  assert.equal(monthlyBudget(data,'2026',0).cashflow,before);
  assert.equal(annualBudget(data,'2026').belowThreshold,1);
  for(const value of [-1,NaN,null]){
    data.years['2026'].minMargins[0]=value;
    assert.throws(()=>validateData(data),/12 marges minimales/);
  }
});

test('un financement valide conserve ses conditions sans double déduction',()=>{
  const data=createDemoData(),before=monthlyBudget(data,'2026',0).cashflow;
  const project=data.projects[0];Object.assign(project,{type:'financing',loanAmount:3000,loanMonths:24,loanPayment:140});
  assert.doesNotThrow(()=>validateData(data));
  assert.equal(monthlyBudget(data,'2026',0).cashflow,before);
  for(const value of [0,-1,1.5,null]){project.loanMonths=value;assert.throws(()=>validateData(data),/Durée du prêt/);}
  project.loanMonths=24;project.loanAmount=-1;assert.throws(()=>validateData(data),/Montant du prêt/);
  project.loanAmount=3000;project.loanPayment=NaN;assert.throws(()=>validateData(data),/Mensualité/);
  project.type='unknown';assert.throws(()=>validateData(data),/Type de projet/);
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

test('navigation chronologique et nouvelles années sans prévisions inventées',()=>{
  assert.deepEqual(adjacentMonth('2027',11,1),{year:'2028',month:0});
  assert.deepEqual(adjacentMonth('2028',0,-1),{year:'2027',month:11});
  assert.deepEqual(adjacentMonth('2026',0,-1),{year:'2025',month:11});
  const data=createDemoData(),before=structuredClone(data);
  data.years['2027'].minMargins[11]=450;
  assert.equal(ensureBudgetYear(data,'2028','2027',11),true);
  assert.deepEqual(data.years['2028'].lines.map(l=>l.label),data.years['2027'].lines.map(l=>l.label));
  assert.ok(data.years['2028'].lines.every(l=>l.amounts.every(v=>v===null)));
  assert.deepEqual(data.years['2028'].minMargins,Array(12).fill(450));
  assert.ok(data.accounts.every(a=>a.balances['2028'].every(v=>v===null)));
  assert.deepEqual(data.years['2026'],before.years['2026']);
  assert.deepEqual(data.years['2027'].lines,before.years['2027'].lines);
  data.years['2028'].lines[0].amounts[0]=3600;
  assert.equal(ensureBudgetYear(data,'2028','2027',11),false);
  assert.equal(data.years['2028'].lines[0].amounts[0],3600);
  assert.deepEqual(normalizeImport(JSON.parse(JSON.stringify(data))),data);
  data.years['2028'].lines[0].amounts=[1];assert.throws(()=>validateData(data),/12 montants/);
});
test('validation des années supplémentaires et des soldes associés',()=>{
  const data=createDemoData();ensureBudgetYear(data,'2029','2027',11);
  data.accounts[0].balances['2029']=[0];assert.throws(()=>validateData(data),/Soldes 2029/);
  data.accounts[0].balances['2029']=Array(12).fill(null);
  delete data.years['2026'];delete data.years['2027'];
  assert.doesNotThrow(()=>validateData(data));
  data.years={};assert.throws(()=>validateData(data),/Exercices/);
});

test('reprise de décembre en janvier puis février, sans toucher aux autres mois ni aux soldes',()=>{
  const data=createDemoData();ensureBudgetYear(data,'2028','2027',11);
  const accounts=structuredClone(data.accounts),source=structuredClone(data.years['2027']);
  assert.equal(carryPreviousMonth(data,'2028',0),true);
  assert.deepEqual(data.years['2028'].lines.map(l=>l.amounts[0]),source.lines.map(l=>l.amounts[11]));
  assert.ok(data.years['2028'].lines.every(l=>l.amounts[1]===null));
  data.years['2028'].lines[0].amounts[0]=4000;
  assert.equal(carryPreviousMonth(data,'2028',1),true);
  assert.equal(data.years['2028'].lines[0].amounts[1],4000);
  assert.deepEqual(data.accounts,accounts);assert.deepEqual(data.years['2027'],source);
  for(const line of data.years['2028'].lines)line.amounts[1]=null;
  assert.equal(carryPreviousMonth(normalizeImport(data),'2028',1),false);
});
test('reprise : protéger les saisies partielles, les zéros et les mois sans source',()=>{
  const data=createDemoData();ensureBudgetYear(data,'2028','2027',11);
  data.years['2028'].lines[0].amounts[0]=0;
  assert.equal(carryPreviousMonth(data,'2028',0),false);
  assert.equal(data.years['2028'].lines[1].amounts[0],null);
  assert.equal(carryPreviousMonth(data,'2028',4),false);
  assert.equal(carryPreviousMonth(data,'2027',0),false);
  assert.doesNotThrow(()=>validateData(data));
});
