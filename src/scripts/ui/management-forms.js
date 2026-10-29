import { PROJECT_TYPES } from '../core/model.js';
import { saveProject, saveAccount, saveReference, prepareReferenceRemoval } from '../core/budget-editing.js';

export function createManagementForms({model,dialog,openForm,mutate}){
  function projectForm(project) {
    const creating=!project;
    openForm(creating?'Créer un projet':'Modifier le projet',[
      {name:'name',label:'Nom du projet',type:'text',value:project?.name||''},
      {name:'type',label:'Type de projet',type:'select',value:project?.type||'savings',options:PROJECT_TYPES},
      {name:'description',label:'Description',type:'textarea',value:project?.description||'',required:false},
      {name:'target',label:'Montant cible du projet (€)',type:'number',value:project?.target??1000,min:0},
      {name:'saved',label:'Épargne / apport déjà constitué (€)',type:'number',value:project?.saved??0,min:0},
      {name:'loanAmount',label:'Montant demandé au prêteur (€)',type:'number',value:project?.loanAmount??0,min:0,required:false},
      {name:'loanMonths',label:'Durée du prêt (mois entiers)',type:'number',value:project?.loanMonths??24,min:1,step:1,required:false},
      {name:'loanPayment',label:'Mensualité de crédit prévue (€)',type:'number',value:project?.loanPayment??0,min:0,required:false},
    ],value=>{
      saveProject(model.data,project,value);
    },'Les montants du projet ne modifient pas le budget. Saisissez les versements ou mensualités prévus dans Budget.');
    const typeControl=dialog.querySelector('[name="type"]');
    const updateLoanFields=()=>{
      for(const name of ['loanAmount','loanMonths','loanPayment']){
        const control=dialog.querySelector('[name="'+name+'"]');
        const visible=typeControl.value==='financing';
        control.style.display=visible?'':'none';control.disabled=!visible;
      }
    };
    typeControl.addEventListener('change',updateLoanFields);updateLoanFields();
  }

  function accountForm(account){openForm(account?'Modifier le compte':'Ajouter un compte',[
    {name:'name',label:'Nom du compte',type:'text',value:account?.name||''},{name:'type',label:'Type de compte',type:'select',value:account?.type||'Compte courant',options:['Compte courant','Épargne','Livret','Compte partagé','Autre'].map(value=>({value,label:value}))}
  ],values=>{saveAccount(model.data,account,values);});}
  function referenceForm(kind,item){
    const types=kind==='income-type';
    openForm(item?'Modifier':'Ajouter',[
      {name:'name',label:types?'Type de revenu':'Catégorie de dépense',type:'text',value:item?.name||''},
      ...(types?[{name:'saving',label:'Nature du montant disponible',type:'select',value:item?.saving?'yes':'no',options:[{value:'no',label:'Disponible pour les dépenses'},{value:'yes',label:'Réservé à l’épargne'}]}]:[])
    ],values=>{saveReference(model.data,kind,item,values);});
  }
  function deleteReference(kind,key){
    const {collection,index}=prepareReferenceRemoval(model.data,kind,key);
    if(index<0)return;
    if(confirm(`Supprimer « ${collection[index].name} » ?`))mutate(()=>collection.splice(index,1));
  }
  return {projectForm,accountForm,referenceForm,deleteReference};
}
