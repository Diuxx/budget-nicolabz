import test from 'node:test';
import assert from 'node:assert/strict';
import { IdentityApi, IdentityApiError } from '../src/scripts/services/identity-api.js';
import { decideIdentitySync, synchronizeIdentity, getIdentitySyncInfo } from '../src/scripts/services/identity-sync.js';
import { createBudgetDemo as createDemoData } from '../src/scripts/core/period-model.js';

function memoryStorage() {
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}
function fakeApi(remote, onWrite=()=>{}) {
  return {
    appId:'budget',
    readBudget:async()=>structuredClone(remote),
    saveBudget:async(version,data)=>{
      onWrite(version,data);
      if(version!==remote.version) throw new IdentityApiError('Conflit serveur','SYNC_CONFLICT',409);
      remote.data=structuredClone(data);
      remote.version++;
      return {version:remote.version,data};
    },
  };
}
const params=(api,storage,data,choice=()=>Promise.resolve('cancel'))=>({
  api,storage,userId:'userA',getData:()=>data,choose:choice,setData:newData=>{Object.assign(data,newData);},
});

test('Nicolabz Identity : URLs de connexion et consentement avec retour contrôlé',()=>{
  const api=new IdentityApi({baseUrl:'https://auth.nicolabz.dev',appId:'budget',fetchFunction:async()=>{}});
  const url=new URL(api.loginUrl('https://budget.nicolabz.dev/#dashboard'));
  assert.equal(url.pathname,'/auth/google/start');
  assert.equal(url.searchParams.get('app'),'budget');
  assert.equal(url.searchParams.get('return_to'),'https://budget.nicolabz.dev/#dashboard');
  assert.equal(new URL(api.driveConsentUrl('https://budget.nicolabz.dev/')).pathname,'/auth/drive/start');
});

test('Session : cookie HttpOnly envoyé uniquement via credentials, avatar reçu de l’API',async()=>{
  let seen;
  const api=new IdentityApi({baseUrl:'http://localhost:3000',appId:'budget',fetchFunction:async(url,options)=>{
    seen={url:url.href,...options};
    return new Response(JSON.stringify({authenticated:true,user:{id:'u1',name:'N',email:'n@example.com',picture:'https://example.com/a.png'},driveConnected:true}),{status:200});
  }});
  const session=await api.getSession();
  assert.equal(seen.credentials,'include');
  assert.match(seen.url,/\/api\/session$/);
  assert.equal(session.user.picture,'https://example.com/a.png');
});

test('Sauvegarde : PUT versionné dans le namespace budget',async()=>{
  let options;
  const api=new IdentityApi({baseUrl:'http://localhost:3000',appId:'budget',fetchFunction:async(url,config)=>{
    options={url:url.href,...config};return new Response('{"version":4}',{status:200});
  }});
  await api.saveBudget(3,{hello:'budget'});
  assert.equal(options.method,'PUT');
  assert.deepEqual(JSON.parse(options.body),{version:3,data:{hello:'budget'}});
  assert.equal(options.headers['Content-Type'],'application/json');
  assert.match(options.url,/\/api\/sync\/budget$/);
});

test('Erreurs structurées : 409 et refus d’origine visibles',async()=>{
  const api=new IdentityApi({baseUrl:'http://localhost:3000',appId:'budget',fetchFunction:async()=>new Response(JSON.stringify({error:{code:'SYNC_CONFLICT',message:'Version périmée'}}),{status:409})});
  await assert.rejects(api.readBudget(),error=>error.status===409&&error.code==='SYNC_CONFLICT');
  assert.throws(()=>new IdentityApi({baseUrl:'http://192.168.1.12:3000',appId:'budget'}),/HTTPS/);
});

test('Planification : la première synchronisation de deux données différentes requiert un choix',()=>{
  assert.equal(decideIdentitySync({anchor:null,remoteVersion:2,localDigest:'A',remoteDigest:'B'}),'conflict');
  assert.equal(decideIdentitySync({anchor:{version:2,digest:'A'},remoteVersion:2,localDigest:'B',remoteDigest:'A'}),'local');
  assert.equal(decideIdentitySync({anchor:{version:2,digest:'A'},remoteVersion:3,localDigest:'A',remoteDigest:'B'}),'remote');
  assert.equal(decideIdentitySync({anchor:{version:2,digest:'A'},remoteVersion:3,localDigest:'B',remoteDigest:'C'}),'conflict');
});

test('Drive vide : création sur confirmation avec version 0',async()=>{
  const local=createDemoData(),storage=memoryStorage(),remote={version:0,data:null};
  let wrote;
  const api=fakeApi(remote,(version,data)=>{wrote={version,data};});
  const outcome=await synchronizeIdentity(params(api,storage,local,async()=> 'local'));
  assert.equal(outcome,'created');
  assert.equal(wrote.version,0);
  assert.equal(remote.version,1);
  assert.equal(getIdentitySyncInfo({storage,appId:'budget',userId:'userA'}).version,1);
});

test('Deux appareils : téléchargement seulement après consentement si pas de point de référence',async()=>{
  const local=createDemoData(),remoteData=createDemoData();
  remoteData.periods[0].minMargin=9999;
  const remote={version:4,data:remoteData},storage=memoryStorage();
  let request;
  const outcome=await synchronizeIdentity(params(fakeApi(remote),storage,local,async choice=>{request=choice;return 'remote';}));
  assert.equal(request.type,'conflict');
  assert.equal(outcome,'downloaded');
  assert.equal(local.periods[0].minMargin,9999);
});

test('Refus de conflit : aucune donnée remplacée',async()=>{
  const local=createDemoData(),remoteData=createDemoData();remoteData.periods[0].minMargin=42;
  const remote={version:8,data:remoteData};
  let write=false;
  const outcome=await synchronizeIdentity(params(fakeApi(remote,()=>{write=true;}),memoryStorage(),local,async()=> 'cancel'));
  assert.equal(outcome,'cancel');assert.equal(write,false);
});

test('Conflit concurrent 409 : pas de réécriture silencieuse',async()=>{
  const local=createDemoData(),remote={version:0,data:null},storage=memoryStorage();
  const api=fakeApi(remote);
  api.saveBudget=async()=>{throw new IdentityApiError('Version changée','SYNC_CONFLICT',409);};
  await assert.rejects(synchronizeIdentity(params(api,storage,local,async()=> 'local')),error=>error.code==='SYNC_CONFLICT');
  assert.equal(getIdentitySyncInfo({storage,appId:'budget',userId:'userA'}),null);
});

test('Ancres différentes pour des utilisateurs différents',async()=>{
  const local=createDemoData(),storage=memoryStorage();
  await synchronizeIdentity(params(fakeApi({version:0,data:null}),storage,local,async()=> 'local'));
  assert.equal(getIdentitySyncInfo({storage,appId:'budget',userId:'userB'}),null);
});

test('Conservation du budget local : aucune opération API ne supprime localStorage',async()=>{
  const storage=memoryStorage(),local=createDemoData();
  await synchronizeIdentity(params(fakeApi({version:0,data:null}),storage,local,async()=> 'cancel'));
  assert.equal(getIdentitySyncInfo({storage,appId:'budget',userId:'userA'}),null);
  assert.equal(local.version,4);
});


test('Régression Chromium : fetch garde le contexte Window et affiche la session connectée', async () => {
  let actualUrl;
  function browserLikeFetch(url, options) {
    // Reproduit l'exigence du fetch natif de Chromium (Web IDL).
    assert.equal(this, globalThis);
    assert.equal(options.credentials, 'include');
    actualUrl = String(url);
    return Promise.resolve(new Response(JSON.stringify({
      authenticated: true,
      driveConnected: true,
      user: { id: 1, name: 'Compte Google', email: 'test@example.com', picture: 'https://example.com/avatar.jpg' },
    }), { status: 200 }));
  }
  const api = new IdentityApi({ baseUrl: 'http://localhost:3000', appId: 'budget', fetchFunction: browserLikeFetch });
  const session = await api.getSession();
  assert.match(actualUrl, /localhost:3000\/api\/session$/);
  assert.equal(session.authenticated, true);
  assert.equal(session.driveConnected, true);
  assert.equal(session.user.id, 1);
});

test('Une erreur réseau préserve la cause pour faciliter le diagnostic', async () => {
  const problem = new TypeError('Failed to fetch');
  const api = new IdentityApi({
    baseUrl: 'http://localhost:3000',
    appId: 'budget',
    fetchFunction() { throw problem; },
  });
  await assert.rejects(api.getSession(), error => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.cause, problem);
    return true;
  });
});
