import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetDemo } from '../src/scripts/core/period-model.js';

function fakeNode() {
  const attrs=new Map();
  return {
    dataset: {}, classList: {toggle:()=>{}}, hidden:false, innerHTML:'', textContent:'', title:'',
    addEventListener:()=>{}, setAttribute:(k,v)=>attrs.set(k,String(v)),
    removeAttribute:k=>attrs.delete(k), getAttribute:k=>attrs.get(k),
  };
}

test('Le retour OAuth récupère Drive puis synchronise automatiquement les modifications',async()=>{
  const elements=new Map();
  const get=selector=>{if(!elements.has(selector))elements.set(selector,fakeNode());return elements.get(selector);};
  const initialUrl='http://localhost:8081/?auth=connected#dashboard';
  const controls=new Map();
  const resetDialog={querySelector:selector=>{if(!controls.has(selector))controls.set(selector,fakeNode());return controls.get(selector);}};
  let cleanedUrl=null;
  let sessionRequestCount=0;
  const remoteBudget=createBudgetDemo();
  let version=1;
  let savedBudget;
  let synced;
  const syncComplete=new Promise(resolve=>{synced=resolve;});
  let saved;
  const saveComplete=new Promise(resolve=>{saved=resolve;});
  const stored=new Map();
  globalThis.fetch=async (url,options)=>{
    if(String(url).includes('/api/sync/pecule')){
      if(options.method==='PUT'){
        const request=JSON.parse(options.body);
        assert.equal(request.version,version);
        savedBudget=request.data;
        return {ok:true,status:200,json:async()=>({version:++version})};
      }
      return {ok:true,status:200,json:async()=>({version,data:remoteBudget})};
    }
    assert.match(String(url),/http:\/\/localhost:3000\/api\/session/);
    sessionRequestCount++;
    return {ok:true,status:200,json:async()=>({
      authenticated:true,
      user:{id:7,name:'Compte de démonstration',email:'exemple@gmail.com',picture:'https://lh3.googleusercontent.com/photo'},
      driveConnected:true,
    })};
  };
  globalThis.location={href:initialUrl,origin:'http://localhost:8081',hostname:'localhost',pathname:'/',search:'?auth=connected',hash:'#dashboard'};
  globalThis.history={replaceState:(_a,_b,url)=>{cleanedUrl=url;}};
  globalThis.document={
    querySelector:selector=>selector==='#resetDialog'?resetDialog:get(selector),
    querySelectorAll:()=>[],
    addEventListener:()=>{},
  };
  globalThis.localStorage={
    getItem:key=>stored.get(key)??null,
    setItem:(key,value)=>{stored.set(key,value);if(key.startsWith('marge:identity:anchor:')){if(savedBudget)saved();else synced();}},
  };
  const listeners={};
  document.addEventListener=(name,callback)=>{listeners[name]=callback;};
  globalThis.window={addEventListener:()=>{},scrollTo:()=>{}};
  await import('../src/scripts/ui/app.js?identity-browser-test');
  await syncComplete;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('#profileName').textContent,'Compte de démonstration');
  assert.equal(get('#connection-status').textContent,'Drive connecté');
  assert.equal(get('#profileAvatar').getAttribute('image'),'https://lh3.googleusercontent.com/photo');
  assert.equal(get('#profileLogout').hidden,false);
  assert.equal(cleanedUrl,'/#dashboard');
  assert.equal(sessionRequestCount,2);
  assert.deepEqual(JSON.parse(stored.get('pecule:budget:v1')),remoteBudget);
  listeners.change({target:{dataset:{marginThreshold:'warning'},value:'1'}});
  await saveComplete;
  assert.equal(savedBudget.marginThresholds.warning,1);
  assert.equal(version,2);
});
