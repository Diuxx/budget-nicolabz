import test from 'node:test';import assert from 'node:assert/strict';
import {environment} from './ui-test-env.js';
import {createEmptyBudget} from '../src/scripts/core/period-model.js';

test('budget : tableaux réunis sans cartes de synthèse',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?budget-refactor');
  assert.match(env.main.innerHTML,/<div class="budget-ledgers">[\s\S]*Entrées d’argent[\s\S]*Dépenses et épargne/);
  assert.match(env.main.innerHTML,/aria-label="Liste des revenus" tabindex="0"/);
  assert.match(env.main.innerHTML,/aria-label="Liste des dépenses" tabindex="0"/);
  assert.match(env.main.innerHTML,/class="nz-table nz-table-compact nz-table-sticky period-table" aria-label="Entrées d’argent" data-kind="income"/);
  assert.match(env.main.innerHTML,/class="nz-table nz-table-compact nz-table-sticky period-table" aria-label="Dépenses et épargne" data-kind="expense"/);
  assert.match(env.main.innerHTML,/data-action="add-income" aria-label="Ajouter un revenu"><svg[^>]*aria-hidden="true">[\s\S]*?<\/svg>Revenue<\/button>/);
  assert.match(env.main.innerHTML,/data-action="add-expense" aria-label="Ajouter une dépense"><svg[^>]*aria-hidden="true">[\s\S]*?<\/svg>Dépense<\/button>/);
  assert.match(env.main.innerHTML,/<th scope="col" class="nz-table-align-end">Ecart<\/th>/);
  assert.match(env.main.innerHTML,/<th scope="col" class="nz-table-align-end">Disponible<\/th>/);
  assert.equal((env.main.innerHTML.match(/<th scope="col" class="nz-table-align-end">Actions<\/th>/g)||[]).length,2);
  assert.match(env.main.innerHTML,/data-action="record-income"[^>]*aria-label="Pointer Épargne de précaution" title="Pointer Épargne de précaution"/);
  assert.match(env.main.innerHTML,/data-action="record-expense"[^>]*aria-label="Pointer Alimentation" title="Pointer Alimentation"/);
  assert.match(env.main.innerHTML,/data-action="record-income"[^>]*title="Pointer Épargne de précaution"><svg[^>]*>[\s\S]*?<\/svg><\/button>/);
  assert.match(env.main.innerHTML,/data-action="record-expense"[^>]*title="Pointer Alimentation"><svg[^>]*>[\s\S]*?<\/svg><\/button>/);
  assert.match(env.main.innerHTML,/<tr data-budget-entry="income" data-id="demo-salary">[\s\S]*?data-action="record-income"[^>]*title="Pointer/);
  assert.match(env.main.innerHTML,/<button type="button" class="entry-mobile-open" data-action="record-expense"[^>]*aria-label="Pointer Alimentation"/);
  assert.doesNotMatch(env.main.innerHTML,/data-action="edit-(?:income|expense)"/);
  assert.match(env.main.innerHTML,/<span class="unrecorded-text">À renseigner<\/span><span class="unrecorded-short" aria-hidden="true">\?<\/span>/);
  assert.match(env.main.innerHTML,/<th scope="row" colspan="2" class="ledger-label-wide">Compte principal<\/th><th scope="row" class="ledger-label-mobile">Compte principal<\/th>/);
  const expenseTable=env.main.innerHTML.match(/<table[^>]*data-kind="expense"[\s\S]*?<\/table>/)[0];
  assert.match(expenseTable,/<th scope="row" colspan="2" class="ledger-label-wide">Compte principal<\/th><th scope="row" class="ledger-label-mobile">Compte principal<\/th>/);
  assert.doesNotMatch(env.main.innerHTML,/Sous-total/);
  assert.doesNotMatch(env.main.innerHTML,/class="period-metrics"|class="recording-note"/);
  assert.ok(env.main.innerHTML.includes('À renseigner'));
  assert.doesNotMatch(env.main.innerHTML,/Marge minimale souhaitée|data-field="min-margin"/);
});
test('navigation sur un mois absent : aucun budget créé sans action',async()=>{
  const env=environment('budget',createEmptyBudget());await import('../src/scripts/ui/app.js?empty-refactor');
  env.action('next-month');assert.equal(env.saved().periods.length,0);assert.ok(env.main.innerHTML.includes('Préparons Février 2028'));
  assert.match(env.main.innerHTML,/class="panel period-empty budget-period-empty"/);
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
  const env=environment('dashboard',demo);
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
