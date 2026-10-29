import test from 'node:test';import assert from 'node:assert/strict';
import {environment} from './ui-test-env.js';
import {createEmptyBudget} from '../src/scripts/core/period-model.js';

test('budget : prévu et réel, comptes, sans objectif minimal',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?budget-refactor');
  assert.ok(env.main.innerHTML.includes('Entrées d’argent'));assert.ok(env.main.innerHTML.includes('Dépenses et épargne'));
  assert.ok(env.main.innerHTML.includes('Réel saisi'));assert.ok(env.main.innerHTML.includes('À renseigner'));
  assert.doesNotMatch(env.main.innerHTML,/Marge minimale souhaitée|data-field="min-margin"/);
});
test('navigation sur un mois absent : aucun budget créé sans action',async()=>{
  const env=environment('budget',createEmptyBudget());await import('../src/scripts/ui/app.js?empty-refactor');
  env.action('next-month');assert.equal(env.saved().periods.length,0);assert.ok(env.main.innerHTML.includes('Préparons Février 2028'));
});
test('dashboard, annuel, journal, projets et paramètres utilisent le nouveau modèle',async()=>{
  for(const [view,text] of [['dashboard','Répartition par compte'],['analytics','Mois à préparer'],['transactions','Journal du mois'],['projects','demandes de financement'],['accounts','Compte principal'],['settings','Types de revenus']]){
    const env=environment(view);await import('../src/scripts/ui/app.js?refactor-'+view);assert.ok(env.main.innerHTML.includes(text),view);
  }
});

test('la vue annuelle retire la colonne Objectif minimal tout en affichant les marges',async()=>{
  const env=environment('analytics');
  await import('../src/scripts/ui/app.js?annual-without-target');
  assert.match(env.main.innerHTML,/Marge prévue/);
  assert.match(env.main.innerHTML,/Marge réelle saisie/);
  assert.doesNotMatch(env.main.innerHTML,/Objectif minimal|Marge minimale|data-field="min-margin"/);
  assert.match(env.main.innerHTML,/colspan="4" class="muted"/);
});

test('l’ancien seuil conservé dans une sauvegarde v4 ne s’affiche plus et ne change pas la marge',async()=>{
  const demo=(await import('../src/scripts/core/period-model.js')).createBudgetDemo();
  demo.periods[0].minMargin=10000;
  const env=environment('budget',demo);
  await import('../src/scripts/ui/app.js?legacy-without-target');
  assert.doesNotMatch(env.main.innerHTML,/Marge minimale|Objectif minimal|data-field="min-margin"/);
  assert.match(env.main.innerHTML,/Marge disponible/);
  assert.equal(env.saved().periods[0].minMargin,10000);
});

test('paramètres : le modèle, le schéma et la remise à zéro sont visibles',async()=>{
  const env=environment('settings');await import('../src/scripts/ui/app.js?reset-setting-ui');
  assert.match(env.main.innerHTML,/Télécharger le modèle JSON/);
  assert.match(env.main.innerHTML,/Télécharger le schéma de validation/);
  assert.match(env.main.innerHTML,/Réinitialiser toutes mes données/);
  env.action('reset-open');
  assert.equal(env.resetDialog.open,true);
  assert.equal(env.resetControls['#confirmFullReset'].disabled,true);
  assert.equal(env.resetControls['#resetDriveChoice'].disabled,true);
  env.action('reset-cancel');
  assert.equal(env.resetDialog.open,false);
});

test('interface : remise à zéro complète en mode local après saisie de EFFACER',async()=>{
  const env=environment('settings');await import('../src/scripts/ui/app.js?reset-confirm-ui');
  env.values.set('marge:budget:v2','ancienne valeur');
  env.action('reset-open');
  env.resetControls['#resetConfirmation'].value='EFFACER';
  env.action('reset-confirm');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(env.saved().periods.length,0);
  assert.equal(env.saved().projects.length,0);
  assert.equal(env.saved().accounts.length,1);
  assert.equal(env.values.has('marge:budget:v2'),false);
  assert.match(env.toast.textContent,/réinitialisées/);
});
