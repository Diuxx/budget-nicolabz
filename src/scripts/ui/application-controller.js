import { loadData, saveData } from '../core/storage.js';
import { createEmptyBudget } from '../core/period-model.js';
import { esc, btn } from './components.js';

export const allowedViews=new Set(['dashboard','budget','analytics','transactions','projects','accounts','settings']);

export function createApplicationController({model,connection,app,toastElement,views,onRendered}){
  let toastTimer;
  function showToast(message,isError=false){toastElement.textContent=message;toastElement.className=`visible ${isError?'error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastElement.className='',5000);}
  function mutate(change,message='Enregistré localement · Drive à synchroniser'){
    if(model.loadError)throw new Error('Importez une sauvegarde valide avant de modifier le budget.');
    if(connection.busy)throw new Error('Attendez la fin de la synchronisation.');
    const previous=structuredClone(model.data);
    try{change();saveData(model.data);}catch(error){model.data=previous;throw error;}
    connection.locallyModified=true;render();showToast(message);
  }
  function setView(view){if(!allowedViews.has(view))return;model.currentView=view;location.hash=view;render();window.scrollTo({top:0,behavior:'smooth'});}
  function selectPeriod(key,view){
    if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(key))throw new Error('Période invalide.');
    model.selectedPeriod=key;model.fundingFilter='all';try{localStorage.setItem('marge:selected-period',key);}catch{}
    if(view)setView(view);else render();
  }
  function render(){
    document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===model.currentView);button.setAttribute('aria-current',button.dataset.view===model.currentView?'page':'false');});
    app.innerHTML=model.loadError?`<section class="panel period-empty"><h1>La sauvegarde n’a pas pu être ouverte</h1><p>${esc(model.loadError)}</p><p>Les données enregistrées sont conservées. Vous pouvez récupérer la sauvegarde d’origine ou importer un fichier valide.</p><div class="inline-actions">${btn('export-original','Récupérer l’ancienne sauvegarde','secondary')}${btn('import','Importer un JSON','primary')}</div></section>`:views[model.currentView]();
    onRendered();
  }

  function initialize(){
    try{model.data=loadData();}catch(error){model.data=createEmptyBudget();model.loadError=error.message;}
    try{const saved=localStorage.getItem('marge:selected-period');if(saved&&/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(saved))model.selectedPeriod=saved;}catch{}
    const view=location.hash.slice(1);if(allowedViews.has(view))model.currentView=view;
    render();
  }
  return {showToast,mutate,setView,selectPeriod,render,initialize};
}
