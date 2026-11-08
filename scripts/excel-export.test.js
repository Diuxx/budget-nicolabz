import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { createExcelBudget } from '../src/scripts/ui/excel-export.js';
import { createBudgetDemo } from '../src/scripts/core/period-model.js';

test('export Excel : lignes dynamiques, réel nul, année et financement conservés',async()=>{
  const data=createBudgetDemo();
  data.periods[0].incomes[0].name='Salaire personnalisé';
  data.periods[0].incomes[0].realAmount=0;
  const original=structuredClone(data);
  const template=await fs.readFile('src/assets/templates/pecule-budget-template.xlsx');
  const workbook=await createExcelBudget(data,ExcelJS,template);
  const reopened=new ExcelJS.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet=reopened.getWorksheet(`budget - ${data.periods[0].date.slice(0,4)}`);
  assert.ok(sheet);
  const rows=[];sheet.eachRow(row=>rows.push(row.values));
  const salary=rows.find(row=>row[2]==='Salaire personnalisé'&&row[5]==='Réel');
  assert.equal(salary[6+Number(data.periods[0].date.slice(5))-1],0);
  assert.ok(rows.some(row=>row[1]==='Virement interne'));
  assert.deepEqual(data,original);
  await assert.rejects(createExcelBudget({...data,periods:[]},ExcelJS,template),/Aucun mois/);
});
