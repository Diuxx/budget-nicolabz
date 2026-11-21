import { marginStatus } from '../core/margin-thresholds.js';
import { MONTHS, euro, round, projectProgress } from '../core/model.js';
import { getPeriod, shiftPeriod, periodLabel, periodTotals, periodMetricEntries, annualPeriods, incomeAvailable, creditRepayments, creditProgress } from '../core/period-model.js';
import { buildFundingFilters, filterBudgetEntries, annualSavingsByType, fundingBalances } from '../core/budget-insights.js';
import { icon, esc, titleRow, btn, actionIcon, formatDate, optionHtml } from './components.js';

export function createBudgetViews({model,presentation}){
  const {period,monYear,accountName,typeName,categoryName,realValue,activeMonthText}=presentation;
  const collapsedGroups=new Set();
  function toggleEntryGroup(button){
    const key=button.dataset.groupKey;
    const rows=document.getElementById(button.getAttribute('aria-controls'));
    const collapsed=button.getAttribute('aria-expanded')==='true';
    if(collapsed)collapsedGroups.add(key);else collapsedGroups.delete(key);
    rows.hidden=collapsed;
    button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',`${collapsed?'Déplier':'Replier'} ${button.dataset.groupLabel}`);
    button.title=button.getAttribute('aria-label');
  }
  function missingPeriod(){
    const previous=getPeriod(model.data,shiftPeriod(model.selectedPeriod,-1));
    return `<section class="panel period-empty"><span class="period-empty-icon">${icon('calendar',30)}</span><h2>Préparons ${esc(monYear())}</h2><p>Ce mois n’a pas encore de budget.</p>${previous?`<label class="copy-choice"><input id="copyPrevious" type="checkbox" checked> Reprendre les prévisions de ${esc(periodLabel(previous.date))}</label><p class="help-note">Les montants réels seront à renseigner. Les dates prévues seront adaptées au nouveau mois.${previous.expenses.some(item=>item.type==='credit')?' Les crédits soldés ne seront pas reportés.':''}</p>`:'<p class="help-note">Commencez par ajouter vos revenus et les dépenses que vous prévoyez.</p>'}<div class="inline-actions">${btn('create-period',previous?'Préparer ce mois':'Créer mon budget du mois','primary')}</div></section>`;
  }
  function metricValues(planned,real,entries){
    const showReal=entries.length>0&&entries.every(item=>item.realAmount!==null);
    return `<div class="summary-metric-values">
      <small>${showReal?'Réel saisi':'Prévu'}</small>
      <strong class="${showReal?'metric-real':'metric-planned'}">${euro(showReal?real:planned)}</strong>
      <small>${showReal?'Prévu':'Réel saisi'} : ${euro(showReal?planned:real)}</small>
    </div>`;
  }
  function metrics(p){
    const totals=periodTotals(model.data,p);
    const entries=periodMetricEntries(model.data,p);
    const financialCards=[
      ['Revenus','income','arrow-down-left'],
      ['Dépenses','expenses','wallet'],
      ['Épargne / projets','savings','piggy'],
      ['Marge disponible','margin','target'],
    ];
    const cards=financialCards.map(([label,key,iconName])=>`
    <section class="panel period-metric">
      <div class="metric-heading">${icon(iconName,16)}<span>${label}</span></div>
      ${metricValues(totals.planned[key],totals.real[key],entries[key])}
    </section>`).join('');
    return `<div class="period-metrics">${cards}</div><p class="recording-note">${totals.recorded} / ${totals.entries} lignes renseignées en réel. La marge réelle reflète uniquement les montants saisis.</p>`;
  }
  function renderDashboard(){
    const p=period();
    if(!p)return `<div class="dashboard-empty">${titleRow('Votre budget, mois après mois','Prévisions, dépenses réelles et reste disponible.',activeMonthText())}<div class="dashboard-empty-content">${missingPeriod()}</div></div>`;
    const repayments=creditRepayments(model.data);
    return `${titleRow('Votre mois en un regard','Un suivi commun pour vos prévisions et vos opérations réalisées.',activeMonthText())}${metrics(p)}<div class="overview-grid"><section class="panel overview-panel"><div class="panel-title">${icon('wallet')}<h2>Répartition par compte</h2><span class="spacer"></span>${btn('view-accounts','Voir les comptes','quiet small')}</div>${accountSummary(p)}</section><section class="panel overview-panel"><div class="panel-title">${icon('list')}<h2>À renseigner ce mois</h2><span class="spacer"></span>${btn('view-budget','Ouvrir le budget','quiet small')}</div>${[...p.incomes.map(item=>({...item,kind:'income'})),...p.expenses.map(item=>({...item,kind:'expense'}))].filter(item=>item.realAmount===null).slice(0,5).map(item=>`<div class="pending-row"><div><strong>${esc(item.name)}</strong><small>${esc(accountName(item.accountId))}</small></div><span>${euro(item.plannedAmount)}</span>${actionIcon('record-'+item.kind,'check','Pointer '+item.name,`data-id="${esc(item.id)}"`)}</div>`).join('')||'<p class="help-note">Toutes les lignes du mois sont renseignées.</p>'}</section></div><section class="panel overview-panel"><div class="panel-title">${icon('target')}<h2>Projets</h2><span class="spacer"></span>${btn('view-projects','Gérer les projets','quiet small')}</div>${model.data.projects.length?`<div class="project-overview">${model.data.projects.slice(0,3).map(project=>`<div><strong>${esc(project.name)}</strong>${project.type==='credit'?`<small>À rembourser : ${euro(creditProgress(project,repayments).remaining)}</small>`:`<small>${euro(project.saved)} / ${euro(project.target)}</small><wa-progress-bar value="${projectProgress(project)*100}" aria-label="Progression de ${esc(project.name)}"></wa-progress-bar>`}</div>`).join('')}</div>`:'<p class="help-note">Créez un objectif d’épargne, une demande de financement ou un crédit.</p>'}</section>`;
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
    const actions=p?`<div class="budget-heading-actions">${activeMonthText()}${btn('carry-budget','Reporter le budget sur le mois suivant','primary')}</div>`:activeMonthText();
    const header=titleRow('Budget du mois','Des revenus et des dépenses propres à chaque mois.',actions);
    if(!p)return `<div class="dashboard-empty">${header}<div class="dashboard-empty-content">${missingPeriod()}</div></div>`;
    const filters=buildFundingFilters(model.data,p);
    if(!filters.some(option=>option.value===model.fundingFilter))model.fundingFilter='all';
    const filterLabel=model.fundingFilter.startsWith('income:')?'Source de financement sélectionnée':model.fundingFilter.startsWith('account:')?'Compte sélectionné':'Toutes les sources';
    return `${header}<div class="view-toolbar"><wa-select id="fundingFilter" class="form-control" size="s" label="Filtrer par compte ou revenu" value="${esc(model.fundingFilter)}">${filters.map(option=>optionHtml(option.value,option.label,model.fundingFilter)).join('')}</wa-select><div class="inline-actions"><button type="button" class="button button-secondary button-compact" data-action="view-analytics">Vue annuelle</button>${btn('delete-period','Supprimer ce mois','text-btn small')}</div></div>${model.data.migration&&[...p.incomes,...p.expenses].some(item=>item.accountId===model.data.migration.accountId)?'<p class="migration-note">Prévisions importées : affectez les lignes à vos comptes en les modifiant. Le réel reste à renseigner.</p>':''}<div class="budget-ledgers"><section class="panel ledger-panel"><div class="panel-title">${icon('arrow-down-left')}<h2>Entrées d’argent</h2><span class="spacer"></span><button type="button" class="button button-primary button-compact" data-action="add-income">+ Ajouter un revenu</button></div>${entryTable(p,'income')}</section><section class="panel ledger-panel"><div class="panel-title">${icon('wallet')}<h2>Dépenses et épargne</h2><span class="filter-context">${esc(filterLabel)}</span><span class="spacer"></span><button type="button" class="button button-primary button-compact" data-action="add-expense">+ Ajouter une dépense</button></div>${entryTable(p,'expense')}</section></div>${annualSavingsCard(model.selectedPeriod.slice(0,4))}`;
  }
  function marginAmount(value){
    return `<strong class="planned-margin planned-margin-${marginStatus(value,model.data)}">${euro(value)}</strong>`;
  }
  function availableAmounts({planned,real}){
    return `${marginAmount(planned)}<small>Réel : ${marginAmount(real)}</small>`;
  }
  function entrySubtotal(period,kind,account,items,groupKey,groupId,groupLabel,collapsed){
    const total=(entries,amount)=>round(entries.reduce((sum,item)=>sum+amount(item),0));
    const recorded=items.filter(item=>item.realAmount!==null);
    const planned=euro(total(items,item=>item.plannedAmount));
    const real=recorded.length?euro(total(recorded,item=>item.realAmount)):'—';
    const balances=kind==='income'?items.map(item=>fundingBalances(period,item.id)):null;
    const balance=balances
      ? availableAmounts({planned:total(balances,item=>item.planned),real:total(balances,item=>item.real)})
      : recorded.length?euro(total(recorded,item=>item.realAmount-item.plannedAmount)):'—';
    return `<tr class="ledger-account nz-table-group"><th scope="row" colspan="2">${esc(account.name)} · Sous-total</th><td class="nz-table-align-end">${planned}</td><td class="nz-table-align-end">${real}</td><td class="nz-table-align-end">${balance}</td><td><div class="entry-actions"><button type="button" class="ledger-toggle" data-action="toggle-entry-group" data-group-key="${esc(groupKey)}" data-group-label="${esc(groupLabel)}" aria-controls="${groupId}" aria-expanded="${!collapsed}" aria-label="${collapsed?'Déplier':'Replier'} ${esc(groupLabel)}" title="${collapsed?'Déplier':'Replier'} ${esc(groupLabel)}">${icon('chevron',14)}</button></div></td></tr>`;
  }
  function entryTable(p,kind){
    const items=filterBudgetEntries(p,kind,model.fundingFilter);
    if(!items.length)return `<p class="ledger-empty">${kind==='income'?'Aucun revenu':'Aucune dépense'} pour ce filtre.</p>`;
    const groups=(kind==='expense'?[false,true]:[null]).flatMap(recorded=>model.data.accounts.map(account=>({account,recorded,items:items.filter(item=>item.accountId===account.id&&(recorded===null||(item.realAmount!==null)===recorded))}))).filter(group=>group.items.length);
    return `<div class="nz-table-container table-scroll" role="region" aria-label="${kind==='income'?'Liste des revenus':'Liste des dépenses'}" tabindex="0"><table class="nz-table nz-table-compact nz-table-sticky period-table" aria-label="${kind==='income'?'Entrées d’argent':'Dépenses et épargne'}"><thead><tr><th scope="col">Libellé</th><th scope="col">${kind==='income'?'Type / origine':'Catégorie / financement'}</th><th scope="col" class="nz-table-align-end">Prévu</th><th scope="col" class="nz-table-align-end">Réel</th><th scope="col" class="nz-table-align-end">${kind==='income'?'Disponible':'Ecart'}</th><th scope="col" class="nz-table-align-end">Actions</th></tr></thead>${groups.map(({account,items,recorded},index)=>{
      const groupKey=JSON.stringify([p.date,kind,account.id,recorded]);
      const groupId=`budget-${kind}-group-${index}`;
      const groupLabel=`${kind==='income'?'les revenus':recorded?'les dépenses pointées':'les dépenses non pointées'} de ${account.name}`;
      const collapsed=collapsedGroups.has(groupKey);
      return `<tbody>${entrySubtotal(p,kind,account,items,groupKey,groupId,groupLabel,collapsed)}</tbody><tbody id="${groupId}"${collapsed?' hidden':''}>${items.map(item=>{
      const source=p.incomes.find(income=>income.id===(kind==='income'?item.deductedFromIncomeId:item.incomeId));
      const balance=kind==='income'?fundingBalances(p,item.id):null;
      const credit=kind==='expense'&&item.type==='credit'?model.data.projects.find(project=>project.id===item.projectId):null;
      return `<tr><td><strong>${esc(item.name)}</strong>${item.note?`<small>${esc(item.note)}</small>`:''}</td><td><span class="entry-tag">${esc(kind==='income'?typeName(item.typeId):categoryName(item.categoryId))}</span>${credit?`<small>Crédit · ${esc(credit.name)}</small>`:''}<small>${source?`${kind==='income'?'Prélevé sur':'Financé par'} ${esc(source.name)}`:kind==='income'?'Entrée externe':'Compte directement'}</small></td><td class="nz-table-align-end"><strong>${euro(item.plannedAmount)}</strong>${item.plannedDate?`<small>${formatDate(item.plannedDate)}</small>`:''}</td><td class="nz-table-align-end"><strong>${realValue(item.realAmount)}</strong><small>${item.realDate?formatDate(item.realDate):''}</small></td><td class="nz-table-align-end">${balance?availableAmounts(balance):item.realAmount===null?'—':euro(round(item.realAmount-item.plannedAmount))}</td><td><div class="entry-actions">${item.realAmount===null?`<button type="button" class="button button-secondary button-compact" data-action="record-${kind}" data-id="${esc(item.id)}" aria-label="Pointer ${esc(item.name)}" title="Pointer ${esc(item.name)}">${icon('check',14)}<span>Pointer</span></button>`:''}${actionIcon('edit-'+kind,'edit','Modifier '+item.name,`data-id="${esc(item.id)}"`)}${actionIcon('duplicate-'+kind,'copy','Dupliquer '+item.name,`data-id="${esc(item.id)}"`)}${actionIcon('delete-'+kind,'trash','Supprimer '+item.name,`data-id="${esc(item.id)}"`)}</div></td></tr>`;
    }).join('')}</tbody>`;
    }).join('')}</table></div>`;
  }
  function renderAnalytics(){
    const year=model.selectedPeriod.slice(0,4),months=annualPeriods(model.data,year),existing=months.filter(item=>item.period);
    const sum=(mode,key)=>round(existing.reduce((total,item)=>total+item[mode][key],0));
    const max=Math.max(1,...existing.flatMap(item=>[item.planned.income,item.planned.outflow]));
    const entries=existing.map(item=>periodMetricEntries(model.data,item.period));
    return `${titleRow('Vue annuelle',`${existing.length} mois préparés en ${year}. Les mois absents ne sont pas comptabilisés.`,activeMonthText())}<div class="period-metrics">${[['Revenus','income'],['Dépenses','expenses'],['Épargne','savings'],['Marge','margin']].map(([name,key])=>`<section class="panel period-metric"><div class="metric-heading">${name}</div>${metricValues(sum('planned',key),sum('real',key),entries.flatMap(group=>group[key]))}</section>`).join('')}</div><section class="panel overview-panel"><div class="panel-title"><h2>Revenus et sorties prévus</h2></div><div class="year-chart-legend"><span><i class="year-bar-income"></i>Revenus</span><span><i class="year-bar-expenses"></i>Dépenses</span><span><i class="year-bar-savings"></i>Épargne</span><span>Échelle : ${euro(max)}</span></div><div class="year-bars">${months.map((item,i)=>{const label=item.period?`${periodLabel(item.date)} : revenus ${euro(item.planned.income)}, dépenses ${euro(item.planned.expenses)}, épargne ${euro(item.planned.savings)}, marge ${euro(item.planned.margin)}`:`${periodLabel(item.date)} : mois à préparer`;return `<button type="button" class="year-bar-month" data-action="open-period" data-period="${item.date}" aria-label="${esc(label)}"><span class="year-bar-track" aria-hidden="true">${item.period?`<span class="year-bar-income" style="height:${item.planned.income/max*100}%"></span><span class="year-bar-outflow" style="height:${item.planned.outflow/max*100}%"><span class="year-bar-savings" style="height:${item.planned.outflow?item.planned.savings/item.planned.outflow*100:0}%"></span><span class="year-bar-expenses" style="height:${item.planned.outflow?item.planned.expenses/item.planned.outflow*100:0}%"></span></span>`:'<span class="year-bar-missing">—</span>'}</span><small>${MONTHS[i].slice(0,3)}</small><span class="year-bar-tooltip" aria-hidden="true">${esc(label)}</span></button>`;}).join('')}</div><p class="help-note">Par mois : revenus à gauche, dépenses et épargne empilées à droite. Survolez ou sélectionnez un mois au clavier pour les montants ; cliquez pour ouvrir son budget.</p></section><section class="panel ledger-panel"><div class="panel-title"><h2>Détail des mois</h2></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Mois</th><th>Revenus prévus</th><th>Sorties prévues</th><th>Marge prévue</th><th>Marge réelle saisie</th></tr></thead><tbody>${months.map((item,i)=>`<tr><th><a class="month-link" href="#budget" data-action="open-period" data-period="${item.date}">${MONTHS[i]}</a></th>${item.period?`<td>${euro(item.planned.income)}</td><td>${euro(item.planned.outflow)}</td><td>${marginAmount(item.planned.margin)}</td><td>${marginAmount(item.real.margin)}<small>${item.recorded}/${item.entries} lignes</small></td>`:'<td colspan="4" class="muted">Mois à préparer</td>'}</tr>`).join('')}</tbody></table></div></section>`;
  }
  function renderTransactions(){
    const p=period(),entries=p?[...p.incomes.map(item=>({...item,kind:'income'})),...p.expenses.map(item=>({...item,kind:'expense'}))].filter(item=>item.realAmount!==null).sort((a,b)=>(b.realDate||'').localeCompare(a.realDate||'')):[];
    const archives=model.data.legacyTransactions.filter(item=>item.date.startsWith(model.selectedPeriod));
    return `${titleRow('Journal du mois','Les montants réels renseignés dans le budget, réunis au même endroit.',activeMonthText())}<section class="panel ledger-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Montant réel</th><th>Action</th></tr></thead><tbody>${entries.map(item=>`<tr><td>${item.realDate?formatDate(item.realDate):'Non précisée'}</td><td>${esc(item.name)}<small>${item.kind==='income'?'Entrée':'Dépense'}</small></td><td>${esc(accountName(item.accountId))}</td><td>${item.kind==='income'?'+':'−'} ${euro(item.realAmount)}</td><td>${actionIcon('edit-'+item.kind,'edit','Modifier '+item.name,`data-id="${esc(item.id)}"`)}</td></tr>`).join('')||'<tr><td colspan="5">Aucun montant réel renseigné ce mois. Saisissez-le depuis Budget.</td></tr>'}</tbody></table></div></section>${archives.length?`<details class="panel archive-panel"><summary>Anciennes transactions conservées · ${archives.length}</summary><p class="help-note">Ces opérations historiques ne sont pas ajoutées automatiquement au réel du budget.</p>${archives.map(item=>`<div class="pending-row"><span>${esc(item.date)} · ${esc(item.label)}</span><strong>${euro(item.amount)}</strong></div>`).join('')}</details>`:''}`;
  }
  return {renderDashboard,renderBudget,renderAnalytics,renderTransactions,accountSummary,toggleEntryGroup};
}
