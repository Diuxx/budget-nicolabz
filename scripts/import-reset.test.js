import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUDGET_SCHEMA, validateAgainstBudgetSchema } from '../src/scripts/core/budget-schema.js';
import { createEmptyBudget, createBudgetDemo } from '../src/scripts/core/period-model.js';
import { validateData, normalizeImport, resetLocalData, readImport } from '../src/scripts/core/storage.js';
import { resetBudget } from '../src/scripts/services/budget-reset.js';
import { getIdentitySyncInfo } from '../src/scripts/services/identity-sync.js';

function store(initial={}) {
  const values=new Map(Object.entries(initial));
  return { values, get length() {return values.size;}, key:i=>Array.from(values.keys())[i]??null,
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key) };
}
const demo=()=>createBudgetDemo();

test('le patron v4 livré est conforme au schéma téléchargé et au validateur métier',()=>{
  const schema=JSON.parse(readFileSync('src/assets/schemas/marge-budget-v4.schema.json','utf8'));
  const template=JSON.parse(readFileSync('src/assets/schemas/marge-modele-import-v4.json','utf8'));
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
  ];
  for(const change of bad){const data=demo();change(data);assert.throws(()=>validateData(data));}
});

test('le patron v4 accepte les exports historiques normalisés sans perdre les champs optionnels',()=>{
  const data=demo();data.periods[0].minMargin=2;data.legacyTransactions=[{id:'archives-1',name:'Ancien poste'}];
  data.migration={note:'archive'};
  assert.deepEqual(normalizeImport(data),data);
});

test('remise à zéro locale : conserve uniquement les références et efface les anciennes clés de Marge',async()=>{
  const input=demo();input.projects.push({id:'prj',name:'Moto',type:'savings',target:500,saved:100,description:''});
  input.incomeTypes.push({id:'custom',name:'Custom',saving:false});
  input.expenseCategories.push({id:'custom-cat',name:'Custom',icon:'💰'});
  input.legacyTransactions.push({id:'tr',label:'ancien'});
  const local=store({'marge:budget:v4':JSON.stringify(input),
    'marge:budget:v2':'ancien','marge:backup:before-import:v4':'ancien',
    'marge:backup:before-periods:v4':'ancien','marge:identity:anchor:v1:budget:123':'ancien',
    'budget-personnel:v1':'ancien', 'marge:selected-period':'2027-06', 'autre-app:data':'à préserver'});
  const {data,driveReset}=await resetBudget({storage:local});
  assert.equal(driveReset,false);
  assert.deepEqual(data,createEmptyBudget());
  assert.deepEqual(JSON.parse(local.getItem('marge:budget:v4')),createEmptyBudget());
  for(const key of ['marge:budget:v2','marge:backup:before-import:v4','marge:backup:before-periods:v4','marge:identity:anchor:v1:budget:123','budget-personnel:v1','marge:selected-period'])assert.equal(local.getItem(key),null,key);
  assert.equal(local.getItem('autre-app:data'),'à préserver');
});

test('Drive : reset versionné sans supprimer local si la sauvegarde échoue',async()=>{
  const local=store({'marge:budget:v4':JSON.stringify(demo())});
  const original=local.getItem('marge:budget:v4');
  const api={appId:'budget',readBudget:async()=>({version:3,data:demo()}),saveBudget:async()=>{const err=new Error('Conflit');err.code='SYNC_CONFLICT';throw err;}};
  await assert.rejects(resetBudget({storage:local,api,userId:7,resetDrive:true}),/Conflit/);
  assert.equal(local.getItem('marge:budget:v4'),original);
});

test('Drive : un reset confirmé écrase le JSON distant avec version CAS et réancre la synchro',async()=>{
  const local=store({'marge:budget:v4':JSON.stringify(demo())});
  const remote={version:5,data:demo()};
  const api={appId:'budget',readBudget:async()=>structuredClone(remote),saveBudget:async(version,data)=>{
    assert.equal(version,5);assert.deepEqual(data,createEmptyBudget());
    remote.data=structuredClone(data);return {version:++remote.version};
  }};
  const result=await resetBudget({storage:local,api,userId:7,resetDrive:true});
  assert.equal(result.driveReset,true);
  assert.deepEqual(result.data,createEmptyBudget());
  assert.deepEqual(remote.data,createEmptyBudget());
  const anchor=getIdentitySyncInfo({storage:local,appId:'budget',userId:7});
  assert.equal(anchor.version,6);
  assert.equal(typeof anchor.digest,'string');
});

test('Drive : pas de remise à zéro distante sans session ni API',async()=>{
  const local=store({'marge:budget:v4':JSON.stringify(demo())});
  await assert.rejects(resetBudget({storage:local,resetDrive:true}),/Connectez/);
  assert.equal(JSON.parse(local.getItem('marge:budget:v4')).periods.length,1);
});
