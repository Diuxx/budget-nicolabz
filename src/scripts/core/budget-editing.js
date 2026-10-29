import { id, PROJECT_TYPES } from './model.js';

// Mutations en mémoire ; la validation et la sauvegarde restent gérées par l'appelant.
export function saveBudgetEntry(current,kind,entry,values,p=current){
    values.plannedDate||=null;values.realDate||=null;
    if(kind==='income')values.deductedFromIncomeId||=null;
    else {values.incomeId||=null;if(values.incomeId)values.accountId=p.incomes.find(item=>item.id===values.incomeId)?.accountId;}
    const collection=kind==='income'?current.incomes:current.expenses;
    const next={...entry,...values,id:entry?.id||id()};
    const index=collection.findIndex(item=>item.id===next.id);if(index<0)collection.push(next);else collection[index]=next;
    if(kind==='income')for(const expense of current.expenses)if(expense.incomeId===next.id)expense.accountId=next.accountId;
}

export function recordBudgetEntry(currentPeriod,kind,entryId,values){
    const collection=kind==='income'?currentPeriod.incomes:currentPeriod.expenses;
    const current=collection.find(item=>item.id===entryId);
    if(!current)throw new Error('Cette ligne est introuvable.');
    Object.assign(current,values);
}

export function saveProject(data,project,value){
    if(!PROJECT_TYPES.some(type=>type.value===value.type)||value.target<0||value.saved<0)throw new Error('Renseignez un type et des montants valides.');
    if(value.type==='financing'){
      if(value.loanAmount===null||value.loanAmount<0||!Number.isInteger(value.loanMonths)||value.loanMonths<=0||value.loanPayment===null||value.loanPayment<0)throw new Error('Renseignez le prêt, sa durée en mois entiers et sa mensualité.');
    }else{delete value.loanAmount;delete value.loanMonths;delete value.loanPayment;}
    if(!project)data.projects.push({id:id(),...value});
    else {const existing=data.projects.find(item=>item.id===project.id);delete existing.loanAmount;delete existing.loanMonths;delete existing.loanPayment;Object.assign(existing,value);}
}

export function saveAccount(data,account,values){if(account)Object.assign(data.accounts.find(item=>item.id===account.id),values);else data.accounts.push({id:id(),...values});}

export function saveReference(data,kind,item,values){const types=kind==='income-type';const live=types?data.incomeTypes:data.expenseCategories;if(types)values.saving=values.saving==='yes';if(item)Object.assign(live.find(entry=>entry.id===item.id),values);else live.push({id:id(),...values});}

export function prepareReferenceRemoval(data,kind,key){
  let used=false,collection;
  if(kind==='account'){collection=data.accounts;used=data.periods.some(p=>[...p.incomes,...p.expenses].some(item=>item.accountId===key));}
  if(kind==='income-type'){collection=data.incomeTypes;used=data.periods.some(p=>p.incomes.some(item=>item.typeId===key));}
  if(kind==='category'){collection=data.expenseCategories;used=data.periods.some(p=>p.expenses.some(item=>item.categoryId===key));}
  if(used)throw new Error('Cet élément est utilisé dans un budget. Réaffectez les lignes concernées avant de le supprimer.');
  if(collection.length<=1)throw new Error('Conservez au moins un élément dans cette liste.');
  const index=collection.findIndex(item=>item.id===key);return {collection,index};
}
