import { id, round, MONTHS } from './model.js';

export const DEFAULT_CATEGORIES = [
  ['housing','Logement'],['utilities','Charges et abonnements'],['food','Alimentation'],
  ['transport','Transport'],['health','Santé'],['leisure','Loisirs'],['credit','Crédit'],
  ['savings','Épargne'],['project','Projet'],['other','Autres'],
].map(([id,name])=>({id,name}));
export const DEFAULT_INCOME_TYPES = [
  {id:'salary',name:'Salaire',saving:false},{id:'bonus',name:'Prime',saving:false},
  {id:'other',name:'Autre revenu',saving:false},{id:'transfer',name:'Virement interne',saving:false},
  {id:'livret',name:'Livret A',saving:true},{id:'pel',name:'PEL',saving:true},{id:'pea',name:'PEA',saving:true},
];
export const EXPENSE_TYPES = [{value:'fixed',label:'Charge fixe'},{value:'variable',label:'Dépense variable'},{value:'savings',label:'Épargne / projet'}];
export const periodKey=(year,month)=>`${year}-${String(month+1).padStart(2,'0')}`;
export function shiftPeriod(key, offset) {
  const [year,month]=key.split('-').map(Number),index=year*12+month-1+offset;
  const nextYear=Math.floor(index/12);
  if(!Number.isInteger(index)||nextYear<1000||nextYear>9999)throw new Error('Année hors limites.');
  return periodKey(nextYear,index%12);
}
export const currentPeriodKey=()=>{const now=new Date();return periodKey(now.getFullYear(),now.getMonth());};
export const periodLabel=key=>`${MONTHS[Number(key.slice(5))-1]} ${key.slice(0,4)}`;
export const getPeriod=(data,key)=>data.periods.find(period=>period.date===key);
export function createEmptyBudget() {
  return {version:4,periods:[],accounts:[{id:'main',name:'Compte principal',type:'Compte courant'}],
    expenseCategories:structuredClone(DEFAULT_CATEGORIES),incomeTypes:structuredClone(DEFAULT_INCOME_TYPES),projects:[],legacyTransactions:[]};
}
export function blankPeriod(date){return {date,incomes:[],expenses:[]};}
export function createPeriod(data,date,copyPrevious=true) {
  if(getPeriod(data,date))throw new Error('Ce mois existe déjà.');
  if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(date))throw new Error('Mois invalide.');
  const previous=getPeriod(data,shiftPeriod(date,-1));
  const period=blankPeriod(date);
  if(copyPrevious&&previous){
    const incomeIds=new Map(previous.incomes.map(income=>[income.id,id()]));
    const copy=item=>({...structuredClone(item),id:id(),realAmount:null,realDate:null,plannedDate:shiftEntryDate(item.plannedDate,date)});
    period.incomes=previous.incomes.map(income=>({...copy(income),id:incomeIds.get(income.id),deductedFromIncomeId:incomeIds.get(income.deductedFromIncomeId)??null}));
    period.expenses=previous.expenses.map(expense=>({...copy(expense),incomeId:incomeIds.get(expense.incomeId)??null}));
  }
  data.periods.push(period);data.periods.sort((a,b)=>a.date.localeCompare(b.date));return period;
}
export function shiftEntryDate(date,targetPeriod) {
  if(!date)return null;
  const [year,month]=targetPeriod.split('-').map(Number);
  const day=Math.min(Number(date.slice(8)),new Date(year,month,0).getDate());
  return `${targetPeriod}-${String(day).padStart(2,'0')}`;
}
const amount=(item,field)=>Number(item[field])||0;
const sum=(items,field)=>round(items.reduce((total,item)=>total+amount(item,field),0));
export function incomeAvailable(period,incomeId,field='plannedAmount') {
  const income=period.incomes.find(item=>item.id===incomeId);
  if(!income)return 0;
  return round(amount(income,field)-sum(period.incomes.filter(item=>item.deductedFromIncomeId===incomeId),field)-sum(period.expenses.filter(item=>item.incomeId===incomeId),field));
}
export function periodTotals(data,period) {
  const empty={income:0,expenses:0,savings:0,outflow:0,margin:0};
  if(!period)return {planned:{...empty},real:{...empty},recorded:0,entries:0};
  const savingTypes=new Set(data.incomeTypes.filter(type=>type.saving).map(type=>type.id));
  const total=field=>{
    const income=sum(period.incomes.filter(item=>!item.deductedFromIncomeId),field);
    const expenses=sum(period.expenses.filter(item=>item.type!=='savings'),field);
    const reserves=period.incomes.filter(item=>savingTypes.has(item.typeId)).reduce((total,item)=>total+Math.max(0,incomeAvailable(period,item.id,field)),0);
    const savings=round(sum(period.expenses.filter(item=>item.type==='savings'),field)+reserves);
    const outflow=round(expenses+savings);
    return {income,expenses,savings,outflow,margin:round(income-outflow)};
  };
  const entries=[...period.incomes,...period.expenses];
  return {planned:total('plannedAmount'),real:total('realAmount'),recorded:entries.filter(item=>item.realAmount!==null).length,entries:entries.length};
}
export function annualPeriods(data,year) {
  return MONTHS.map((_,month)=>{const date=periodKey(year,month),period=getPeriod(data,date);return {date,period,...periodTotals(data,period)};});
}
export function deleteIncome(period,incomeId) {
  if(period.incomes.some(item=>item.deductedFromIncomeId===incomeId)||period.expenses.some(item=>item.incomeId===incomeId))throw new Error('Ce revenu finance encore des lignes. Modifiez leur financement avant de le supprimer.');
  period.incomes=period.incomes.filter(item=>item.id!==incomeId);
}
export function createBudgetDemo() {
  const data=createEmptyBudget(),date=currentPeriodKey();
  data.accounts.push({id:'livret',name:'Livret A',type:'Épargne'});
  const period=blankPeriod(date);
  period.incomes=[{id:'demo-salary',name:'Salaire',typeId:'salary',accountId:'main',plannedAmount:3200,realAmount:3200,plannedDate:`${date}-01`,realDate:`${date}-01`,deductedFromIncomeId:null},
    {id:'demo-savings',name:'Épargne de précaution',typeId:'livret',accountId:'livret',plannedAmount:350,realAmount:null,plannedDate:`${date}-05`,realDate:null,deductedFromIncomeId:'demo-salary'}];
  period.expenses=[['Loyer',700,'housing','fixed'],['Alimentation',310,'food','variable'],['Transport',170,'transport','variable']].map(([name,value,categoryId,type],i)=>({id:`demo-expense-${i}`,name,type,categoryId,accountId:'main',incomeId:'demo-salary',plannedAmount:value,realAmount:i===0?700:null,plannedDate:null,realDate:null,note:''}));
  data.periods=[period];return data;
}
