import test from 'node:test';
import assert from 'node:assert/strict';
import { renderIdentityProfile, parseIdentitySession } from '../src/scripts/ui/identity-profile.js';
import { createIdentityController } from '../src/scripts/ui/identity-controller.js';
import { createEmptyBudget } from '../src/scripts/core/period-model.js';

function createDom() {
  const nodes = new Map();
  const selectors = [
    '#profileAvatar', '#saveIndicator', '#connection-status', '#profileName', '#profileEmail',
    '#profileDriveState', '#profileLogin', '#profileLogout', '#profileLogoutDivider', '#profileImport', '#profileExport',
  ];
  for (const selector of selectors) {
    const attrs = new Map();
    nodes.set(selector, {
      dataset: {}, hidden: false, textContent: '', title: '',
      setAttribute: (key, value) => attrs.set(key, String(value)),
      removeAttribute: key => attrs.delete(key),
      getAttribute: key => attrs.get(key),
    });
  }
  return { root: { querySelector: selector => nodes.get(selector) ?? null }, get: selector => nodes.get(selector) };
}

const googlePayload = {
  authenticated: true, user: {
    id: 1, name: 'Exemple Dupont', email: 'exemple@gmail.com',
    picture: 'https://lh3.googleusercontent.com/example',
  }, driveConnected: true,
};

test('Accepte un id numérique SQLite dans la session Google', () => {
  assert.deepEqual(parseIdentitySession(googlePayload), googlePayload);
  assert.equal(parseIdentitySession({authenticated:true,user:{id:null}}).authenticated, false);
  assert.equal(parseIdentitySession({authenticated:false,user:googlePayload.user}).authenticated, false);
});

test('L’avatar et les informations reflètent une session Google + Drive connectée', () => {
  const {root,get}=createDom();
  renderIdentityProfile(root,{session:parseIdentitySession(googlePayload)});
  assert.equal(get('#profileAvatar').getAttribute('image'), googlePayload.user.picture);
  assert.equal(get('#profileAvatar').getAttribute('initials'), 'ED');
  assert.equal(get('#profileName').textContent, 'Exemple Dupont');
  assert.equal(get('#profileEmail').textContent, 'exemple@gmail.com');
  assert.equal(get('#connection-status').textContent, 'Drive connecté');
  assert.equal(get('#profileLogout').hidden, false);
  assert.equal(get('#profileLogin').hidden, true);
  assert.equal(get('#saveIndicator').dataset.state, 'connected');
});

test('Une modification locale apparaît comme à synchroniser sans prétendre être dans Drive', () => {
  const {root,get}=createDom();
  renderIdentityProfile(root,{session:googlePayload,locallyModified:true});
  assert.equal(get('#connection-status').textContent, 'À synchroniser');
  assert.match(get('#profileDriveState').textContent, /modifications locales/);
});

test('La synchronisation affiche la sauvegarde en cours puis rétablit le statut Drive', () => {
  const {root,get}=createDom();
  renderIdentityProfile(root,{session:googlePayload,locallyModified:true,syncing:true});
  assert.equal(get('#saveIndicator').dataset.state,'syncing');
  assert.equal(get('#connection-status').textContent,'Sauvegarde en cours…');
  renderIdentityProfile(root,{session:googlePayload});
  assert.equal(get('#saveIndicator').dataset.state,'connected');
  assert.equal(get('#connection-status').textContent,'Drive connecté');
});

test('La déconnexion masque les actions privées et supprime la photo', () => {
  const {root,get}=createDom();
  renderIdentityProfile(root,{session:googlePayload});
  renderIdentityProfile(root,{session:{authenticated:false,user:null,driveConnected:false}});
  assert.equal(get('#profileAvatar').getAttribute('image'), undefined);
  assert.equal(get('#connection-status').textContent, 'Mode local');
  assert.equal(get('#profileLogout').hidden, true);
  assert.equal(get('#profileLogin').hidden, false);
});

test('Une réponse API indisponible ne doit pas être présentée comme une déconnexion certaine', () => {
  const {root,get}=createDom();
  renderIdentityProfile(root,{session:{authenticated:false,user:null,driveConnected:false},error:'API inaccessible'});
  assert.equal(get('#saveIndicator').dataset.state,'error');
  assert.equal(get('#connection-status').textContent,'Service indisponible');
  assert.match(get('#profileEmail').textContent,/API inaccessible/);
});

test('La photo ne peut provenir que d’une URL HTTPS', () => {
  const {root,get}=createDom();
  renderIdentityProfile(root, {session:{...googlePayload,user:{...googlePayload.user,picture:'javascript:alert(1)'}}});
  assert.equal(get('#profileAvatar').getAttribute('image'), undefined);
});

test('le menu conserve import/export et réserve la déconnexion aux utilisateurs connectés', () => {
  const {root,get}=createDom();
  for(const session of [
    {authenticated:false,user:null,driveConnected:false},
    {...googlePayload,driveConnected:false},
    googlePayload,
    {authenticated:false,user:null,driveConnected:false},
  ]) {
    renderIdentityProfile(root,{session});
    assert.equal(get('#profileImport').hidden,false);
    assert.equal(get('#profileExport').hidden,false);
    assert.equal(get('#profileLogoutDivider').hidden,!session.authenticated);
  }
});

for(const code of ['DRIVE_RECONNECT_REQUIRED','DRIVE_NOT_CONNECTED','DRIVE_ACCESS_DENIED']) test(`${code} avertit et permet de réautoriser Drive dans les paramètres`, async t => {
  const {root,get}=createDom();
  const driveButton={dataset:{action:'auth-drive'},hidden:true,disabled:false,textContent:''};
  const syncButton={dataset:{action:'drive-sync'},hidden:true,disabled:false,textContent:''};
  const status={classList:{toggle(){}},textContent:''};
  root.querySelector=selector=>selector==='#driveStatus'?status:get(selector) ?? null;
  root.querySelectorAll=selector=>selector==='.drive-panel [data-action]'?[driveButton,syncButton]:[];
  let redirect;
  const globals={
    document:root,
    localStorage:{getItem:()=>null},
    location:{href:'http://localhost:8081/',assign:url=>{redirect=url;}},
  };
  for(const [name,value] of Object.entries(globals)){
    const original=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
    t.after(()=>original?Object.defineProperty(globalThis,name,original):delete globalThis[name]);
  }
  let session=googlePayload;
  const connection={busy:false,locallyModified:false,sessionState:{authenticated:false,user:null,driveConnected:false}};
  const messages=[];
  const identityApi={
    appId:'pecule',
    getSession:async()=>session,
    readBudget:async()=>{throw Object.assign(new Error('Autorisation Drive indisponible'),{code});},
    driveConsentUrl:returnTo=>`consent:${returnTo}`,
  };
  const controller=createIdentityController({
    model:{data:createEmptyBudget()},connection,identityApi,syncChoiceDialog:{},
    render(){},showToast:message=>messages.push(message),
  });

  await controller.refreshSession();
  assert.equal(driveButton.hidden,false);
  assert.equal(driveButton.textContent,'Réautoriser Google Drive');
  assert.equal(syncButton.hidden,true);
  await controller.driveAction('auto');
  assert.equal(connection.sessionState.driveConnected,false);
  assert.equal(get('#connection-status').textContent,'Drive à réautoriser');
  assert.equal(get('#profileDriveState').textContent,'Drive à réautoriser dans Paramètres');
  assert.equal(get('#saveIndicator').dataset.state,'attention');
  assert.equal(driveButton.hidden,false);
  assert.equal(syncButton.hidden,true);
  assert.match(status.textContent,/réautorisation Drive requise/);
  assert.match(messages.at(-1),/Réautorisez.*Paramètres/);

  await controller.refreshSession();
  assert.equal(connection.sessionState.driveConnected,false);
  assert.equal(driveButton.hidden,false);
  controller.startDriveConsent();
  assert.equal(redirect,'consent:http://localhost:8081/');

  session={...googlePayload,user:{...googlePayload.user,id:2}};
  await controller.refreshSession();
  assert.equal(connection.sessionState.driveConnected,true);
  assert.equal(get('#connection-status').textContent,'Synchronisation à reprendre');
});

test('Les paramètres proposent une nouvelle tentative uniquement après une erreur de synchronisation', async t => {
  const {root,get}=createDom();
  const driveButton={dataset:{action:'auth-drive'},hidden:true,disabled:false,textContent:''};
  const syncButton={dataset:{action:'drive-sync'},hidden:true,disabled:false,textContent:''};
  const status={classList:{toggle(){}},textContent:''};
  root.querySelector=selector=>selector==='#driveStatus'?status:get(selector) ?? null;
  root.querySelectorAll=selector=>selector==='.drive-panel [data-action]'?[driveButton,syncButton]:[];
  const data=createEmptyBudget();
  const values=new Map([['pecule:budget:v1',JSON.stringify(data)]]);
  const globals={document:root,localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
  for(const [name,value] of Object.entries(globals)){
    const original=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
    t.after(()=>original?Object.defineProperty(globalThis,name,original):delete globalThis[name]);
  }
  let session=googlePayload;
  let fail=true;
  let sessionUnavailable=false;
  const identityApi={
    appId:'pecule',getSession:async()=>{if(sessionUnavailable)throw new Error('Service indisponible');return session;},
    readBudget:async()=>{if(fail)throw new Error('Réseau indisponible');return {version:1,data};},
  };
  const connection={busy:false,locallyModified:false,sessionState:{authenticated:false,user:null,driveConnected:false}};
  const messages=[];
  const controller=createIdentityController({
    model:{data},connection,identityApi,syncChoiceDialog:{},render(){},showToast:message=>messages.push(message),
  });
  await controller.refreshSession();
  assert.equal(syncButton.hidden,true);
  await controller.driveAction('auto');
  assert.equal(syncButton.hidden,false);
  assert.equal(syncButton.disabled,false);
  assert.equal(syncButton.textContent,'Réessayer la synchronisation');
  assert.equal(get('#connection-status').textContent,'Synchronisation à reprendre');
  assert.match(status.textContent,/à reprendre/);
  fail=false;
  await controller.driveAction('auto');
  assert.equal(syncButton.hidden,true);
  assert.equal(get('#connection-status').textContent,'Drive connecté');

  t.mock.method(console,'error',()=>{});
  sessionUnavailable=true;
  await controller.refreshSession();
  assert.equal(syncButton.hidden,false);
  assert.equal(syncButton.disabled,false);
  sessionUnavailable=false;
  await controller.driveAction('auto');
  assert.equal(syncButton.hidden,true);

  session={...googlePayload,driveConnected:false};
  await controller.refreshSession();
  assert.equal(get('#connection-status').textContent,'Drive à réautoriser');
  assert.equal(driveButton.hidden,false);
  assert.equal(driveButton.textContent,'Réautoriser Google Drive');
  assert.match(messages.at(-1),/Accès Drive perdu.*Paramètres/);
});

test('Annuler un conflit laisse la reprise manuelle disponible sans rouvrir le dialogue au focus', async t => {
  const {root,get}=createDom();
  const syncButton={dataset:{action:'drive-sync'},hidden:true,disabled:false,textContent:''};
  root.querySelectorAll=selector=>selector==='.drive-panel [data-action]'?[syncButton]:[];
  root.addEventListener=()=>{};
  const data=createEmptyBudget(),remote=createEmptyBudget();
  remote.accounts[0].name='Autre budget';
  const values=new Map([['pecule:budget:v1',JSON.stringify(data)]]);
  const globals={
    document:root,localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},
    location:{href:'http://localhost:8081/'},history:{replaceState(){}},window:{addEventListener(){}},
  };
  for(const [name,value] of Object.entries(globals)){
    const original=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
    t.after(()=>original?Object.defineProperty(globalThis,name,original):delete globalThis[name]);
  }
  const fields={
    '#syncChoiceText':{textContent:''},
    '[data-sync-choice="remote"]':{hidden:false},
    '[data-sync-choice="local"]':{textContent:''},
  };
  const dialog={
    querySelector:selector=>fields[selector],
    querySelectorAll:()=>[{dataset:{syncChoice:'cancel'},addEventListener:(_event,callback)=>queueMicrotask(callback)}],
    addEventListener(){},
  };
  let reads=0;
  const controller=createIdentityController({
    model:{data},connection:{busy:false,locallyModified:false,sessionState:{authenticated:false,user:null,driveConnected:false}},
    identityApi:{appId:'pecule',getSession:async()=>googlePayload,readBudget:async()=>{reads++;return {version:1,data:remote};}},
    syncChoiceDialog:dialog,render(){},showToast(){},
  });
  await controller.refreshSession();
  controller.startSessionTracking();
  await controller.refreshSession();
  await controller.driveAction('auto');
  assert.equal(reads,1);
  assert.equal(syncButton.hidden,false);
  assert.equal(get('#connection-status').textContent,'Synchronisation à reprendre');
  await controller.refreshSession();
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(reads,1);
});
