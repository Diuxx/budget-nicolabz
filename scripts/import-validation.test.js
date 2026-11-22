import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUDGET_SCHEMA, validateAgainstBudgetSchema } from '../src/scripts/core/budget-schema.js';
import { createEmptyBudget, createBudgetDemo } from '../src/scripts/core/period-model.js';
import { validateData, normalizeImport, readImport } from '../src/scripts/core/storage.js';

const demo=()=>createBudgetDemo();

test('le patron v1 livré est conforme au schéma téléchargé et au validateur métier',()=>{
  const schema=JSON.parse(readFileSync('src/assets/schemas/pecule-budget-v1.schema.json','utf8'));
  const template=JSON.parse(readFileSync('src/assets/schemas/pecule-modele-import-v1.json','utf8'));
  assert.deepEqual(schema,BUDGET_SCHEMA);
  assert.deepEqual(template,createEmptyBudget());
  assert.deepEqual(validateData(template),template);
  assert.equal(template.periods.length,0);
  assert.ok(template.incomeTypes.length>0 && template.expenseCategories.length>0);
  assert.equal(template.accounts.length,1);
});

test('import : schéma requis (champs absents, mauvais types, valeurs et périodes)',async()=>{
  const bad=[
    [ data=>delete data.incomeTypes, /budget\.incomeTypes/ ],
    [ data=>{data.accounts='mon compte';}, /budget\.accounts/ ],
    [ data=>{data.version=99;}, /budget\.version/ ],
    [ data=>{data.accounts[0].name='';}, /budget\.accounts\[0\]\.name/ ],
    [ data=>{data.periods[0].expenses[0].realAmount=-2;}, /budget\.periods\[0\]\.expenses\[0\]\.realAmount/ ],
    [ data=>{data.periods[0].date='2028-13';}, /budget\.periods\[0\]\.date/ ],
  ];
  for(const [change,expected] of bad){
    const data=demo();change(data);
    assert.throws(()=>validateAgainstBudgetSchema(data),expected);
    assert.throws(()=>validateData(data),expected);
    await assert.rejects(readImport({name:'budget.json',size:100,text:async()=>JSON.stringify(data)}),expected);
  }
});

test('import : contrôle métier après le schéma (références, dates, doublons)',()=>{
  const bad=[
    data=>{data.periods[0].incomes[0].accountId='inconnu';},
    data=>{data.periods[0].incomes[0].realDate='2028-02-31';},
    data=>{data.periods[0].expenses[0].incomeId='revenu-inconnu';},
    data=>{data.accounts.push({...data.accounts[0]});},
    data=>{data.periods[0].incomes[0].deductedFromIncomeId='demo-savings';},
    data=>{data.periods[0].expenses[0].accountId='livret';},
    data=>{data.periods.push(structuredClone(data.periods[0]));},
  ];
  for(const change of bad){const data=demo();change(data);assert.throws(()=>validateData(data));}
});

test('le patron v1 accepte les exports historiques normalisés sans perdre les champs optionnels',()=>{
  const data=demo();data.periods[0].minMargin=2;data.legacyTransactions=[{id:'archives-1',name:'Ancien poste'}];
  data.migration={note:'archive'};
  assert.deepEqual(normalizeImport(data),data);
});

test('les seuils personnalisés sont conservés à l’import et validés',()=>{
  const data=createEmptyBudget();data.marginThresholds={warning:75,positive:150};
  assert.deepEqual(normalizeImport(JSON.parse(JSON.stringify(data))),data);
  data.marginThresholds.positive=75;assert.throws(()=>validateData(data),/seuil vert/);
});

test('import : les dépenses de crédit nécessitent un projet associé',()=>{
  const data=demo();
  data.projects.push({id:'c',name:'Crédit',description:'',type:'credit',target:100,saved:0});
  data.periods[0].expenses.push({...data.periods[0].expenses[0],id:'c1',type:'credit',projectId:'c'});
  assert.doesNotThrow(()=>validateData(data));
  const expense=data.periods[0].expenses.find(item=>item.id==='c1');
  expense.projectId='inconnu';assert.throws(()=>validateData(data),/Crédit associé introuvable/);
  delete expense.projectId;assert.throws(()=>validateData(data),/Crédit associé introuvable/);
});
