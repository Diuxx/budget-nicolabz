import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetDemo, createPeriod } from '../src/scripts/core/period-model.js';
import { euro } from '../src/scripts/core/model.js';
import { createBudgetPresentation } from '../src/scripts/ui/budget-presentation.js';
import { createBudgetViews } from '../src/scripts/ui/budget-views.js';

const css = readFileSync(new URL('../src/styles/period-budget.css', import.meta.url), 'utf8');

function styleFor(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Sélecteur absent : ${selector}`);
  const bodyStart = css.indexOf('{', start);
  return css.slice(bodyStart + 1, css.indexOf('}', bodyStart));
}

test('les indicateurs annuels sont séparés verticalement du graphique', () => {
  const rules = styleFor('.period-metrics');
  assert.match(rules, /display:\s*grid;/);
  assert.match(rules, /gap:\s*var\(--card-gap\);/);
  assert.match(rules, /margin-bottom:\s*var\(--card-gap\);/);
});

test('les cartes ne peuvent pas élargir leur piste de grille', () => {
  assert.match(styleFor('.period-metric'), /min-width:\s*0;/);
});

test('les cartes annuelles utilisent le réel lorsque toutes les lignes concernées des mois préparés sont renseignées', () => {
  const data=createBudgetDemo(),january=data.periods[0];
  january.date='2028-01';
  january.incomes=[{...january.incomes[0],plannedAmount:100,realAmount:90,plannedDate:null,realDate:null}];
  january.expenses=[{...january.expenses[0],plannedAmount:50,realAmount:30}];
  const february=createPeriod(data,'2028-02');
  february.expenses[0].realAmount=30;
  february.expenses.push({...february.expenses[0],id:'saving',type:'savings',plannedAmount:20,realAmount:0});
  const otherYear=structuredClone(january);
  otherYear.date='2029-01';otherYear.incomes[0].realAmount=null;otherYear.incomes[0].plannedAmount=999999;
  data.periods.push(otherYear);
  const model={data,selectedPeriod:'2028-01',fundingFilter:'all'};
  const views=createBudgetViews({model,presentation:createBudgetPresentation(model)});
  const verify=(html,label,primary,amount,secondary,other)=>{
    const cards=[...html.matchAll(/<section class="panel period-metric">([\s\S]*?)<\/section>/g)].map(match=>match[1]);
    const card=cards.find(value=>value.includes(`<div class="metric-heading">${label}</div>`));
    assert.ok(card,`Carte absente : ${label}`);
    assert.ok(card.includes(`<small>${primary}</small>`));
    assert.ok(card.includes(`<strong class="metric-${primary==='Prévu'?'planned':'real'}">${euro(amount)}</strong>`));
    assert.ok(card.includes(`<small>${secondary} : ${euro(other)}</small>`));
  };
  let html=views.renderAnalytics();
  verify(html,'Revenus','Prévu',200,'Réel saisi',90);
  verify(html,'Dépenses','Réel saisi',60,'Prévu',100);
  verify(html,'Épargne','Réel saisi',0,'Prévu',20);
  verify(html,'Marge','Prévu',80,'Réel saisi',30);
  february.incomes[0].realAmount=0;
  html=views.renderAnalytics();
  verify(html,'Revenus','Réel saisi',90,'Prévu',200);
  verify(html,'Marge','Réel saisi',30,'Prévu',80);
  model.selectedPeriod='2030-01';
  html=views.renderAnalytics();
  verify(html,'Revenus','Prévu',0,'Réel saisi',0);
});
