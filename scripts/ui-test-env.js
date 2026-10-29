import {createBudgetDemo} from '../src/scripts/core/period-model.js';
export function environment(view='budget',input=createBudgetDemo()){
  const main={innerHTML:''},toast={textContent:'',className:''},listeners={},controls={};
  const values=new Map([['marge:budget:v4',JSON.stringify(input)],['marge:selected-period',input.periods[0]?.date||'2028-01']]);
  const generic={addEventListener(){},setAttribute(){},removeAttribute(){},dataset:{},innerHTML:''};
  const form={addEventListener(name,callback){this[name]=callback;},querySelector(selector){return controls[selector.match(/name="([^"]+)"/)[1]];}};
  const dialog={open:false,set innerHTML(html){this.html=html;for(const match of html.matchAll(/<wa-(?:input|select|textarea)\b([^>]+)>/g)){
    const attrs=match[1],name=attrs.match(/name="([^"]+)"/)?.[1];if(name)controls[name]={value:attrs.match(/value="([^"]*)"/)?.[1]??'',style:{},disabled:false,addEventListener(event,callback){this[event]=callback;}};
  }},querySelector(selector){return selector==='form'?form:selector.startsWith('[name=')?form.querySelector(selector):generic;}};
  const resetControls={
    '#resetDriveChoice':{checked:false,disabled:false},
    '#resetConfirmation':{value:'',addEventListener(){}},
    '#confirmFullReset':{disabled:true},
  };
  const resetDialog={open:false,querySelector:selector=>resetControls[selector]};
  globalThis.document={querySelector:selector=>selector==='#app'?main:selector==='#modal'?dialog:selector==='#resetDialog'?resetDialog:selector==='#toast'?toast:selector==='#copyPrevious'?{checked:true}:['#driveStatus','#driveMeta','#profileAvatar'].includes(selector)?null:generic,querySelectorAll:()=>[],addEventListener:(name,callback)=>{listeners[name]=callback;}};
  globalThis.localStorage={get length(){return values.size;},key:index=>Array.from(values.keys())[index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  globalThis.location={hash:'#'+view,href:'http://localhost:8081/#'+view,hostname:'localhost',origin:'http://localhost:8081',pathname:'/'};
  globalThis.history={replaceState(){}};globalThis.window={addEventListener(){},scrollTo(){}};globalThis.confirm=()=>true;
  return {main,toast,controls,dialog,resetDialog,resetControls,form,values,
    saved:()=>JSON.parse(values.get('marge:budget:v4')),
    action(name,id,extra={}){const target={dataset:{action:name,id,...extra},closest:selector=>selector==='[data-action]'?target:null};listeners.click({target});},
    change(target){listeners.change({target});},submit(){form.submit({preventDefault(){},currentTarget:form});}};
}
