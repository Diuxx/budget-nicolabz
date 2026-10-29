import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyBudget, blankPeriod } from '../src/scripts/core/period-model.js';
import { annualSavingsByType, buildFundingFilters, filterBudgetEntries, fundingBalances } from '../src/scripts/core/budget-insights.js';

function preparedBudget() {
  const data=createEmptyBudget();
  data.accounts.push({id:'n26',name:'N26',type:'Compte courant'},{id:'livret',name:'Livret A',type:'Épargne'});
  const period=blankPeriod('2026-10');
  period.incomes=[
    {id:'salary',name:'Salaire',typeId:'salary',accountId:'main',plannedAmount:2900,realAmount:2850,plannedDate:null,realDate:null,deductedFromIncomeId:null},
    {id:'bonus',name:'Prime',typeId:'bonus',accountId:'main',plannedAmount:400,realAmount:400,plannedDate:null,realDate:null,deductedFromIncomeId:null},
    {id:'n26-allowance',name:'Loisirs N26',typeId:'transfer',accountId:'n26',plannedAmount:200,realAmount:150,plannedDate:null,realDate:null,deductedFromIncomeId:'salary'},
    {id:'pel-deposit',name:'PEL',typeId:'pel',accountId:'livret',plannedAmount:350,realAmount:300,plannedDate:null,realDate:null,deductedFromIncomeId:'salary'},
  ];
  const expense=(id,accountId,incomeId,amount)=>({id,name:id,accountId,incomeId,categoryId:'leisure',type:'variable',plannedAmount:amount,realAmount:null,plannedDate:null,realDate:null,note:''});
  period.expenses=[expense('rent','main','salary',700),expense('shopping','main','bonus',100),expense('cinema','n26','n26-allowance',50),expense('cash','n26',null,40)];
  data.periods.push(period);
  return {data,period};
}

test('filtre les dépenses par compte ou par source de financement',()=>{
  const {data,period}=preparedBudget();
  const filters=buildFundingFilters(data,period);
  assert.ok(filters.some(option=>option.value==='account:n26'));
  assert.ok(filters.some(option=>option.value==='income:n26-allowance'));
  assert.deepEqual(filterBudgetEntries(period,'expense','account:n26').map(item=>item.id),['cinema','cash']);
  assert.deepEqual(filterBudgetEntries(period,'expense','income:n26-allowance').map(item=>item.id),['cinema']);
  assert.deepEqual(filterBudgetEntries(period,'expense','income:salary').map(item=>item.id),['rent']);
  assert.deepEqual(filterBudgetEntries(period,'income','account:n26').map(item=>item.id),['n26-allowance']);
  assert.deepEqual(filterBudgetEntries(period,'income','income:salary').map(item=>item.id),['salary']);
  assert.deepEqual(filterBudgetEntries(period,'expense','account:unknown'),[]);
  assert.deepEqual(filterBudgetEntries(period,'expense','all'),period.expenses);
});

test('ne confond pas un identifiant de compte et de revenu identique',()=>{
  const {period}=preparedBudget();
  period.incomes[0].id='main';
  assert.equal(filterBudgetEntries(period,'income','income:main').length,1);
  assert.equal(filterBudgetEntries(period,'income','account:main').length,2);
});

test('épargne annuelle par type : prévu et réel séparés, avec zéro distinct de non renseigné',()=>{
  const {data,period}=preparedBudget();
  data.periods.push({...structuredClone(period),date:'2027-01'});
  data.periods.push({...structuredClone(period),date:'2026-11',incomes:[{...period.incomes[3],id:'pel2',realAmount:null}]});
  const values=annualSavingsByType(data,'2026');
  assert.equal(values.length,1);
  assert.equal(values[0].name,'PEL');
  assert.equal(values[0].planned,700);
  assert.equal(values[0].real,300);
  assert.equal(values[0].recorded,1);
  assert.equal(values[0].count,2);
  data.periods[2].incomes[0].realAmount=0;
  assert.equal(annualSavingsByType(data,'2026')[0].recorded,2);
});

test('solde disponible déduit transferts et dépenses financées, sans double comptage',()=>{
  const {period}=preparedBudget();
  const remaining=fundingBalances(period,'salary');
  assert.equal(remaining.planned,1650); // 2900 - 200 N26 - 350 PEL - 700 loyer
  assert.equal(remaining.real,2400);    // 2850 - 150 N26 - 300 PEL, loyer pas encore pointé
  assert.equal(fundingBalances(period,'n26-allowance').planned,150);
});
