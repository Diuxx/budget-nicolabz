import test from 'node:test';
import assert from 'node:assert/strict';
import {createBudgetDemo} from '../src/scripts/core/period-model.js';
import {createBudgetPresentation} from '../src/scripts/ui/budget-presentation.js';
import {createBudgetViews} from '../src/scripts/ui/budget-views.js';

test('les dépenses et épargnes pointées suivent les non pointées sans modifier les données',()=>{
  const data=createBudgetDemo(),period=data.periods[0];
  period.expenses[0].name='Dépense pointée unique';period.expenses[0].realAmount=0;
  period.expenses[1].name='Épargne pointée unique';period.expenses[1].type='savings';period.expenses[1].realAmount=50;
  const model={data,selectedPeriod:period.date,fundingFilter:'all'};
  const views=createBudgetViews({model,presentation:createBudgetPresentation(model)});
  const original=JSON.stringify(data);
  const html=views.renderBudget();
  assert.match(html,/Dépense pointée unique/);
  assert.match(html,/Épargne pointée unique/);
  assert.match(views.renderBudget(),/unrecorded/);
  assert.ok(html.indexOf('<strong>Transport</strong>')<html.indexOf('<strong>Dépense pointée unique</strong>'));
  assert.ok(html.indexOf('<strong>Transport</strong>')<html.indexOf('<strong>Épargne pointée unique</strong>'));
  assert.doesNotMatch(html,/showRecordedExpenses/);
  assert.equal(JSON.stringify(data),original);
});
