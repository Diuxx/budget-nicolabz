export function confirmAction(message){
  return new Promise(resolve=>{
    const region=document.querySelector('#confirmation');
    if(!region||!region.hidden){resolve(false);return;}
    region.replaceChildren();
    const text=document.createElement('p');
    text.textContent=message;
    region.append(text);
    region.hidden=false;
    const previousFocus=document.activeElement;
    for(const [label,value] of [['Annuler',false],['Confirmer',true]]){
      const button=document.createElement('button');
      button.type='button';
      button.className=`button button-${value?'primary':'secondary'}`;
      button.textContent=label;
      button.addEventListener('click',()=>{
        region.hidden=true;
        region.replaceChildren();
        previousFocus?.focus();
        resolve(value);
      },{once:true});
      region.append(button);
      if(!value)button.focus();
    }
  });
}
