import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const header=readFileSync('_includes/components/header.njk','utf8');
const app=readFileSync('src/scripts/ui/identity-controller.js','utf8');
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

test('les actions de sauvegarde se trouvent uniquement dans le menu utilisateur du header',()=>{
  const menuStart=header.indexOf('<wa-dropdown id="profileMenu"');
  assert.ok(menuStart>=0);
  assert.doesNotMatch(header.slice(0,menuStart),/data-action="(?:import|export|drive-sync)"|driveTopButton/);
  const menu=header.slice(menuStart);
  assert.match(menu,/<wa-dropdown-item id="profileImport" value="import">/);
  assert.match(menu,/<wa-dropdown-item id="profileExport" value="export">/);
  assert.match(menu,/<wa-dropdown-item id="profileSync" value="drive-sync" hidden>/);
});
