import { currentPeriodKey } from '../core/period-model.js';
import { readImport, saveData } from '../core/storage.js';
import { resetBudget } from '../services/budget-reset.js';

export function createDataTools({model,connection,identityApi,resetDialog,importInput,render,showToast}){
  function openResetDialog() {
    if (connection.busy) throw new Error('Une opération Drive est déjà en cours.');
    const cloud = resetDialog.querySelector('#resetDriveChoice');
    const confirmation = resetDialog.querySelector('#resetConfirmation');
    const button = resetDialog.querySelector('#confirmFullReset');
    cloud.checked=false;
    cloud.disabled=!(connection.sessionState.authenticated&&connection.sessionState.driveConnected);
    confirmation.value='';
    button.disabled=true;
    resetDialog.open=true;
  }
  async function performFullReset() {
    const cloud = resetDialog.querySelector('#resetDriveChoice');
    const confirmation = resetDialog.querySelector('#resetConfirmation');
    if (confirmation.value.trim()!=='EFFACER') { showToast('Saisissez EFFACER pour confirmer.',true); return; }
    if (connection.busy) return;
    const resetDrive = cloud.checked;
    if(resetDrive && !(connection.sessionState.authenticated&&connection.sessionState.driveConnected)) {
      showToast('Connectez Google Drive avant de réinitialiser la sauvegarde distante.',true);return;
    }
    connection.busy=true;
    resetDialog.querySelector('#confirmFullReset').disabled=true;
    try {
      const result=await resetBudget({
        storage:localStorage,
        api:identityApi,
        userId:connection.sessionState.user?.id,
        resetDrive,
      });
      model.data=result.data;
      model.selectedPeriod=currentPeriodKey();
      model.fundingFilter='all';
      connection.locallyModified=!result.driveReset;
      model.loadError=null;
      resetDialog.open=false;
      render();
      showToast(result.driveReset
        ? 'Toutes les données ont été réinitialisées dans Pécule et Google Drive.'
        : 'Données locales réinitialisées. La sauvegarde Drive est inchangée.');
    } catch(error) {
      if(error.code==='SYNC_CONFLICT')showToast('Conflit Drive : les données ont changé ailleurs. Aucune réinitialisation locale effectuée.',true);
      else showToast(`Réinitialisation impossible : ${error.message}`,true);
      resetDialog.querySelector('#confirmFullReset').disabled=false;
    } finally { connection.busy=false; }
  }

  async function importBudget(){
      const file=importInput.files?.[0];if(!file)return;
      try{if(connection.busy)throw new Error('Attendez la fin de la synchronisation.');const incoming=await readImport(file);if(!confirm(`Importer « ${file.name} » et remplacer le budget local ?`))return;
        // Keep a recovery copy before a user-requested replacement.
        if(!model.loadError)localStorage.setItem('marge:backup:before-import:v4',JSON.stringify(model.data));
        saveData(incoming);model.data=incoming;model.loadError=null;connection.locallyModified=true;render();showToast('Budget importé et validé selon le patron JSON v4.');
      }catch(error){showToast(error.message,true);}finally{importInput.value='';}
  }
  return {openResetDialog,performFullReset,importBudget};
}
