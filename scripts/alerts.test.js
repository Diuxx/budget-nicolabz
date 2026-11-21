import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmAction, updateNotifications } from '../src/scripts/ui/alerts.js';

function alertEnvironment(){
  const calls=[];
  const container={
    hidden:true,open:false,
    matches:()=>container.open,
    showPopover(){calls.push('show');container.open=true;},
    hidePopover(){calls.push('hide');container.open=false;},
  };
  const toast={visible:false,classList:{contains:()=>toast.visible}};
  const confirmation={
    hidden:true,children:[],
    replaceChildren(){this.children=[];},
    append(element){this.children.push(element);},
  };
  const previousFocus={focused:false,focus(){this.focused=true;}};
  globalThis.document={
    activeElement:previousFocus,
    querySelector(selector){return {'#notifications':container,'#toast':toast,'#confirmation':confirmation}[selector];},
    createElement(){
      return {
        focus(){this.focused=true;},
        addEventListener(event,callback){this[event]=callback;},
      };
    },
  };
  return {calls,container,toast,confirmation,previousFocus};
}

test('notification and confirmation share the floating layer until both are closed',()=>{
  const {calls,container,toast,confirmation}=alertEnvironment();
  toast.visible=true;updateNotifications();
  assert.equal(container.hidden,false);
  assert.deepEqual(calls,['show']);
  confirmation.hidden=false;updateNotifications();
  toast.visible=false;updateNotifications();
  assert.equal(container.open,true);
  updateNotifications(true);
  assert.deepEqual(calls,['show','hide','show']);
  confirmation.hidden=true;updateNotifications();
  assert.equal(container.hidden,true);
  assert.equal(container.open,false);
});

test('confirmation remains open until answered and restores focus',async()=>{
  const {container,confirmation,previousFocus}=alertEnvironment();
  const result=confirmAction('Supprimer cette ligne ?');
  const [message,cancel,confirm]=confirmation.children;
  assert.equal(message.textContent,'Supprimer cette ligne ?');
  assert.equal(container.open,true);
  assert.equal(cancel.focused,true);
  assert.equal(await confirmAction('Autre confirmation'),false);
  confirm.click();
  assert.equal(await result,true);
  assert.equal(confirmation.hidden,true);
  assert.equal(container.open,false);
  assert.equal(previousFocus.focused,true);
});
