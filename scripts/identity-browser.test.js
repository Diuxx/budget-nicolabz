import test from 'node:test';
import assert from 'node:assert/strict';

function fakeNode() {
  const attrs=new Map();
  return {
    dataset: {}, classList: {toggle:()=>{}}, hidden:false, innerHTML:'', textContent:'', title:'',
    addEventListener:()=>{}, setAttribute:(k,v)=>attrs.set(k,String(v)),
    removeAttribute:k=>attrs.delete(k), getAttribute:k=>attrs.get(k),
  };
}

test('Le retour OAuth met à jour l’avatar et le statut depuis GET /api/session',async()=>{
  const elements=new Map();
  const get=selector=>{if(!elements.has(selector))elements.set(selector,fakeNode());return elements.get(selector);};
  const initialUrl='http://localhost:8081/?auth=connected#dashboard';
  let cleanedUrl=null;
  let sessionRequestCount=0;
  globalThis.fetch=async url=>{
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
    querySelector:get,
    querySelectorAll:()=>[],
    addEventListener:()=>{},
  };
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  globalThis.window={addEventListener:()=>{},scrollTo:()=>{}};
  await import('../src/scripts/ui/app.js?identity-browser-test');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('#profileName').textContent,'Compte de démonstration');
  assert.equal(get('#connection-status').textContent,'Drive connecté');
  assert.equal(get('#profileAvatar').getAttribute('image'),'https://lh3.googleusercontent.com/photo');
  assert.equal(get('#profileLogout').hidden,false);
  assert.equal(cleanedUrl,'/#dashboard');
  assert.equal(sessionRequestCount,1);
});
