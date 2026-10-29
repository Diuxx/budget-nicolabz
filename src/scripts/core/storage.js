import { normalizeImport as normalizeLegacy } from './legacy-storage.js';
import { createEmptyBudget, periodKey } from './period-model.js';
import { BUDGET_SCHEMA, validateAgainstBudgetSchema } from './budget-schema.js';

const KEY='marge:budget:v4',OLD_KEY='marge:budget:v2',BACKUP_KEY='marge:backup:before-periods:v4';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const text=(value,max=160)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const validDate=value=>typeof value==='string'&&/^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)&&(()=>{const d=new Date(`${value}T12:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;})();
function list(items,label,check,max=1000){
  assert(Array.isArray(items)&&items.length<=max,`${label} : liste invalide.`);
  const ids=new Set();for(const item of items){assert(plain(item)&&text(item.id,120)&&!ids.has(item.id),`${label} : identifiant invalide ou dupliqué.`);ids.add(item.id);check(item);}
}
export function validateData(data) {
  validateAgainstBudgetSchema(data);
  assert(plain(data)&&data.version===4,'Sauvegarde de budget incompatible.');
  list(data.accounts,'Comptes',item=>assert(text(item.name)&&text(item.type),'Compte invalide.'));
  list(data.incomeTypes,'Types de revenu',item=>assert(text(item.name)&&typeof item.saving==='boolean','Type de revenu invalide.'));
  list(data.expenseCategories,'Catégories',item=>assert(text(item.name),'Catégorie invalide.'));
  assert(Array.isArray(data.periods)&&data.periods.length<=12000,'Périodes invalides.');
  const dates=new Set(),accountIds=new Set(data.accounts.map(item=>item.id)),typeIds=new Set(data.incomeTypes.map(item=>item.id)),categoryIds=new Set(data.expenseCategories.map(item=>item.id));
  for(const period of data.periods){
    assert(plain(period)&&/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period.date)&&!dates.has(period.date),'Mois invalide ou dupliqué.');dates.add(period.date);
    // Anciennes sauvegardes v4 : conserver cet ancien réglage sans l'utiliser.
    if (period.minMargin !== undefined) assert(number(period.minMargin), 'Ancienne marge minimale invalide.');
    const entry=item=>{
      assert(text(item.name)&&accountIds.has(item.accountId),'Libellé ou compte invalide.');
      assert(number(item.plannedAmount)&&(item.realAmount===null||number(item.realAmount)),'Montant prévu ou réel invalide.');
      for(const field of ['plannedDate','realDate'])assert(item[field]===null||(validDate(item[field])&&item[field].startsWith(period.date+'-')),'La date doit appartenir au mois affiché.');
    };
    list(period.incomes,'Revenus',item=>{entry(item);assert(typeIds.has(item.typeId),'Type de revenu inconnu.');});
    const incomes=new Map(period.incomes.map(item=>[item.id,item]));
    for(const income of period.incomes){
      const visited=new Set([income.id]);let parent=income.deductedFromIncomeId;
      assert(parent===null||typeof parent==='string','Source du revenu invalide.');
      while(parent!==null){assert(incomes.has(parent)&&!visited.has(parent),'Lien de financement invalide ou circulaire.');visited.add(parent);parent=incomes.get(parent).deductedFromIncomeId;}
    }
    list(period.expenses,'Dépenses',item=>{
      entry(item);assert(['fixed','variable','savings'].includes(item.type)&&categoryIds.has(item.categoryId),'Type ou catégorie de dépense invalide.');
      assert(typeof item.note==='string'&&item.note.length<=1000,'Note invalide.');
      assert(item.incomeId===null||(incomes.has(item.incomeId)&&incomes.get(item.incomeId).accountId===item.accountId),'Revenu de financement incompatible avec le compte.');
    });
  }
  list(data.projects,'Projets',project=>{
    assert(text(project.name)&&typeof project.description==='string'&&project.description.length<=500&&['savings','financing'].includes(project.type)&&number(project.target)&&number(project.saved),'Projet invalide.');
    if(project.type==='financing')assert(number(project.loanAmount)&&number(project.loanPayment)&&Number.isInteger(project.loanMonths)&&project.loanMonths>0,'Conditions de financement invalides.');
  });
  assert(Array.isArray(data.legacyTransactions),'Archives de transactions invalides.');
  return data;
}
export function migrateBudget(input) {
  const old=normalizeLegacy(input),data=createEmptyBudget();
  data.accounts=structuredClone(old.accounts);let main='migration-main';while(data.accounts.some(a=>a.id===main))main+='-';
  data.accounts.unshift({id:main,name:'Budget importé · à affecter',type:'Compte courant'});
  data.projects=structuredClone(old.projects);data.legacyTransactions=structuredClone(old.transactions);
  data.migration={fromVersion:input.version,accountId:main,note:'Prévisions reprises sans réel inventé. Les anciennes transactions restent archivées pour éviter un double comptage.'};
  if(old.legacySettings)data.legacySettings=structuredClone(old.legacySettings);
  for(const [year,budget] of Object.entries(old.years))for(let month=0;month<12;month++){
    // Do not fabricate monthly plans from empty future grids.
    if(!budget.lines.some(line=>line.amounts[month]!==null))continue;
    const period={date:periodKey(year,month),incomes:[],expenses:[]};
    // Métadonnée historique, conservée pour ne pas perdre l'information de l'ancien export.
    if (budget.minMargins?.[month] !== undefined) period.minMargin=budget.minMargins[month];
    for(const line of budget.lines){
      if(line.amounts[month]===null)continue;
      const raw=line.amounts[month];
      const income=(line.group==='income')===(raw>=0);
      const entry={id:`${year}-${month}-${line.id}`,name:line.label||'Poste importé',accountId:main,plannedAmount:Math.abs(raw),realAmount:null,plannedDate:null,realDate:null};
      if(income)period.incomes.push({...entry,typeId:'other',deductedFromIncomeId:null});
      else period.expenses.push({...entry,type:line.group==='savings'?'savings':line.group==='fixed'?'fixed':'variable',categoryId:line.group==='savings'?'savings':'other',incomeId:null,note:''});
    }
    data.periods.push(period);
  }
  return validateData(data);
}
export function normalizeImport(input) {
  assert(plain(input),'Fichier JSON attendu.');
  if (input.version===4) return validateData(structuredClone(input));
  assert([1,2,3].includes(input.version),'budget.version : version non reconnue (v1 à v4 acceptées).');
  return migrateBudget(input);
}
export function loadData() {
  const current=localStorage.getItem(KEY);if(current)return normalizeImport(JSON.parse(current));
  const raw=localStorage.getItem(OLD_KEY)||localStorage.getItem('budget-personnel:v1');
  if(!raw)return createEmptyBudget();
  const migrated=normalizeImport(JSON.parse(raw));
  if(!localStorage.getItem(BACKUP_KEY))localStorage.setItem(BACKUP_KEY,raw);
  saveData(migrated);return migrated;
}
export function saveData(data){localStorage.setItem(KEY,JSON.stringify(validateData(data)));}
export function downloadJSON(data,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),300);
}
export function exportData(data){downloadJSON(validateData(data),`marge-budget-${new Date().toISOString().slice(0,10)}.json`);}
export function exportImportTemplate(){downloadJSON(validateData(createEmptyBudget()),'marge-modele-import-v4.json');}
export function exportImportSchema(){downloadJSON(BUDGET_SCHEMA,'marge-budget-v4.schema.json');}

/** Efface les anciennes sauvegardes pour empêcher leur migration après une remise à zéro.
 * Ne jamais appeler localStorage.clear() : d'autres outils peuvent partager l'origine.
 */
export function resetLocalData(storage=localStorage, empty=createEmptyBudget()) {
  const clean=validateData(empty);
  const keys=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(key&&key!=='marge:budget:v4'&&(key.startsWith('marge:budget:')||key.startsWith('marge:backup:')||key.startsWith('marge:identity:anchor:v1:budget:')||key==='marge:selected-period'||key==='budget-personnel:v1'))keys.push(key);
  }
  // Écrire le budget vierge avant de supprimer les anciennes copies.
  storage.setItem('marge:budget:v4',JSON.stringify(clean));
  keys.forEach(key=>storage.removeItem(key));
  return clean;
}
export function exportOriginalBackup(){const raw=localStorage.getItem(BACKUP_KEY)||localStorage.getItem(OLD_KEY);if(!raw)throw new Error('Aucune ancienne sauvegarde locale.');downloadJSON(JSON.parse(raw),'marge-avant-refonte.json');}
export async function readImport(file){
  assert(file&&file.size<=5*1024*1024&&file.name.toLowerCase().endsWith('.json'),'Sélectionnez un fichier JSON de moins de 5 Mo.');
  let data;try{data=JSON.parse(await file.text());}catch{throw new Error('JSON illisible.');}return normalizeImport(data);
}
