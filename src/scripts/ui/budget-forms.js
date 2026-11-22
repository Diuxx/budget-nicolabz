import { EXPENSE_TYPES, creditRepayments, creditProgress } from '../core/period-model.js';
import { saveBudgetEntry, recordBudgetEntry, assertCreditSelectable } from '../core/budget-editing.js';
import { btn } from './components.js';

export function createBudgetForms({model,presentation,dialog,openForm}){
  const {period,monYear,accountName}=presentation;
  let recordContext;
  function entryForm(kind,entry,draft={}){
    const p=period();if(!p)throw new Error('Préparez le mois avant d’ajouter une ligne.');
    if(!model.data.accounts.length)throw new Error('Ajoutez d’abord un compte.');
    const income=kind==='income';
    const options=items=>items.map(item=>({value:item.id,label:item.name}));
    const repayments=income?null:creditRepayments(model.data);
    const credits=income?[]:model.data.projects.filter(project=>project.type==='credit'&&((entry?.type==='credit'&&project.id===entry.projectId)||creditProgress(project,repayments).remaining>0));
    const fields=[{name:'name',label:'Libellé',type:'text',value:entry?.name||''},
      {name:'accountId',label:'Compte',type:'select',value:entry?.accountId||model.data.accounts[0].id,options:options(model.data.accounts)},
      ...(income?[{name:'typeId',label:'Type de revenu',type:'select',value:entry?.typeId||model.data.incomeTypes[0]?.id,options:options(model.data.incomeTypes)},
        {name:'deductedFromIncomeId',label:'Origine de l’argent',type:'select',value:entry?.deductedFromIncomeId||'',required:false,options:[{value:'',label:'Entrée externe (salaire, prime…)'} ,...p.incomes.filter(item=>item.id!==entry?.id).map(item=>({value:item.id,label:`Prélevé sur ${item.name} · ${accountName(item.accountId)}`}))]}]:[
        {name:'type',label:'Type de dépense',type:'select',value:entry?.type==='credit'?`credit:${entry.projectId}`:entry?.type||'variable',options:[...EXPENSE_TYPES,...credits.map(project=>({value:`credit:${project.id}`,label:`Crédit - ${project.name}`}))]},
        {name:'categoryId',label:'Catégorie',type:'select',value:entry?.categoryId||model.data.expenseCategories[0]?.id,options:options(model.data.expenseCategories)},
        {name:'incomeId',label:'Financée par',type:'select',value:entry?.incomeId||'',required:false,options:[{value:'',label:'Le compte directement'},...p.incomes.map(item=>({value:item.id,label:`${item.name} · ${accountName(item.accountId)}`}))]}]),
      {name:'plannedAmount',label:'Montant prévu (€)',type:'number',value:draft.plannedAmount??entry?.plannedAmount??0},
      {name:'realAmount',label:'Montant réel (€) · vide si non renseigné',type:'number',value:draft.realAmount??entry?.realAmount??'',required:false},
      {name:'plannedDate',label:'Date prévue',type:'date',additional:true,value:entry?.plannedDate||'',required:false},
      {name:'realDate',label:'Date réelle',type:'date',additional:true,value:entry?.realDate||'',required:false},
      {name:'note',label:'Note',type:'textarea',value:draft.note??entry?.note??'',required:false}];
    openForm(`${entry?'Modifier':'Ajouter'} ${income?'un revenu':'une dépense'}`,fields,values=>{
      if(!income&&values.type.startsWith('credit:')){
        const projectId=values.type.slice('credit:'.length);
        assertCreditSelectable(model.data,projectId,entry?.type==='credit'?entry.projectId:undefined);
        values.type='credit';values.projectId=projectId;
      }
      saveBudgetEntry(period(),kind,entry,values,p);
    },`Pour ${monYear()}. Les prévisions et le réel sont enregistrés séparément.`, `<div class="modal-copy">${btn('copy-planned-real','Reprendre le prévu dans le réel','secondary small')}</div>`);
    if(!income){
      const funding=dialog.querySelector('[name="incomeId"]'),account=dialog.querySelector('[name="accountId"]');
      const follow=()=>{const linked=p.incomes.find(item=>item.id===funding.value);account.disabled=!!linked;if(linked)account.value=linked.accountId;};
      funding.addEventListener('change',follow);follow();
    }
  }
  function recordForm(kind,entry){
    if(!entry)throw new Error('Cette ligne est introuvable.');
    recordContext={kind,id:entry.id,period:period().date,initial:{
      plannedAmount:String(entry.plannedAmount),
      realAmount:String(entry.realAmount??entry.plannedAmount),
      note:entry.note||'',
    }};
    openForm(`Pointer · ${entry.name}`,[
      {name:'plannedAmount',label:'Montant prévu (€)',type:'number',value:entry.plannedAmount},
      {name:'realAmount',label:'Montant réel (€)',type:'number',value:entry.realAmount??entry.plannedAmount},
      {name:'note',label:'Note',type:'textarea',value:entry.note||'',required:false},
    ],values=>{
      recordBudgetEntry(period(),kind,entry.id,values);
    },`Pour ${monYear()}. Confirmez le montant réel et ajoutez une note si nécessaire.`,'','record-form',btn('record-details','Détails','secondary'));
  }
  function openRecordDetails(){
    const p=period();
    if(!recordContext||p?.date!==recordContext.period)throw new Error('Le budget a changé. Rouvrez la ligne.');
    const {kind,id,initial}=recordContext;
    const entry=(kind==='income'?p.incomes:p.expenses).find(item=>item.id===id);
    if(!entry)throw new Error('Cette ligne est introuvable.');
    const draft={};
    for(const name of ['plannedAmount','realAmount','note']){
      const value=String(dialog.querySelector(`[name="${name}"]`).value??'');
      if(value!==initial[name])draft[name]=value;
    }
    entryForm(kind,entry,draft);
    const form=dialog.querySelector('form');
    form.tabIndex=-1;
    form.focus();
    recordContext=null;
  }
  return {entryForm,recordForm,openRecordDetails};
}
