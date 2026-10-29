import { MONTHS, euro } from '../core/model.js';
import { getPeriod, periodLabel } from '../core/period-model.js';
import { actionIcon, optionHtml } from './components.js';

export function createBudgetPresentation(model){
  const period=()=>getPeriod(model.data,model.selectedPeriod);
  const monYear=()=>periodLabel(model.selectedPeriod);
  const accountName=id=>model.data.accounts.find(account=>account.id===id)?.name||'Compte à affecter';
  const typeName=id=>model.data.incomeTypes.find(type=>type.id===id)?.name||'Revenu';
  const categoryName=id=>model.data.expenseCategories.find(category=>category.id===id)?.name||'Autres';
  const realValue=value=>value===null?'<span class="unrecorded">À renseigner</span>':euro(value);
  const activeMonthText=()=>{
    const year=model.selectedPeriod.slice(0,4),month=Number(model.selectedPeriod.slice(5))-1;
    const years=[...new Set([Number(year)-1,Number(year),Number(year)+1,...model.data.periods.map(p=>Number(p.date.slice(0,4)))])].filter(y=>y>=1000&&y<=9999).sort((a,b)=>a-b);
    return `<div class="period-actions">${actionIcon('prev-month','left','Mois précédent')}<wa-select id="monthSelect" size="s" aria-label="Mois affiché" value="${month}">${MONTHS.map((name,i)=>optionHtml(i,name,month)).join('')}</wa-select><wa-select id="yearSelect" size="s" aria-label="Année affichée" value="${year}">${years.map(y=>optionHtml(y,y,year)).join('')}</wa-select>${actionIcon('next-month','chevron','Mois suivant')}</div>`;
  };
  return {period,monYear,accountName,typeName,categoryName,realValue,activeMonthText};
}
