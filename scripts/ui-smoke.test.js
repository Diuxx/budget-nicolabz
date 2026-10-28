import test from 'node:test';
import assert from 'node:assert/strict';

function prepareEnvironment(view) {
  const main={innerHTML:''};
  globalThis.document={
    querySelector:selector=>selector==='#app'?main:selector==='#driveStatus'||selector==='#driveMeta'||selector==='#profileAvatar'?null:({addEventListener:()=>{},setAttribute:()=>{},removeAttribute:()=>{},dataset:{},innerHTML:'',className:''}),
    querySelectorAll:()=>[],
    addEventListener:()=>{},
  };
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  globalThis.location={hash:`#${view}`,href:`http://localhost:8080/#${view}`,hostname:'localhost',origin:'http://localhost:8080',pathname:'/'};
  globalThis.history={replaceState:()=>{}};
  globalThis.window={addEventListener:()=>{},scrollTo:()=>{}};
  return main;
}

test('HTML du dashboard : comptes, projets et composants Web Awesome',async()=>{
  const main=prepareEnvironment('dashboard');
  await import('../src/scripts/ui/app.js?dashboard');
  assert.match(main.innerHTML,/Comptes annexes/);
  assert.match(main.innerHTML,/Projets de financement/);
  assert.match(main.innerHTML,/wa-progress-bar/);
  assert.match(main.innerHTML,/wa-button/);
  assert.doesNotMatch(main.innerHTML,/Liste de courses|Planification des repas/);
});

test('HTML des paramètres : stockage local, Google Drive et import\/export',async()=>{
  const main=prepareEnvironment('settings');
  await import('../src/scripts/ui/app.js?settings');
  assert.match(main.innerHTML,/Google Drive · synchronisation/);
  assert.match(main.innerHTML,/drive-sync/);
  assert.match(main.innerHTML,/drive-pull/);
  assert.match(main.innerHTML,/drive-push/);
  assert.match(main.innerHTML,/data-action="export"/);
  assert.match(main.innerHTML,/data-action="import"/);
});


test('HTML des analyses : marge en courbe SVG et douze points',async()=>{
  const main=prepareEnvironment('analytics');
  await import('../src/scripts/ui/app.js?analytics');
  assert.match(main.innerHTML,/Marge par mois/);
  assert.match(main.innerHTML,/<polyline class="margin-path"/);
  assert.equal((main.innerHTML.match(/class="margin-point /g)||[]).length,12);
  assert.doesNotMatch(main.innerHTML,/class="margin-list"/);
});


test('Dashboard : deux courbes SVG et des points revenus et dépenses', async () => {
  const main=prepareEnvironment('dashboard');
  await import('../src/scripts/ui/app.js?dashboard-v6');
  assert.match(main.innerHTML, /Revenus vs\. dépenses/);
  assert.match(main.innerHTML, /income-expense-line income-series/);
  assert.match(main.innerHTML, /income-expense-line expense-series/);
  assert.match(main.innerHTML, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(main.innerHTML, /<rect[^>]+title="[^"]*revenus/);
});
