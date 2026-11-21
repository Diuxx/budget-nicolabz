export function updateNotifications(raise=false){
  const container=document.querySelector('#notifications');
  const visible=!document.querySelector('#confirmation').hidden||document.querySelector('#toast').classList.contains('visible');
  container.hidden=!visible;
  if(typeof container.showPopover!=='function')return;
  const open=container.matches(':popover-open');
  if(open&&(!visible||raise))container.hidePopover();
  if(visible&&(!open||raise))container.showPopover();
}

export function confirmAction(message){
  return new Promise(resolve=>{
    const region=document.querySelector('#confirmation');
    if(!region||!region.hidden){resolve(false);return;}
    const previousFocus=document.activeElement;
    region.replaceChildren();
    const text=document.createElement('p');
    text.textContent=message;
    region.append(text);
    region.hidden=false;
    let cancelButton;
    for(const [label,value] of [['Annuler',false],['Confirmer',true]]){
      const button=document.createElement('button');
      button.type='button';
      button.className=`button button-${value?'primary':'secondary'} button-compact`;
      button.textContent=label;
      button.addEventListener('click',()=>{
        region.hidden=true;
        region.replaceChildren();
        updateNotifications();
        previousFocus?.focus();
        resolve(value);
      },{once:true});
      region.append(button);
      if(!value)cancelButton=button;
    }
    updateNotifications();
    cancelButton.focus();
  });
}
