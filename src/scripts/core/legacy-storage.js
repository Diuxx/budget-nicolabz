import { createDemoData, migrateLegacyData } from './model.js';

const KEY='marge:budget:v2';
const LEGACY_KEY='budget-personnel:v1';
const MAX_SIZE=5*1024*1024;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validNumber=value=>typeof value==='number'&&Number.isFinite(value);
const validString=(value,max=160)=>typeof value==='string'&&value.length<=max;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function validateUniqueItems(list,label,max,check) {
  assert(Array.isArray(list)&&list.length<=max,`${label} : liste invalide.`);
  const identifiers=new Set();
  list.forEach(item=>{
    assert(plain(item)&&validString(item.id,120)&&item.id,`${label} : identifiant incorrect.`);
    assert(!identifiers.has(item.id),`${label} : identifiant en double.`);
    identifiers.add(item.id);
    check(item);
  });
}
function validateBudget(data) {
  assert(plain(data.settings),'Paramètres budgétaires absents.');
  const expected=['salaryTarget','pelMinimum','livretTarget','peaTarget','loanPayment','minMargin','loanAmount','loanMonths'];
  if(data.version===2)for(const key of expected)assert(validNumber(data.settings[key]),`Paramètre invalide : ${key}.`);
  assert(plain(data.years),'Exercices budgétaires manquants.');
  const years=Object.keys(data.years);
  assert(years.length>0&&years.every(year=>/^[1-9]\d{3}$/.test(year)),'Exercices budgétaires invalides.');
  for(const year of years) {
    assert(plain(data.years[year]),`Exercice ${year} manquant.`);
    if(data.version===3)assert(Array.isArray(data.years[year].minMargins)&&data.years[year].minMargins.length===12&&data.years[year].minMargins.every(n=>validNumber(n)&&n>=0),'Chaque année doit contenir 12 marges minimales positives ou nulles.');
    if(data.years[year].carriedMonths!==undefined)assert(Array.isArray(data.years[year].carriedMonths)&&data.years[year].carriedMonths.length<=12&&new Set(data.years[year].carriedMonths).size===data.years[year].carriedMonths.length&&data.years[year].carriedMonths.every(month=>Number.isInteger(month)&&month>=0&&month<12),'Historique de reprise mensuelle invalide.');
    validateUniqueItems(data.years[year].lines,`Postes ${year}`,500,line=>{
      assert(['income','savings','fixed','variable'].includes(line.group),'Catégorie budgétaire invalide.');
      assert(validString(line.label,120)&&validString(line.type,60),'Libellé budgétaire invalide.');
      assert(Array.isArray(line.amounts)&&line.amounts.length===12&&line.amounts.every(n=>n===null||validNumber(n)),'Chaque poste doit contenir 12 montants.');
      assert(plain(line.links),'Liaisons de postes invalides.');
      if(data.version===3)assert(Object.keys(line.links).length===0,'Les anciennes liaisons doivent être converties.');
      for(const [month,key] of Object.entries(line.links))assert(/^(?:[0-9]|1[01])$/.test(month)&&Object.hasOwn(data.settings,key),'Liaison de paramètre invalide.');
    });
  }
}
export function validateData(data) {
  assert(plain(data)&&[2,3].includes(data.version),'Sauvegarde incompatible : format v2 ou v3 attendu.');
  validateBudget(data);
  validateUniqueItems(data.accounts,'Comptes',100,account=>{
    assert(validString(account.name,100)&&account.name.trim()&&validString(account.type,80),'Nom ou type de compte invalide.');
    assert(plain(account.balances),'Historique des comptes manquant.');
    for(const year of new Set([...Object.keys(data.years),...Object.keys(account.balances)]))assert(Array.isArray(account.balances[year])&&account.balances[year].length===12&&account.balances[year].every(n=>n===null||validNumber(n)),`Soldes ${year} invalides.`);
  });
  validateUniqueItems(data.projects,'Projets',100,project=>{
    assert(validString(project.name,100)&&project.name.trim()&&validString(project.description,500),'Nom ou description de projet invalide.');
    if(data.version===3){
      assert(['savings','financing'].includes(project.type),'Type de projet invalide.');
      if(project.type==='financing'){
        assert(validNumber(project.loanAmount)&&project.loanAmount>=0,'Montant du prêt invalide.');
        assert(Number.isInteger(project.loanMonths)&&project.loanMonths>0,'Durée du prêt invalide.');
        assert(validNumber(project.loanPayment)&&project.loanPayment>=0,'Mensualité de crédit invalide.');
      }
    }
    assert(validNumber(project.target)&&project.target>=0&&validNumber(project.saved)&&project.saved>=0,'Montants de projet invalides.');
  });
  validateUniqueItems(data.transactions,'Transactions',3000,transaction=>{
    assert(/^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(transaction.date||'')&&(()=>{const d=new Date(transaction.date+'T12:00:00');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===transaction.date;})(),'Date de transaction invalide.');
    assert(validString(transaction.label,120)&&transaction.label.trim()&&validString(transaction.category,80),'Libellé de transaction invalide.');
    assert(validNumber(transaction.amount),'Montant de transaction invalide.');
    assert(transaction.accountId===null||data.accounts.some(a=>a.id===transaction.accountId),'Compte de transaction inconnu.');
  });
  return data;
}
export function normalizeImport(input) {
  assert(plain(input),'Fichier JSON attendu.');
  let data=structuredClone(input);
  if(data.version===1) {
    assert(plain(data.settings)&&plain(data.years)&&plain(data.n26)&&plain(data.gear),'Sauvegarde v1 incomplète.');
    data=migrateLegacyData(data);
  }
  validateData(data);
  if(data.version===3)return data;
  // Preserve old settings for reference without guessing which project owns a loan.
  data.legacySettings=structuredClone(data.settings);
  for(const budget of Object.values(data.years)) {
    budget.minMargins=Array(12).fill(Math.max(0,data.settings.minMargin));
    for(const line of budget.lines){
      for(const [month,key] of Object.entries(line.links))line.amounts[Number(month)]=data.settings[key];
      line.links={};
    }
  }
  data.settings={};
  data.projects=data.projects.map(project=>({...project,type:'savings'}));
  data.version=3;
  return validateData(data);
}
export function loadData() {
  const raw=localStorage.getItem(KEY);
  if(raw)return normalizeImport(JSON.parse(raw));
  const legacy=localStorage.getItem(LEGACY_KEY);
  if(legacy)return normalizeImport(JSON.parse(legacy));
  return createDemoData();
}
export function saveData(data) {
  const validated=validateData(data);
  localStorage.setItem(KEY,JSON.stringify(validated));
}
export function exportData(data) {
  const validated=validateData(data);
  const blob=new Blob([JSON.stringify(validated,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=`marge-budget-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),300);
}
export async function readImport(file) {
  assert(file&&file.size<=MAX_SIZE,'Le fichier doit faire moins de 5 Mo.');
  assert(file.name.toLowerCase().endsWith('.json'),'Sélectionnez un fichier .json.');
  let parsed;
  try{parsed=JSON.parse(await file.text());}catch{throw new Error('Le JSON est illisible ou mal formé.');}
  return normalizeImport(parsed);
}
