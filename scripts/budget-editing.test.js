import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetDemo } from '../src/scripts/core/period-model.js';
import { validateData } from '../src/scripts/core/storage.js';
import { saveBudgetEntry, saveProject, saveAccount, saveReference, prepareReferenceRemoval } from '../src/scripts/core/budget-editing.js';

test('modifier le compte d’un revenu réaffecte ses dépenses financées', () => {
  const data=createBudgetDemo(), period=data.periods[0];
  const salary=period.incomes[0], expensesBefore=structuredClone(period.expenses);
  saveBudgetEntry(period,'income',salary,{...salary,accountId:'livret'});
  assert.deepEqual(period.expenses,expensesBefore.map(item=>({...item,accountId:'livret'})));
  assert.doesNotThrow(()=>validateData(data));
});

test('projets : création, financement, puis retour à un objectif d’épargne', () => {
  const data=createBudgetDemo(), periodsBefore=structuredClone(data.periods);
  const values={name:'Voyage',description:'Projet',type:'financing',target:5000,saved:500,loanAmount:4500,loanMonths:24,loanPayment:200};
  saveProject(data,null,{...values});
  const project=data.projects[0];
  assert.deepEqual({...project,id:undefined},{...values,id:undefined});
  assert.throws(()=>saveProject(data,project,{...values,loanMonths:1.5}),/mois entiers/);
  saveProject(data,project,{...values,type:'savings'});
  assert.equal(project.type,'savings');
  assert.ok(!Object.hasOwn(project,'loanAmount'));
  assert.ok(!Object.hasOwn(project,'loanMonths'));
  assert.ok(!Object.hasOwn(project,'loanPayment'));
  assert.deepEqual(data.periods,periodsBefore);
  assert.doesNotThrow(()=>validateData(data));
});

test('comptes et références : édition et protection des références utilisées', () => {
  const data=createBudgetDemo();
  saveAccount(data,null,{name:'Compte secondaire',type:'Compte courant'});
  const account=data.accounts.at(-1);
  saveAccount(data,account,{name:'Compte renommé',type:'Épargne'});
  assert.equal(data.accounts.at(-1).id,account.id);
  assert.equal(account.name,'Compte renommé');
  saveReference(data,'income-type',null,{name:'Réserve',saving:'yes'});
  assert.equal(data.incomeTypes.at(-1).saving,true);
  saveReference(data,'category',null,{name:'Animaux'});
  const category=data.expenseCategories.at(-1);
  saveReference(data,'category',category,{name:'Vétérinaire'});
  assert.equal(category.name,'Vétérinaire');
  assert.throws(()=>prepareReferenceRemoval(data,'account','main'),/utilisé/);
  assert.throws(()=>prepareReferenceRemoval(data,'income-type','salary'),/utilisé/);
  const removal=prepareReferenceRemoval(data,'category',category.id);
  assert.equal(removal.collection[removal.index],category);
  assert.doesNotThrow(()=>validateData(data));
});
