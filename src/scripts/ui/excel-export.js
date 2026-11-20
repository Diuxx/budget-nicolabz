import { validateData } from '../core/storage.js';
import { MONTHS } from '../core/model.js';
import { periodTotals } from '../core/period-model.js';

export async function createExcelBudget(data,ExcelJS,template){
  validateData(data);
  if(!data.periods.length)throw new Error('Aucun mois à exporter.');
  const workbook=new ExcelJS.Workbook();
  const base=new ExcelJS.Workbook();
  await base.xlsx.load(template);
  const style=base.getWorksheet('budget - aaaa');
  if(!style)throw new Error('Le modèle Excel est incompatible.');
  const accountName=id=>data.accounts.find(account=>account.id===id)?.name||'';
  for(const year of [...new Set(data.periods.map(period=>period.date.slice(0,4)))].sort()){
    const sheet=workbook.addWorksheet(`budget - ${year}`);
    sheet.columns=[{width:22},{width:34},{width:25},{width:30},{width:12},...MONTHS.map(()=>({width:15}))];
    sheet.views=[{state:'frozen',xSplit:5,ySplit:4}];
    sheet.addRow([`Pécule — Budget ${year}`]);
    sheet.addRow(['Virements internes : affichés dans le détail, exclus des revenus de synthèse.']);
    sheet.addRow([]);
    const header=sheet.addRow(['Type','Poste','Compte','Financé par','Montants',...MONTHS]);
    const headerStyle=structuredClone(style.getCell('C6').style);
    header.eachCell(cell=>{cell.style=structuredClone(headerStyle);});
    const periods=data.periods.filter(period=>period.date.startsWith(year));
    for(const [label,key] of [['Total revenus','income'],['Total dépenses','expenses'],['Total épargne','savings'],['Marge disponible','margin']]){
      for(const field of ['planned','real']){
        const values=Array(12).fill(null);
        for(const period of periods)values[Number(period.date.slice(5))-1]=periodTotals(data,period)[field][key];
        const row=sheet.addRow(['Synthèse',label,'','',field==='planned'?'Prévu':'Réel',...values]);
        row.eachCell(cell=>{cell.font={bold:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F3F0'}};});
      }
    }
    const lines=new Map();
    for(const period of periods){
      const seen=new Map();
      for(const [kind,entries] of [['Revenu',period.incomes],['Dépense',period.expenses]])for(const entry of entries){
        const sourceId=kind==='Revenu'?entry.deductedFromIncomeId:entry.incomeId;
        const source=period.incomes.find(income=>income.id===sourceId)?.name||'';
        const label=kind==='Revenu'&&sourceId?'Virement interne':kind;
        const type=kind==='Revenu'?data.incomeTypes.find(type=>type.id===entry.typeId)?.name:entry.type;
        const identity=JSON.stringify([label,entry.name,entry.accountId,source,type]);
        const ordinal=seen.get(identity)||0;seen.set(identity,ordinal+1);
        const key=identity+ordinal;
        if(!lines.has(key))lines.set(key,{label,name:entry.name,account:accountName(entry.accountId),source,planned:Array(12).fill(null),real:Array(12).fill(null)});
        const line=lines.get(key),month=Number(period.date.slice(5))-1;
        line.planned[month]=entry.plannedAmount;line.real[month]=entry.realAmount;
      }
    }
    sheet.addRow([]);
    for(const line of lines.values())for(const field of ['planned','real'])sheet.addRow([line.label,line.name,line.account,line.source,field==='planned'?'Prévu':'Réel',...line[field]]);
    for(let column=6;column<=17;column++)sheet.getColumn(column).numFmt='#,##0.00;[Red](#,##0.00);"—"';
    sheet.autoFilter={from:'A4',to:`Q${sheet.rowCount}`};
  }
  return workbook;
}

let library;
function loadExcelLibrary(){
  if(!library)library=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='./scripts/vendor/exceljs.min.js';
    script.onload=()=>resolve(window.ExcelJS);
    script.onerror=()=>{script.remove();library=null;reject(new Error('Impossible de charger l’export Excel.'));};
    document.head.append(script);
  });
  return library;
}
export async function exportExcel(data){
  const snapshot=structuredClone(data);
  const ExcelJS=await loadExcelLibrary();
  const response=await fetch('./assets/templates/pecule-budget-template.xlsx');
  if(!response.ok)throw new Error('Impossible de charger le modèle Excel.');
  const workbook=await createExcelBudget(snapshot,ExcelJS,await response.arrayBuffer());
  const buffer=await workbook.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');link.href=url;link.download=`pecule-budget-${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
