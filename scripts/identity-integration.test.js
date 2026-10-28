import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const header=readFileSync('_includes/components/header.njk','utf8');
const app=readFileSync('src/scripts/ui/app.js','utf8');
const layout=readFileSync('_includes/layouts/base.njk','utf8');
test('Avatar et menu Web Awesome pour le compte Google',()=>{
  assert.match(header,/<wa-avatar id="profileAvatar"/);
  assert.match(header,/<wa-dropdown id="profileMenu"/);
  assert.match(header,/Connexion Google/);
  assert.match(header,/Se déconnecter/);
  assert.match(app,/sessionState.user/);
});
test('Marge ne charge plus Google Identity Services ou les anciens modules Drive',()=>{
  assert.doesNotMatch(layout,/accounts\.google\.com\/gsi\/client/);
  assert.doesNotMatch(app,/google-auth\.js|drive-api\.js|cloud-sync\.js/);
  assert.match(app,/synchronizeIdentity/);
  assert.match(app,/identityApi\.getSession/);
});
