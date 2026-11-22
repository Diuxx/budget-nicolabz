import test from 'node:test';import assert from 'node:assert/strict';
import {environment} from './ui-test-env.js';
import {createBudgetDemo,createPeriod,shiftPeriod} from '../src/scripts/core/period-model.js';
import {euro} from '../src/scripts/core/model.js';

for(const scenario of ['creation','confirmation','annulation']){
  test(`report du budget : ${scenario}`,async()=>{
    const data=createBudgetDemo(),source=data.periods[0],nextDate=shiftPeriod(source.date,1);
    if(scenario!=='creation'){
      const next=createPeriod(data,nextDate);
      next.incomes[0].plannedAmount=123;
      next.incomes[0].realAmount=456;
    }
    const env=environment('budget',data,scenario==='annulation'?'Annuler':'Confirmer');
    await import(`../src/scripts/ui/app.js?carry-budget-${scenario}`);
    assert.match(env.main.innerHTML,/data-action="carry-budget"/);
    env.action('carry-budget');
    await new Promise(resolve=>setImmediate(resolve));
    if(scenario==='annulation'){
      assert.deepEqual(env.saved(),data);
      assert.equal(env.values.get('marge:selected-period'),source.date);
      return;
    }
    const saved=env.saved();
    assert.equal(saved.periods.length,2);
    assert.deepEqual(saved.periods[0],source);
    const target=saved.periods[1];
    assert.equal(target.date,nextDate);
    assert.equal(target.incomes[0].plannedAmount,source.incomes[0].plannedAmount);
    assert.notEqual(target.incomes[0].id,source.incomes[0].id);
    assert.ok(target.incomes[0].plannedDate.startsWith(nextDate));
    assert.ok([...target.incomes,...target.expenses].every(item=>item.realAmount===null&&item.realDate===null));
    assert.equal(target.expenses[0].incomeId,target.incomes[0].id);
    assert.equal(env.values.get('marge:selected-period'),nextDate);
  });
}

test('la duplication crée une ligne non pointée et conserve le financement',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?duplicate-entry');
  const original=env.saved().periods[0];
  assert.match(env.main.innerHTML,/data-action="duplicate-income"/);
  assert.match(env.main.innerHTML,/data-action="duplicate-expense"/);
  env.action('duplicate-income',original.incomes[0].id);
  env.action('duplicate-expense',original.expenses[0].id);
  const current=env.saved().periods[0];
  for(const key of ['incomes','expenses']){
    const copy=current[key].at(-1),source=original[key][0];
    assert.notEqual(copy.id,source.id);
    assert.deepEqual(copy,{...source,id:copy.id,realAmount:null,realDate:null});
    assert.deepEqual(current[key].slice(0,-1),original[key]);
  }
});

test('création et modification d’un crédit avec son montant à rembourser',async()=>{
  const env=environment('projects');await import('../src/scripts/ui/app.js?credit-project');
  const periods=env.saved().periods;
  env.action('add-project');
  assert.match(env.dialog.html,/<wa-option value="credit"[^>]*>Crédit<\/wa-option>/);
  env.controls.name.value='Crédit auto';
  env.controls.type.value='credit';env.controls.type.change();
  assert.equal(env.controls.target.label,'Montant à rembourser (€)');
  assert.equal(env.controls.saved.disabled,true);
  assert.equal(env.controls.loanAmount.disabled,true);
  env.controls.target.value='12500.50';
  env.controls.saved.value='';
  env.submit();
  assert.equal(env.dialog.open,false);
  let project=env.saved().projects[0];
  assert.equal(project.type,'credit');
  assert.equal(project.target,12500.5);
  assert.equal(project.saved,0);
  assert.deepEqual(env.saved().periods,periods);
  assert.match(env.main.innerHTML,/Crédit auto/);
  assert.match(env.main.innerHTML,/remboursé sur/);
  assert.match(env.main.innerHTML,new RegExp(euro(12500.5)));
  assert.doesNotMatch(env.main.innerHTML,/Projet financé à/);
  assert.match(env.main.innerHTML,new RegExp(`Montant total des objectifs</small><strong>${euro(0)}`));
  env.action('edit-project',project.id);
  assert.equal(env.controls.target.label,'Montant à rembourser (€)');
  env.controls.target.value='0';env.submit();
  project=env.saved().projects[0];
  assert.equal(project.target,0);
  env.action('edit-project',project.id);
  env.controls.type.value='savings';env.controls.type.change();
  assert.equal(env.controls.saved.disabled,false);
  assert.equal(env.controls.target.label,'Montant cible du projet (€)');
  env.controls.saved.value='';env.submit();
  assert.equal(env.dialog.open,true);
  assert.match(env.toast.textContent,/Complétez les champs obligatoires/);
  assert.equal(env.saved().projects[0].type,'credit');
  const dashboard=environment('dashboard',env.saved());
  await import('../src/scripts/ui/app.js?credit-dashboard');
  assert.match(dashboard.main.innerHTML,/À rembourser/);
  assert.doesNotMatch(dashboard.main.innerHTML,/Progression de Crédit auto/);
});

test('les dépenses liées remboursent les crédits pointés et restent modifiables une fois soldés',async()=>{
  const data=createBudgetDemo(),period=data.periods[0];
  data.projects.push(
    {id:'auto',name:'Auto',description:'',type:'credit',target:1000,saved:0},
    {id:'fini',name:'Terminé',description:'',type:'credit',target:100,saved:0}
  );
  period.expenses.push({...period.expenses[0],id:'paid-credit',name:'Ancienne mensualité',type:'credit',projectId:'fini',plannedAmount:100,realAmount:100});
  const env=environment('budget',data);await import('../src/scripts/ui/app.js?credit-expenses');
  env.action('add-expense');
  assert.match(env.dialog.html,/<wa-option value="credit:auto"[^>]*>Crédit - Auto<\/wa-option>/);
  assert.doesNotMatch(env.dialog.html,/Crédit - Terminé/);
  env.controls.name.value='Mensualité auto';env.controls.type.value='credit:auto';env.controls.plannedAmount.value='700';env.controls.realAmount.value='';
  env.submit();
  let expense=env.saved().periods[0].expenses.at(-1);
  assert.equal(expense.type,'credit');assert.equal(expense.projectId,'auto');
  assert.match(env.main.innerHTML,/Crédit · Auto/);
  env.action('view-projects');
  assert.match(env.main.innerHTML,new RegExp(`remboursé sur ${euro(1000)}`));
  assert.match(env.main.innerHTML,new RegExp(`Reste ${euro(1000)}`));
  env.action('view-budget');env.action('record-expense',expense.id);
  env.controls.realAmount.value='1000';env.submit();
  env.action('duplicate-expense',expense.id);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(env.toast.textContent,/déjà remboursé/);
  assert.equal(env.saved().periods[0].expenses.filter(item=>item.projectId==='auto').length,1);
  env.action('view-projects');
  assert.match(env.main.innerHTML,/Crédit remboursé à 100 %/);
  assert.match(env.main.innerHTML,new RegExp(`Reste ${euro(0)}`));
  env.action('delete-project','auto');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(env.toast.textContent,/utilisé dans le budget/);
  assert.ok(env.saved().projects.some(project=>project.id==='auto'));
  env.action('edit-project','auto');
  env.controls.type.value='savings';env.controls.type.change();env.submit();
  assert.match(env.toast.textContent,/utilisé dans le budget/);
  assert.equal(env.saved().projects[0].type,'credit');
  env.action('view-budget');env.action('add-expense');
  assert.doesNotMatch(env.dialog.html,/Crédit - Auto/);
  env.action('record-expense',expense.id);env.action('record-details');
  assert.match(env.dialog.html,/<wa-option value="credit:auto"[^>]*selected[^>]*>Crédit - Auto<\/wa-option>/);
  env.controls.realAmount.value='250';env.submit();
  assert.equal(env.saved().periods[0].expenses.find(item=>item.id===expense.id).projectId,'auto');
  env.action('add-expense');
  assert.match(env.dialog.html,/Crédit - Auto/);
  env.action('edit-expense',expense.id);
  env.controls.type.value='variable';env.submit();
  expense=env.saved().periods[0].expenses.find(item=>item.id===expense.id);
  assert.equal(expense.type,'variable');assert.equal(Object.hasOwn(expense,'projectId'),false);
});

test('la préparation du mois annonce que les crédits soldés ne sont pas reportés',async()=>{
  const data=createBudgetDemo(),period=data.periods[0];
  data.projects.push({id:'c',name:'Crédit',description:'',type:'credit',target:100,saved:0});
  period.expenses.push({...period.expenses[0],id:'credit-payment',type:'credit',projectId:'c',realAmount:100});
  const env=environment('budget',data);await import('../src/scripts/ui/app.js?credit-carry-notice');
  env.action('next-month');
  assert.match(env.main.innerHTML,/Les crédits soldés ne seront pas reportés/);
  env.action('create-period');
  assert.match(env.toast.textContent,/Les crédits soldés ne sont pas reportés/);
  assert.ok(env.saved().periods[1].expenses.every(item=>item.type!=='credit'));
});

test('parcours mensuel : copie, saisie prévu/réel, financement et sauvegarde',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?workflow-refactor');
  const date=env.saved().periods[0].date;
  env.action('next-month');assert.equal(env.saved().periods.length,1);
  env.action('create-period');let next=env.saved().periods.find(p=>p.date===shiftPeriod(date,1));
  assert.ok(next);assert.equal(next.incomes[0].realAmount,null);assert.equal(next.incomes[0].plannedAmount,3200);
  env.action('add-expense');
  Object.assign(env.controls.name,{value:'Test dépense'});env.controls.plannedAmount.value='100';env.controls.realAmount.value='0';env.controls.incomeId.value=next.incomes[0].id;
  env.submit();next=env.saved().periods.find(p=>p.date===shiftPeriod(date,1));
  assert.equal(next.expenses.at(-1).realAmount,0);assert.equal(next.expenses.at(-1).plannedAmount,100);assert.equal(next.expenses.at(-1).accountId,'main');
  env.action('edit-expense',next.expenses.at(-1).id);env.controls.plannedAmount.value='-5';env.submit();
  assert.equal(env.saved().periods.at(-1).expenses.at(-1).plannedAmount,100);
  env.controls.plannedAmount.value='150';env.submit();assert.equal(env.saved().periods.at(-1).expenses.at(-1).plannedAmount,150);
  assert.equal(Object.hasOwn(env.saved().periods.at(-1),'minMargin'),false);
  env.action('delete-income',next.incomes[0].id);await new Promise(resolve=>setTimeout(resolve,0));assert.ok(env.toast.textContent.includes('finance encore'));
  env.action('prev-month');assert.equal(env.saved().periods[0].incomes[0].plannedAmount,3200);
});
test('un revenu transféré conserve ses liens et refuse les cycles',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?transfer-workflow');
  env.action('edit-income','demo-salary');env.controls.deductedFromIncomeId.value='demo-savings';env.submit();
  assert.ok(env.toast.textContent.includes('circulaire'));assert.equal(env.saved().periods[0].incomes[0].deductedFromIncomeId,null);
  env.controls.deductedFromIncomeId.value='';env.controls.plannedAmount.value='3600';env.submit();
  assert.equal(env.saved().periods[0].incomes[0].plannedAmount,3600);
});
test('filtre Todo par origine de financement et présente les cumuls annuels sans changer les données',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?funding-filter-workflow');
  assert.match(env.main.innerHTML,/Filtrer par compte ou revenu/);
  assert.match(env.main.innerHTML,/Épargne annuelle par type/);
  assert.match(env.main.innerHTML,/income:demo-salary/);
  const before=env.saved();
  env.change({id:'fundingFilter',value:'income:demo-salary'});
  assert.match(env.main.innerHTML,/Source de financement sélectionnée/);
  assert.match(env.main.innerHTML,/Loyer/);
  assert.ok(!env.main.innerHTML.includes('demo-expense-999'));
  assert.deepEqual(env.saved(),before);
});

test('les sous-totaux se replient indépendamment et restent repliés après un rendu',async()=>{
  const data=createBudgetDemo(),period=data.periods[0];
  period.expenses[0].realAmount=0;
  const env=environment('budget',data);
  await import('../src/scripts/ui/app.js?collapsible-subtotals');
  const before=env.saved(),rows={hidden:false};
  const attributes={'aria-controls':'budget-expense-group-0','aria-expanded':'true'};
  const button={
    dataset:{action:'toggle-entry-group',groupKey:JSON.stringify([period.date,'expense','main',false]),groupLabel:'les dépenses non pointées de Compte principal'},
    closest:selector=>selector==='[data-action]'?button:null,
    getAttribute:name=>attributes[name],
    setAttribute:(name,value)=>{attributes[name]=value;},
  };
  document.getElementById=id=>{assert.equal(id,attributes['aria-controls']);return rows;};
  env.click(button);
  assert.equal(rows.hidden,true);
  assert.equal(attributes['aria-expanded'],'false');
  assert.match(attributes['aria-label'],/^Déplier/);
  env.change({id:'fundingFilter',value:'account:main'});
  assert.match(env.main.innerHTML,/<tbody id="budget-expense-group-0" hidden>/);
  assert.match(env.main.innerHTML,/<tbody id="budget-expense-group-1">/);
  assert.match(env.main.innerHTML,/<tbody id="budget-income-group-0">/);
  assert.match(env.main.innerHTML,/aria-expanded="false" aria-label="Déplier les dépenses non pointées/);
  assert.deepEqual(env.saved(),before);
  env.click(button);
  assert.equal(rows.hidden,false);
  assert.equal(attributes['aria-expanded'],'true');
  assert.match(attributes['aria-label'],/^Replier/);
  env.change({id:'fundingFilter',value:'all'});
  assert.match(env.main.innerHTML,/<tbody id="budget-expense-group-0">/);
  assert.deepEqual(env.saved(),before);
});

test('pointage limité aux montants et note, sans modification des autres informations',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?record-minimal');
  for(const [kind,collection,id] of [['income','incomes','demo-savings'],['expense','expenses','demo-expense-1']]){
    const before=env.saved().periods[0][collection].find(item=>item.id===id);
    env.action('record-'+kind,id);
    const names=Array.from(env.dialog.html.matchAll(/name="([^"]+)"/g),match=>match[1]);
    assert.deepEqual(names,['plannedAmount','realAmount','note']);
    assert.equal(Number(env.controls.realAmount.value),before.plannedAmount);
    env.controls.realAmount.value='0';env.controls.note.value='À vérifier';env.submit();
    assert.equal(env.dialog.open,false);
    const after=env.saved().periods[0][collection].find(item=>item.id===id);
    assert.deepEqual(after,{...before,realAmount:0,note:'À vérifier'});
    env.action('edit-'+kind,id);
    assert.match(env.dialog.html,/name="accountId"/);
    assert.equal(env.controls.note.value,'À vérifier');
  }
});

test('les détails conservent les modifications en cours sans enregistrer ni pointer implicitement',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?record-details');
  for(const [kind,collection,id] of [['income','incomes','demo-savings'],['expense','expenses','demo-expense-1']]){
    const before=env.saved();
    env.action('record-'+kind,id);
    assert.match(env.dialog.html,/<div class="modal-footer">[\s\S]*?data-action="record-details"[\s\S]*?data-action="cancel-dialog"/);
    env.controls.plannedAmount.value='123';env.controls.note.value='Brouillon';
    env.action('record-details');
    assert.deepEqual(env.saved(),before);
    assert.equal(env.controls.plannedAmount.value,'123');
    assert.equal(env.controls.realAmount.value,'');
    assert.equal(env.controls.note.value,'Brouillon');
    assert.equal(env.form.focused,true);
    env.action('cancel-dialog');
    assert.deepEqual(env.saved(),before);
    env.action('record-'+kind,id);
    env.controls.realAmount.value='0';env.action('record-details');
    assert.equal(env.controls.realAmount.value,'0');
    env.submit();
    assert.equal(env.saved().periods[0][collection].find(item=>item.id===id).realAmount,0);
    env.action('record-'+kind,id);
    assert.equal(env.controls.realAmount.value,'0');
    env.controls.realAmount.value='';env.action('record-details');
    assert.equal(env.controls.realAmount.value,'');
    env.submit();
    assert.equal(env.saved().periods[0][collection].find(item=>item.id===id).realAmount,null);
  }
});

test('sur mobile la ligne ouvre le pointage sans intercepter les actions',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?mobile-record-row');
  const row={dataset:{budgetEntry:'expense',id:'demo-expense-1'}};
  const cell={closest:selector=>selector==='tr[data-budget-entry]'?row:null};
  env.click(cell);assert.equal(env.dialog.open,false);
  env.viewport.mobile=true;env.click(cell);
  assert.equal(env.dialog.label,'Pointer · Alimentation');
  env.action('cancel-dialog');
  const duplicate={dataset:{action:'duplicate-expense',id:row.dataset.id},closest:selector=>selector==='[data-action]'?duplicate:selector==='tr[data-budget-entry]'?row:null};
  const count=env.saved().periods[0].expenses.length;
  env.click(duplicate);
  assert.equal(env.saved().periods[0].expenses.length,count+1);
  assert.equal(env.dialog.open,false);
  const otherButton={closest:selector=>selector==='button, a, input, select, textarea, wa-button'?otherButton:selector==='tr[data-budget-entry]'?row:null};
  env.click(otherButton);assert.equal(env.dialog.open,false);
});

test('le tableau de bord propose le pointage rapide des revenus et dépenses à renseigner',async()=>{
  const env=environment('dashboard');await import('../src/scripts/ui/app.js?dashboard-record');
  for(const [kind,collection,id,name] of [['income','incomes','demo-savings','Épargne de précaution'],['expense','expenses','demo-expense-1','Alimentation']]){
    const before=env.saved().periods[0][collection].find(item=>item.id===id);
    assert.match(env.main.innerHTML,new RegExp(`data-action="record-${kind}" aria-label="Pointer ${name}"[^>]*data-id="${id}"`));
    env.action('record-'+kind,id);
    assert.deepEqual(Array.from(env.dialog.html.matchAll(/name="([^"]+)"/g),match=>match[1]),['plannedAmount','realAmount','note']);
    env.controls.realAmount.value='42';env.submit();
    assert.deepEqual(env.saved().periods[0][collection].find(item=>item.id===id),{...before,realAmount:42,note:''});
    assert.doesNotMatch(env.main.innerHTML,new RegExp(`data-action="record-${kind}"[^>]*data-id="${id}"`));
  }
});

test('les cartes du tableau de bord mettent le réel en avant uniquement quand leurs lignes sont renseignées',async()=>{
  const data=createBudgetDemo();
  data.periods[0].incomes[0].realAmount=0;
  const env=environment('dashboard',data);await import('../src/scripts/ui/app.js?dashboard-metric-completion');
  const card=label=>[...env.main.innerHTML.matchAll(/<section class="panel period-metric">([\s\S]*?)<\/section>/g)].map(match=>match[1]).find(html=>html.includes(`<span>${label}</span>`));
  const verify=(label,primary,amount,secondary,other)=>{
    const html=card(label);
    assert.ok(html,`Carte absente : ${label}`);
    assert.ok(html.includes(`<small>${primary}</small>`));
    assert.ok(html.includes(`<strong class="metric-${primary==='Prévu'?'planned':'real'}">${euro(amount)}</strong>`));
    assert.ok(html.includes(`<small>${secondary} : ${euro(other)}</small>`));
  };
  verify('Revenus','Réel saisi',0,'Prévu',3200);
  verify('Dépenses','Prévu',1180,'Réel saisi',700);
  verify('Épargne / projets','Prévu',350,'Réel saisi',0);
  verify('Marge disponible','Prévu',1670,'Réel saisi',-700);
  for(const [kind,id] of [['income','demo-savings'],['expense','demo-expense-1'],['expense','demo-expense-2']]){
    env.action('record-'+kind,id);env.controls.realAmount.value='0';env.submit();
  }
  verify('Dépenses','Réel saisi',700,'Prévu',1180);
  verify('Épargne / projets','Réel saisi',0,'Prévu',350);
  verify('Marge disponible','Réel saisi',-700,'Prévu',1670);
});

test('ouvrir un mois depuis les analyses mémorise la période et réinitialise le filtre',async()=>{
  const env=environment();await import('../src/scripts/ui/app.js?open-period-review');
  const source=env.saved().periods[0].date;
  env.action('next-month');env.action('create-period');env.action('prev-month');
  env.change({id:'fundingFilter',value:'income:demo-salary'});
  const target=shiftPeriod(source,1),before=env.saved();
  env.action('open-period',undefined,{period:target});
  assert.equal(env.values.get('marge:selected-period'),target);
  assert.equal(location.hash,'budget');
  assert.match(env.main.innerHTML,/Loyer/);
  assert.deepEqual(env.saved(),before);
  env.action('open-period',undefined,{period:'invalide'});
  assert.equal(env.values.get('marge:selected-period'),target);
  await new Promise(resolve=>setTimeout(resolve,0));assert.match(env.toast.textContent,/Période invalide/);
});
