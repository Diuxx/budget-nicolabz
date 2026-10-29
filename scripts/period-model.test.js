import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyBudget,createBudgetDemo,createPeriod,getPeriod,shiftPeriod,periodTotals,incomeAvailable,deleteIncome} from '../src/scripts/core/period-model.js';
import {validateData,normalizeImport,loadData} from '../src/scripts/core/storage.js';
import {createDemoData,monthlyBudget} from '../src/scripts/core/model.js';

test('un mois est créé explicitement et la navigation ne modifie pas les données',()=>{
  const data=createEmptyBudget(),before=structuredClone(data);
  assert.equal(shiftPeriod('2027-12',1),'2028-01');assert.equal(shiftPeriod('2028-01',-1),'2027-12');
  assert.equal(getPeriod(data,'2028-01'),undefined);assert.deepEqual(data,before);
  createPeriod(data,'2028-01',false);assert.equal(data.periods.length,1);
  assert.throws(()=>createPeriod(data,'2028-01'),/existe déjà/);assert.doesNotThrow(()=>validateData(data));
});
test('copie : prévisions, liens et dates adaptés ; réels remis à renseigner',()=>{
  const data=createBudgetDemo(),source=data.periods[0];source.date='2027-12';
  for(const item of [...source.incomes,...source.expenses]){item.plannedDate='2027-12-31';item.realDate='2027-12-31';item.realAmount=0;}
  const before=structuredClone(source),copy=createPeriod(data,'2028-01');
  assert.deepEqual(source,before);assert.equal(copy.incomes[0].plannedAmount,3200);
  assert.equal(copy.incomes[1].deductedFromIncomeId,copy.incomes[0].id);
  assert.equal(copy.expenses[0].incomeId,copy.incomes[0].id);
  assert.notEqual(copy.incomes[0].id,source.incomes[0].id);
  assert.ok([...copy.incomes,...copy.expenses].every(item=>item.realAmount===null&&item.realDate===null&&item.plannedDate==='2028-01-31'));
  const feb=createPeriod(data,'2028-02');assert.equal(feb.incomes[0].plannedDate,'2028-02-29');
  copy.incomes[0].plannedAmount=4000;assert.equal(source.incomes[0].plannedAmount,3200);
  assert.doesNotThrow(()=>validateData(data));
});
test('transfert et dépense financée : aucun double comptage des revenus ou de l’épargne',()=>{
  const data=createBudgetDemo(),p=data.periods[0];p.expenses=[];
  assert.equal(periodTotals(data,p).planned.income,3200);
  assert.equal(periodTotals(data,p).planned.savings,350);
  assert.equal(periodTotals(data,p).planned.margin,2850);
  p.expenses.push({id:'from-saving',name:'Achat',type:'variable',categoryId:'other',accountId:'livret',incomeId:'demo-savings',plannedAmount:100,realAmount:null,plannedDate:null,realDate:null,note:''});
  const totals=periodTotals(data,p);
  assert.equal(totals.planned.expenses,100);assert.equal(totals.planned.savings,250);assert.equal(totals.planned.margin,2850);
  assert.equal(incomeAvailable(p,'demo-salary'),2850);assert.equal(incomeAvailable(p,'demo-savings'),250);
});
test('réel à zéro distinct de non renseigné et indépendant du prévu',()=>{
  const data=createBudgetDemo(),p=data.periods[0];
  p.incomes[0].realAmount=0;const totals=periodTotals(data,p);
  assert.equal(totals.real.income,0);assert.equal(totals.planned.income,3200);assert.equal(totals.recorded,2);
  assert.equal(p.incomes[1].realAmount,null);
});
test('références, cycles, dates et montants invalides refusés',()=>{
  const source=createBudgetDemo();
  for(const change of [
    data=>data.periods[0].incomes[0].deductedFromIncomeId='demo-savings',
    data=>data.periods[0].expenses[0].accountId='livret',
    data=>data.periods[0].incomes[0].plannedAmount=-1,
    data=>data.periods[0].expenses[0].realDate='2027-02-31',
    data=>data.periods.push(structuredClone(data.periods[0])),
  ]){const data=structuredClone(source);change(data);assert.throws(()=>validateData(data));}
  assert.throws(()=>deleteIncome(source.periods[0],'demo-salary'),/finance encore/);
});
test('migration des anciennes prévisions sans invention de réel ni double comptage des transactions',()=>{
  const old=createDemoData();old.years['2026'].lines[0].amounts[0]=3500;
  const before=structuredClone(old),data=normalizeImport(old),p=getPeriod(data,'2026-01');
  assert.equal(data.version,4);assert.deepEqual(old,before);
  assert.equal(periodTotals(data,p).planned.margin,monthlyBudget(old,'2026',0).cashflow);
  assert.ok([...p.incomes,...p.expenses].every(item=>item.realAmount===null));
  assert.deepEqual(data.legacyTransactions,old.transactions);assert.deepEqual(data.projects,old.projects);
  assert.deepEqual(data.accounts.find(a=>a.id==='demo-a1').balances,old.accounts[0].balances);
  assert.deepEqual(normalizeImport(JSON.parse(JSON.stringify(data))),data);
});
test('migration locale sauvegardée une seule fois, ancien contenu conservé',()=>{
  const old=createDemoData(),raw=JSON.stringify(old),values=new Map([['marge:budget:v2',raw]]);
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const data=loadData();assert.equal(data.version,4);
  assert.equal(values.get('marge:backup:before-periods:v4'),raw);assert.equal(values.get('marge:budget:v2'),raw);
  assert.equal(JSON.parse(values.get('marge:budget:v4')).version,4);
  assert.deepEqual(loadData(),data);
});
test('mois vides ignorés pendant la migration, seuils et montants négatifs préservés',()=>{
  const old=createDemoData();for(const line of old.years['2027'].lines)line.amounts=Array(12).fill(null);
  old.years['2026'].lines[0].amounts[0]=-100;old.years['2026'].lines[8].amounts[0]=-20;
  const data=normalizeImport(old);assert.equal(getPeriod(data,'2027-01'),undefined);
  assert.equal(periodTotals(data,getPeriod(data,'2026-01')).planned.margin,monthlyBudget(old,'2026',0).cashflow);
});

test('objectifs supprimés : nouvelles périodes sans marge minimale, anciens exports v4 compatibles',()=>{
  const data=createBudgetDemo(),period=data.periods[0];
  assert.equal(Object.hasOwn(period,'minMargin'),false);
  const next=createPeriod(data,shiftPeriod(period.date,1));
  assert.equal(Object.hasOwn(next,'minMargin'),false);
  assert.equal('threshold' in periodTotals(data,period),false);
  period.minMargin=750;
  assert.doesNotThrow(()=>validateData(data));
  assert.equal(periodTotals(data,period).planned.margin,periodTotals(data,structuredClone({...period,minMargin:0})).planned.margin);
  assert.equal('threshold' in periodTotals(data,period),false);
});
