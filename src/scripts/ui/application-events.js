import { periodKey, shiftPeriod, createPeriod, deleteIncome, createBudgetDemo } from '../core/period-model.js';
import { exportData, exportOriginalBackup, exportImportTemplate, exportImportSchema } from '../core/storage.js';
import { allowedViews } from './application-controller.js';

export function bindApplicationEvents({model,presentation,controller,budgetForms,managementForms,formDialog,dataTools,identity,dialog,resetDialog,importInput}){
  const {period,monYear}=presentation;
  const {mutate,setView,selectPeriod,render,showToast}=controller;
  const {entryForm,recordForm}=budgetForms;
  const {projectForm,accountForm,referenceForm,deleteReference}=managementForms;
  const {copyPlannedReal}=formDialog;
  const {openResetDialog,performFullReset,importBudget}=dataTools;
  const {refreshSession,driveAction,startLogin,startDriveConsent,logout,disconnectDrive}=identity;
  function act(action,target){
    const key=target.dataset.id,p=period();
    if(action.startsWith('edit-income')&&action!=='edit-income-type'){entryForm('income',p?.incomes.find(item=>item.id===key));return;}
    if(action==='edit-expense'){entryForm('expense',p?.expenses.find(item=>item.id===key));return;}
    if(action==='record-income'||action==='record-expense'){
      const item=(action==='record-income'?p.incomes:p.expenses).find(item=>item.id===key);
      recordForm(action==='record-income'?'income':'expense',item);return;
    }
    if(action==='delete-income'||action==='delete-expense'){
      if(confirm('Supprimer cette ligne du mois ?'))mutate(()=>{if(action==='delete-income')deleteIncome(p,key);else p.expenses=p.expenses.filter(item=>item.id!==key);});return;
    }
    switch(action){
      case 'prev-month':selectPeriod(shiftPeriod(model.selectedPeriod,-1));break;
      case 'next-month':selectPeriod(shiftPeriod(model.selectedPeriod,1));break;
      case 'open-period':selectPeriod(target.dataset.period,'budget');break;
      case 'create-period':{const copy=document.querySelector('#copyPrevious')?.checked??false;mutate(()=>createPeriod(model.data,model.selectedPeriod,copy),'Mois préparé. Les montants réels sont à renseigner.');break;}
      case 'delete-period':if(confirm(`Supprimer les revenus et dépenses de ${monYear()} ?`))mutate(()=>{model.data.periods=model.data.periods.filter(item=>item.date!==model.selectedPeriod);},'Mois supprimé.');break;
      case 'add-income':entryForm('income');break;
      case 'add-expense':entryForm('expense');break;
      case 'cancel-dialog':dialog.open=false;break;
      case 'copy-planned-real':copyPlannedReal();break;
      case 'view-budget':setView('budget');break;
      case 'view-analytics':setView('analytics');break;
      case 'view-projects':setView('projects');break;
      case 'view-accounts':setView('accounts');break;
      case 'add-account':accountForm();break;
      case 'edit-account':accountForm(model.data.accounts.find(item=>item.id===key));break;
      case 'delete-account':deleteReference('account',key);break;
      case 'add-income-type':referenceForm('income-type');break;
      case 'edit-income-type':referenceForm('income-type',model.data.incomeTypes.find(item=>item.id===key));break;
      case 'delete-income-type':deleteReference('income-type',key);break;
      case 'add-category':referenceForm('category');break;
      case 'edit-category':referenceForm('category',model.data.expenseCategories.find(item=>item.id===key));break;
      case 'delete-category':deleteReference('category',key);break;
      case 'add-project':projectForm(null);break;
      case 'edit-project':projectForm(model.data.projects.find(item=>item.id===key));break;
      case 'delete-project':if(confirm('Supprimer ce projet ?'))mutate(()=>{model.data.projects=model.data.projects.filter(item=>item.id!==key);});break;
      case 'export':exportData(model.data);break;
      case 'import-template':exportImportTemplate();break;
      case 'import-schema':exportImportSchema();break;
      case 'reset-open':openResetDialog();break;
      case 'reset-cancel':resetDialog.open=false;break;
      case 'reset-confirm':void performFullReset();break;
      case 'export-original':exportOriginalBackup();break;
      case 'import':importInput.click();break;
      case 'demo':if(confirm('Remplacer le budget local par un exemple ? Exportez votre budget auparavant.'))mutate(()=>{model.data=createBudgetDemo();model.selectedPeriod=model.data.periods[0].date;});break;
      case 'drive-sync':void driveAction('auto');break;
      case 'drive-push':void driveAction('push');break;
      case 'drive-pull':void driveAction('pull');break;
      case 'auth-login':startLogin();break;
      case 'auth-drive':startDriveConsent();break;
      case 'auth-refresh':void refreshSession();break;
      case 'auth-logout':void logout();break;
      case 'auth-drive-disconnect':void disconnectDrive();break;
    }
  }
    document.querySelector('#profileMenu')?.addEventListener('wa-select',event=>{try{if(event.detail?.item?.value)act(event.detail.item.value,event.detail.item);}catch(error){showToast(error.message,true);}});
    document.addEventListener('click',event=>{try{const viewButton=event.target.closest('[data-view]');if(viewButton){setView(viewButton.dataset.view);return;}const button=event.target.closest('[data-action]');if(button)act(button.dataset.action,button);}catch(error){showToast(error.message,true);}});
    document.addEventListener('change',event=>{
      const el=event.target;
      try{
        if(el.id==='monthSelect'){selectPeriod(periodKey(model.selectedPeriod.slice(0,4),Number(el.value)));return;}
        if(el.id==='yearSelect'){selectPeriod(periodKey(el.value,Number(model.selectedPeriod.slice(5))-1));return;}
        if(el.id==='fundingFilter'){model.fundingFilter=el.value;render();return;}

      }catch(error){showToast(error.message,true);render();}
    });
    resetDialog.querySelector('#resetConfirmation').addEventListener('input',event=>{
      resetDialog.querySelector('#confirmFullReset').disabled=event.target.value.trim()!=='EFFACER';
    });
    importInput.addEventListener('change',importBudget);
    window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(allowedViews.has(view)){model.currentView=view;render();}});
}
