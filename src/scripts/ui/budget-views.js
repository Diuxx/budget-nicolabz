import { MONTHS, euro, round, projectProgress } from '../core/model.js';
import { getPeriod, shiftPeriod, periodLabel, periodTotals, annualPeriods, incomeAvailable } from '../core/period-model.js';
import { buildFundingFilters, filterBudgetEntries, annualSavingsByType, fundingBalances } from '../core/budget-insights.js';
import { icon, esc, titleRow, btn, actionIcon, formatDate, optionHtml } from './components.js';

export function createBudgetViews({model,presentation}){
  const {period,monYear,accountName,typeName,categoryName,realValue,activeMonthText}=presentation;
  function missingPeriod(){
    const previous=getPeriod(model.data,shiftPeriod(model.selectedPeriod,-1));
    return `<section class="panel period-empty"><span class="period-empty-icon">${icon('calendar',30)}</span><h2>Préparons ${esc(monYear())}</h2><p>Ce mois n’a pas encore de budget.</p>${previous?`<label class="copy-choice"><input id="copyPrevious" type="checkbox" checked> Reprendre les prévisions de ${esc(periodLabel(previous.date))}</label><p class="help-note">Les montants réels seront à renseigner. Les dates prévues seront adaptées au nouveau mois.</p>`:'<p class="help-note">Commencez par ajouter vos revenus et les dépenses que vous prévoyez.</p>'}<div class="inline-actions">${btn('create-period',previous?'Préparer ce mois':'Créer mon budget du mois','primary')}</div></section>`;
  }
  function metrics(p){
    const totals=periodTotals(model.data,p);
    const financialCards=[
      ['Revenus','income','arrow-down-left'],
      ['Dépenses','expenses','wallet'],
      ['Épargne / projets','savings','piggy'],
      ['Marge disponible','margin','target'],
    ];
    const cards=financialCards.map(([label,key,iconName])=>`
    <section class="panel period-metric">
      <div class="metric-heading">${icon(iconName,16)}<span>${label}</span></div>
      <div class="metric-values">
        <div><small>Prévu</small><strong>${euro(totals.planned[key])}</strong></div>
        <div><small>Réel saisi</small><strong>${euro(totals.real[key])}</strong></div>
      </div>
    </section>`).join('');
    return `<div class="period-metrics">${cards}</div><p class="recording-note">${totals.recorded} / ${totals.entries} lignes renseignées en réel. La marge réelle reflète uniquement les montants saisis.</p>`;
  }
  function renderDashboard(){
    const p=period();
    if(!p)return `${titleRow('Votre budget, mois après mois','Prévisions, dépenses réelles et reste disponible.',activeMonthText())}${missingPeriod()}`;
    return `${titleRow('Votre mois en un regard','Un suivi commun pour vos prévisions et vos opérations réalisées.',activeMonthText())}${metrics(p)}<div class="overview-grid"><section class="panel overview-panel"><div class="panel-title">${icon('wallet')}<h2>Répartition par compte</h2><span class="spacer"></span>${btn('view-accounts','Voir les comptes','quiet small')}</div>${accountSummary(p)}</section><section class="panel overview-panel"><div class="panel-title">${icon('list')}<h2>À renseigner ce mois</h2><span class="spacer"></span>${btn('view-budget','Ouvrir le budget','quiet small')}</div>${[...p.incomes.map(item=>({...item,kind:'income'})),...p.expenses.map(item=>({...item,kind:'expense'}))].filter(item=>item.realAmount===null).slice(0,5).map(item=>`<div class="pending-row"><div><strong>${esc(item.name)}</strong><small>${esc(accountName(item.accountId))}</small></div><span>${euro(item.plannedAmount)}</span>${actionIcon('edit-'+item.kind,'edit','Renseigner '+item.name,`data-id="${esc(item.id)}"`)}</div>`).join('')||'<p class="help-note">Toutes les lignes du mois sont renseignées.</p>'}</section></div><section class="panel overview-panel"><div class="panel-title">${icon('target')}<h2>Projets</h2><span class="spacer"></span>${btn('view-projects','Gérer les projets','quiet small')}</div>${model.data.projects.length?`<div class="project-overview">${model.data.projects.slice(0,3).map(project=>`<div><strong>${esc(project.name)}</strong><small>${euro(project.saved)} / ${euro(project.target)}</small><wa-progress-bar value="${projectProgress(project)*100}" aria-label="Progression de ${esc(project.name)}"></wa-progress-bar></div>`).join('')}</div>`:'<p class="help-note">Créez un objectif d’épargne ou une demande de financement.</p>'}</section>`;
  }
  function accountSummary(p){
    const used=model.data.accounts.filter(account=>[...p.incomes,...p.expenses].some(item=>item.accountId===account.id));
    return used.map(account=>{
      const remaining=field=>round(p.incomes.filter(item=>item.accountId===account.id).reduce((sum,item)=>sum+incomeAvailable(p,item.id,field),0)-p.expenses.filter(item=>item.accountId===account.id&&!item.incomeId).reduce((sum,item)=>sum+(item[field]||0),0));
      return `<div class="account-summary-row"><div><strong>${esc(account.name)}</strong><small>Reste après affectations</small></div><div><small>Prévu</small><strong>${euro(remaining('plannedAmount'))}</strong></div><div><small>Réel saisi</small><strong>${euro(remaining('realAmount'))}</strong></div></div>`;
    }).join('')||'<p class="help-note">Ajoutez une première entrée d’argent.</p>';
  }
  function annualSavingsCard(year) {
    const types = annualSavingsByType(model.data, year);
    if (!types.length) return '';
    const maximum = Math.max(1, ...types.flatMap(type => [type.planned, type.real]));
    return `<section class="panel annual-saving-panel">
    <div class="panel-title">${icon('piggy',18)}<h2>Épargne annuelle par type · ${esc(year)}</h2></div>
    <p class="help-note">Versements d’épargne prévus et enregistrés, rattachés aux types de revenus. Sans additionner une seconde fois les dépenses d’épargne.</p>
    <div class="annual-savings-list">${types.map(type => `<div class="annual-saving-row">
      <div class="annual-saving-title"><strong>${esc(type.name)}</strong><small>${type.recorded} / ${type.count} versements renseignés</small></div>
      <div class="annual-saving-bars">
        <div class="annual-saving-line"><span>Prévu</span><wa-progress-bar value="${type.planned / maximum * 100}" aria-label="Épargne prévue ${esc(type.name)}"></wa-progress-bar><strong>${euro(type.planned)}</strong></div>
        <div class="annual-saving-line"><span>Réel</span><wa-progress-bar class="actual-savings" value="${type.real / maximum * 100}" aria-label="Épargne réelle ${esc(type.name)}"></wa-progress-bar><strong>${euro(type.real)}</strong></div>
      </div>
    </div>`).join('')}</div>
  </section>`;
  }
  function renderBudget(){
    const p=period();
    const header=titleRow('Budget du mois','Des revenus et des dépenses propres à chaque mois.',activeMonthText());
    if(!p)return header+missingPeriod();
    const filters=buildFundingFilters(model.data,p);
    if(!filters.some(option=>option.value===model.fundingFilter))model.fundingFilter='all';
    const filterLabel=model.fundingFilter.startsWith('income:')?'Source de financement sélectionnée':model.fundingFilter.startsWith('account:')?'Compte sélectionné':'Toutes les sources';
    return `${header}${metrics(p)}<div class="view-toolbar"><wa-select id="fundingFilter" class="form-control" size="s" label="Filtrer par compte ou revenu" value="${esc(model.fundingFilter)}">${filters.map(option=>optionHtml(option.value,option.label,model.fundingFilter)).join('')}</wa-select><div class="inline-actions">${btn('view-analytics','Vue annuelle','secondary small')}${btn('delete-period','Supprimer ce mois','text-btn small')}</div></div>${model.data.migration&&[...p.incomes,...p.expenses].some(item=>item.accountId===model.data.migration.accountId)?'<p class="migration-note">Prévisions importées : affectez les lignes à vos comptes en les modifiant. Le réel reste à renseigner.</p>':''}<section class="panel ledger-panel"><div class="panel-title">${icon('arrow-down-left')}<h2>Entrées d’argent</h2><span class="spacer"></span>${btn('add-income','+ Ajouter un revenu','primary small')}</div>${entryTable(p,'income')}</section><section class="panel ledger-panel"><div class="panel-title">${icon('wallet')}<h2>Dépenses et épargne</h2><span class="filter-context">${esc(filterLabel)}</span><span class="spacer"></span>${btn('add-expense','+ Ajouter une dépense','primary small')}</div>${entryTable(p,'expense')}</section>${annualSavingsCard(model.selectedPeriod.slice(0,4))}`;
  }
  function entryTable(p,kind){
    const items=filterBudgetEntries(p,kind,model.fundingFilter);
    if(!items.length)return `<p class="ledger-empty">${kind==='income'?'Aucun revenu':'Aucune dépense'} pour ce filtre.</p>`;
    const groups=model.data.accounts.map(account=>({account,items:items.filter(item=>item.accountId===account.id)})).filter(group=>group.items.length);
    return `<div class="table-scroll"><table class="data-table period-table"><thead><tr><th>Libellé</th><th>${kind==='income'?'Type / origine':'Catégorie / financement'}</th><th class="align-right">Prévu</th><th class="align-right">Réel</th><th class="align-right">${kind==='income'?'Disponible prévu / réel':'Écart réel − prévu'}</th><th>Actions</th></tr></thead><tbody>${groups.map(({account,items})=>`<tr class="ledger-account"><th colspan="6">${esc(account.name)}</th></tr>${items.map(item=>{
      const source=p.incomes.find(income=>income.id===(kind==='income'?item.deductedFromIncomeId:item.incomeId));
      const balance=kind==='income'?fundingBalances(p,item.id):null;
      return `<tr><td><strong>${esc(item.name)}</strong>${item.note?`<small>${esc(item.note)}</small>`:''}</td><td><span class="entry-tag">${esc(kind==='income'?typeName(item.typeId):categoryName(item.categoryId))}</span><small>${source?`${kind==='income'?'Prélevé sur':'Financé par'} ${esc(source.name)}`:kind==='income'?'Entrée externe':'Compte directement'}</small></td><td class="align-right"><strong>${euro(item.plannedAmount)}</strong><small>${item.plannedDate?formatDate(item.plannedDate):'Date non précisée'}</small></td><td class="align-right"><strong>${realValue(item.realAmount)}</strong><small>${item.realDate?formatDate(item.realDate):''}</small></td><td class="align-right">${balance?`<strong class="${balance.planned<0?'warning':''}">${euro(balance.planned)}</strong><small class="${balance.real<0?'warning':''}">Réel : ${euro(balance.real)}</small>`:item.realAmount===null?'—':euro(round(item.realAmount-item.plannedAmount))}</td><td><div class="entry-actions">${item.realAmount===null?btn('record-'+kind,'Pointer','secondary small',`data-id="${esc(item.id)}" aria-label="Pointer ${esc(item.name)}"`):''}${actionIcon('edit-'+kind,'edit','Modifier '+item.name,`data-id="${esc(item.id)}"`)}${actionIcon('delete-'+kind,'trash','Supprimer '+item.name,`data-id="${esc(item.id)}"`)}</div></td></tr>`;
    }).join('')}`).join('')}</tbody></table></div>`;
  }
  function renderAnalytics(){
    const year=model.selectedPeriod.slice(0,4),months=annualPeriods(model.data,year),existing=months.filter(item=>item.period);
    const sum=(mode,key)=>round(existing.reduce((total,item)=>total+item[mode][key],0));
    const max=Math.max(1,...existing.flatMap(item=>[item.planned.income,item.planned.outflow,item.real.income,item.real.outflow]));
    return `${titleRow('Vue annuelle',`${existing.length} mois préparés en ${year}. Les mois absents ne sont pas comptabilisés.`,activeMonthText())}<div class="period-metrics">${[['Revenus','income'],['Dépenses','expenses'],['Épargne','savings'],['Marge','margin']].map(([name,key])=>`<section class="panel period-metric"><div class="metric-heading">${name}</div><div class="metric-values"><div><small>Prévu</small><strong>${euro(sum('planned',key))}</strong></div><div><small>Réel saisi</small><strong>${euro(sum('real',key))}</strong></div></div></section>`).join('')}</div><section class="panel overview-panel"><div class="panel-title"><h2>Revenus et sorties prévus</h2></div><div class="year-bars">${months.map((item,i)=>`<button class="year-bar-month" data-action="open-period" data-period="${item.date}" aria-label="Ouvrir ${esc(periodLabel(item.date))}"><div class="year-bar-track">${item.period?`<span class="year-bar-income" style="height:${item.planned.income/max*100}%"></span><span class="year-bar-outflow" style="height:${item.planned.outflow/max*100}%"></span>`:'<span class="year-bar-missing">—</span>'}</div><small>${MONTHS[i].slice(0,3)}</small></button>`).join('')}</div><p class="help-note">Vert clair : revenus · Vert sombre : dépenses et épargne · Cliquez sur un mois pour l’ouvrir.</p></section><section class="panel ledger-panel"><div class="panel-title"><h2>Détail des mois</h2></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Mois</th><th>Revenus prévus</th><th>Sorties prévues</th><th>Marge prévue</th><th>Marge réelle saisie</th></tr></thead><tbody>${months.map((item,i)=>`<tr><th>${btn('open-period',MONTHS[i],'quiet small',`data-period="${item.date}"`)}</th>${item.period?`<td>${euro(item.planned.income)}</td><td>${euro(item.planned.outflow)}</td><td>${euro(item.planned.margin)}</td><td>${euro(item.real.margin)}<small>${item.recorded}/${item.entries} lignes</small></td>`:'<td colspan="4" class="muted">Mois à préparer</td>'}</tr>`).join('')}</tbody></table></div></section>`;
  }
  function renderTransactions(){
    const p=period(),entries=p?[...p.incomes.map(item=>({...item,kind:'income'})),...p.expenses.map(item=>({...item,kind:'expense'}))].filter(item=>item.realAmount!==null).sort((a,b)=>(b.realDate||'').localeCompare(a.realDate||'')):[];
    const archives=model.data.legacyTransactions.filter(item=>item.date.startsWith(model.selectedPeriod));
    return `${titleRow('Journal du mois','Les montants réels renseignés dans le budget, réunis au même endroit.',activeMonthText())}<section class="panel ledger-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Montant réel</th><th>Action</th></tr></thead><tbody>${entries.map(item=>`<tr><td>${item.realDate?formatDate(item.realDate):'Non précisée'}</td><td>${esc(item.name)}<small>${item.kind==='income'?'Entrée':'Dépense'}</small></td><td>${esc(accountName(item.accountId))}</td><td>${item.kind==='income'?'+':'−'} ${euro(item.realAmount)}</td><td>${actionIcon('edit-'+item.kind,'edit','Modifier '+item.name,`data-id="${esc(item.id)}"`)}</td></tr>`).join('')||'<tr><td colspan="5">Aucun montant réel renseigné ce mois. Saisissez-le depuis Budget.</td></tr>'}</tbody></table></div></section>${archives.length?`<details class="panel archive-panel"><summary>Anciennes transactions conservées · ${archives.length}</summary><p class="help-note">Ces opérations historiques ne sont pas ajoutées automatiquement au réel du budget.</p>${archives.map(item=>`<div class="pending-row"><span>${esc(item.date)} · ${esc(item.label)}</span><strong>${euro(item.amount)}</strong></div>`).join('')}</details>`:''}`;
  }
  return {renderDashboard,renderBudget,renderAnalytics,renderTransactions,accountSummary};
}
