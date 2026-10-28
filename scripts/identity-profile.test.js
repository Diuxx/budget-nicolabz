import test from 'node:test';
import assert from 'node:assert/strict';
import { renderIdentityProfile, parseIdentitySession } from '../src/scripts/ui/identity-profile.js';

function createDom() {
  const nodes = new Map();
  const selectors = [
    '#profileAvatar', '#saveIndicator', '#connection-status', '#profileName', '#profileEmail',
    '#profileDriveState', '#profileLogin', '#profileDriveConnect', '#profileSync',
    '#profileLogout', '#profileRefresh', '#driveTopButton',
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
  assert.equal(get('#profileSync').hidden, false);
  assert.equal(get('#saveIndicator').dataset.state, 'connected');
});

test('Une modification locale apparaît comme à synchroniser sans prétendre être dans Drive', () => {
  const {root,get}=createDom();
  renderIdentityProfile(root,{session:googlePayload,locallyModified:true});
  assert.equal(get('#connection-status').textContent, 'À synchroniser');
  assert.match(get('#profileDriveState').textContent, /modifications locales/);
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
