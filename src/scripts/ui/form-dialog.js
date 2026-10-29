import { esc, btn, optionHtml } from './components.js';

export function createFormDialog({dialog,mutate,showToast}){
  function fieldHtml(field){
    const attrs=`name="${esc(field.name)}" id="f-${esc(field.name)}" ${field.required===false?'':'required'}`;
    if(field.type==='select')return `<wa-select class="form-control" size="s" label="${esc(field.label)}" ${attrs} value="${esc(field.value??'')}">${field.options.map(item=>optionHtml(item.value,item.label,field.value)).join('')}</wa-select>`;
    if(field.type==='textarea')return `<wa-textarea class="form-control" size="s" label="${esc(field.label)}" ${attrs} rows="2" maxlength="1000" value="${esc(field.value??'')}"></wa-textarea>`;
    return `<wa-input class="form-control" size="s" label="${esc(field.label)}" ${attrs} type="${field.type||'text'}" value="${esc(field.value??'')}" ${field.type==='number'?`min="${field.min??0}" step="${field.step??'0.01'}"`:''} ${field.type==='text'?'maxlength="160"':''}></wa-input>`;
  }
  function openForm(title,fields,onSave,description='',extra='',formClass=''){
    dialog.label=title;dialog.innerHTML=`<form class="modal-form ${formClass}"><p class="modal-description">${esc(description)}</p><div class="form-fields">${fields.filter(field=>!field.additional).map(fieldHtml).join('')}</div>${fields.some(field=>field.additional)?`<details class="form-options"><summary>Options supplémentaires</summary><div class="form-option-fields">${fields.filter(field=>field.additional).map(fieldHtml).join('')}</div></details>`:''}${extra}<div class="modal-footer">${btn('cancel-dialog','Annuler','secondary','size="s"')}<wa-button type="submit" size="s" appearance="filled" variant="brand" class="btn primary">Enregistrer</wa-button></div></form>`;dialog.open=true;
    dialog.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();
      const values=Object.fromEntries(fields.map(field=>{const raw=dialog.querySelector(`[name="${field.name}"]`).value??'';return [field.name,field.type==='number'?(String(raw).trim()===''?null:Number(raw)):String(raw).trim()];}));
      if(fields.some(field=>field.required!==false&&(values[field.name]===null||values[field.name]===''))){showToast('Complétez les champs obligatoires.',true);return;}
      if(fields.some(field=>field.type==='number'&&values[field.name]!==null&&!Number.isFinite(values[field.name]))){showToast('Montant invalide.',true);return;}
      try{mutate(()=>onSave(values));dialog.open=false;}catch(error){showToast(error.message,true);}
    });
  }
  function copyPlannedReal(){for(const [from,to] of [['plannedAmount','realAmount'],['plannedDate','realDate']]){const source=dialog.querySelector(`[name="${from}"]`),target=dialog.querySelector(`[name="${to}"]`);if(source&&target)target.value=source.value;}}
  return {openForm,copyPlannedReal};
}
