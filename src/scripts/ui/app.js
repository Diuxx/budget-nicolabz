import { MONTHS, GROUPS, SETTINGS, euro, shortEuro, percent, round, id, lineAmount, monthlyBudget, annualBudget, spendingBreakdown, projectProgress, dailyActivity, transactionsInMonth, accountBalance, blankYearBalances, createDemoData } from '../core/model.js';
import { loadData, saveData, exportData, readImport } from '../core/storage.js';
import { marginLineChart } from './margin-chart.js';
import { incomeExpenseLineChart } from './income-expense-chart.js';
import { renderIdentityProfile, parseIdentitySession } from './identity-profile.js';

import { IdentityApi } from '../services/identity-api.js';
import { synchronizeIdentity, getIdentitySyncInfo } from '../services/identity-sync.js';
import { IDENTITY_BASE_URL, IDENTITY_APP_ID } from '../config/identity.js';

const app=document.querySelector('#app');
const dialog=document.querySelector('#modal');
const toastElement=document.querySelector('#toast');
const importInput=document.querySelector('#importInput');
const syncChoiceDialog=document.querySelector('#syncChoiceDialog');
let driveBusy=false;
const identityApi=new IdentityApi({ baseUrl: IDENTITY_BASE_URL, appId: IDENTITY_APP_ID });
let sessionState={ authenticated:false, user:null, driveConnected:false };
let identityError=null;
let identityChecking=true;
let sessionRefreshPromise=null;
let locallyModified=false;
const allowedViews=new Set(['dashboard','budget','analytics','transactions','projects','accounts','settings']);
let state; let currentView='dashboard'; let year='2026'; let month=9; let annualGrid=false; let toastTimer;
const categoryPalette=['#cfe5d5','#a8d5bb','#7dac99','#638f80','#59726d','#83918c'];
const iconPaths={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 16l4-5 4 2 5-7"/>',
  bar:'<path d="M5 20v-7M10 20V8M15 20v-11M20 20V4"/>',
  wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a3 3 0 0 1-3-3"/><path d="M22 13h-6a2 2 0 1 0 0 4h6"/>',
  coins:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  arrowUp:'<path d="m6 14 6-6 6 6M12 8v12"/>',
  arrowDown:'<path d="m6 10 6 6 6-6M12 16V4"/>',
  'arrow-down-left':'<path d="M17 7 7 17M7 7v10h10"/>',
  house:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  piggy:'<path d="M19 9c1.2 1 2 2.5 2 4.2 0 3.7-3 6.8-7 6.8H8c-3.5 0-6-2.7-6-6 0-2.5 1.6-4.4 4-5.5A8 8 0 0 1 17 6l3-1-.5 4"/><path d="M9 8h4M8 20v2M17 20v2"/><circle cx="16" cy="12" r=".7" fill="currentColor" stroke="none"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  left:'<path d="m15 18-6-6 6-6"/>',
  edit:'<path d="m15 5 4 4M4 20l4-.8L20 7a2.8 2.8 0 0 0-4-4L4 15z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert:'<path d="M12 3 2 21h20L12 3zM12 9v5M12 17h.01"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  menu:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  credit:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  motorcycle:'<circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 18 9 9l4 9 3-7h3M9 9h4M15 7h4"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.grid}</svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const amountValue=n=>n==null?'':String(n);
const monYear=()=>`${MONTHS[month]} ${year}`;
const titleRow=(heading,subtitle,action='')=>`<div class="section-heading"><div><h1>${heading}</h1><p>${subtitle}</p></div>${action}</div>`;
const btn=(action,label,kind='secondary',other='')=>`<wa-button type="button" appearance="filled" variant="${kind==='primary'?'brand':kind==='danger'?'danger':'neutral'}" class="btn ${kind}" data-action="${action}" ${other}>${label}</wa-button>`;
const webIcon=(name,label='')=>`<wa-icon name="${name}" ${label?`label="${esc(label)}"`:'aria-hidden="true"'}></wa-icon>`;
const actionIcon=(action,iconName,aria,attrs='')=>`<wa-tooltip for="action-${action}-${esc(attrs.match(/data-id="([^"]+)"/)?.[1]||'global')}">${esc(aria)}</wa-tooltip><wa-button id="action-${action}-${esc(attrs.match(/data-id="([^"]+)"/)?.[1]||'global')}" type="button" size="xs" appearance="outlined" variant="neutral" class="mini-icon" data-action="${action}" aria-label="${esc(aria)}" title="${esc(aria)}" ${attrs}>${webIcon(({plus:'plus',left:'chevron-left',chevron:'chevron-right',edit:'pen',trash:'trash',close:'xmark'})[iconName]||iconName,aria)}</wa-button>`;
const empty=(title,text,actionHtml='')=>`<div class="empty-state">${icon('info',24)}<strong>${title}</strong><p>${text}</p>${actionHtml}</div>`;
const formatDate=date=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`));
const optionHtml=(value,label,selected)=>`<wa-option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</wa-option>`;
const activeMonthText=()=>`<div class="period-actions">
    <wa-select id="monthSelect" size="s" pill aria-label="Mois affiché" value="${month}">${MONTHS.map((n,i)=>optionHtml(i,n,month)).join('')}</wa-select>
    <wa-select id="yearSelect" size="s" pill aria-label="Année affichée" value="${year}">${Object.keys(state.years).map(y=>optionHtml(y,y,year)).join('')}</wa-select>
    ${actionIcon('prev-month','left','Mois précédent')}${actionIcon('next-month','chevron','Mois suivant')}
  </div>`;
function showToast(message,isError=false) {toastElement.textContent=message;toastElement.className=`visible ${isError?'error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastElement.className='',4000);}
function commit(message='Enregistré localement · Google Drive à synchroniser') {
  try {saveData(state);locallyModified=true;render();showToast(message);}catch(error){showToast(`Sauvegarde impossible : ${error.message}`,true);}
}
function setView(view) {if(!allowedViews.has(view))return;currentView=view;location.hash=view;render();window.scrollTo({top:0,behavior:'smooth'});}
function render() {
  document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===currentView);button.setAttribute('aria-current',button.dataset.view===currentView?'page':'false');});
  document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icon(node.dataset.icon));
  const views={dashboard:renderDashboard,budget:renderBudget,analytics:renderAnalytics,transactions:renderTransactions,projects:renderProjects,accounts:renderAccounts,settings:renderSettings};
  app.innerHTML=views[currentView]();
  updateDriveStatus();
}

function renderDashboard() {
  const m=monthlyBudget(state,year,month),summary=annualBudget(state,year);
  return `<section class="welcome-row">${titleRow('Bon retour.','Voici un aperçu de votre situation financière pour ce mois.')}${activeMonthText()}</section>
    ${state.importedFromExcel?'':`<div class="demo-banner">${icon('info',16)} <span>Mode démonstration — montants fictifs. Importez votre sauvegarde Excel convertie pour retrouver votre budget.</span>${btn('import','Importer','text-btn')}</div>`}
    <div class="dashboard-grid">
      <section class="panel summary-panel">
        <div class="panel-title">${icon('wallet',19)} <h2>Reste disponible prévu</h2><span class="spacer"></span>${icon('menu',17)}</div>
        <div class="big-value ${m.cashflow<0?'negative':''}">${euro(m.cashflow)} <span class="status-note ${m.cashflow>=m.threshold?'positive':'warning'}">${icon(m.cashflow>=m.threshold?'check':'alert',14)} ${m.cashflow>=m.threshold?'Objectif de marge atteint':'Sous la marge cible'}</span></div>
        <div class="summary-caption">Budget prévisionnel · ${esc(monYear())} · seuil : ${euro(m.threshold)}</div>
        <div class="summary-divider"></div>
        <div class="stat-strip">
          <div><span class="metric-icon">${icon('arrowDown',19)}</span><small>Revenus du mois</small><strong>${euro(m.income)}</strong></div>
          <div><span class="metric-icon">${icon('wallet',19)}</span><small>Charges et dépenses</small><strong>${euro(m.expenses)}</strong></div>
          <div><span class="metric-icon">${icon('piggy',19)}</span><small>Épargne / projets / crédits</small><strong>${euro(m.savings)}</strong></div>
        </div>
      </section>
      <section class="panel chart-panel">
        <div class="panel-title">${icon('chart',19)}<h2>Revenus vs. dépenses</h2><span class="spacer"></span><div class="legend"><span class="legend-square income-color"></span> Revenus <span class="legend-square expense-color"></span> Charges + variables</div></div>
        ${incomeExpenseLineChart(summary.months, month)}
      </section>
      <section class="panel donut-panel"><div class="panel-title">${icon('chart',19)}<h2>Répartition des dépenses</h2><span class="spacer"></span><span class="small-label">${esc(MONTHS[month])}</span></div>${donutChart(m)}</section>
      <section class="panel activity-panel"><div class="panel-title">${icon('calendar',19)}<h2>Activité du mois</h2><span class="spacer"></span><span class="small-label">${esc(MONTHS[month])}</span></div>${heatmap()}</section>
      <section class="panel recent-panel"><div class="panel-title">${icon('list',19)}<h2>Transactions récentes</h2><span class="spacer"></span>${btn('view-transactions','Voir tout','quiet small')}</div>${renderRecentTransactions()}</section>
      <section class="panel accounts-panel"><div class="panel-title">${icon('coins',19)}<h2>Comptes annexes</h2><span class="spacer"></span>${btn('view-accounts','Gérer','quiet small')}</div>${renderCompactAccounts()}</section>
      <section class="panel projects-panel"><div class="panel-title">${icon('target',19)}<h2>Projets de financement</h2><span class="spacer"></span>${btn('view-projects','Voir tous','quiet small')}${actionIcon('add-project','plus','Ajouter un projet')}</div>${renderCompactProjects()}</section>
    </div>`;
}
function donutChart(monthData) {
  const rows=spendingBreakdown(state,year,month),total=rows.reduce((n,r)=>n+r.value,0);
  let cursor=0;
  const sections=rows.map((item,index)=>{const next=cursor+item.value/(total||1)*100;const part=`${categoryPalette[index]} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`;cursor=next;return part;});
  return `<div class="donut-content"><div class="donut" style="background:conic-gradient(${sections.length?sections.join(','):'#34413d 0% 100%'})"><div class="donut-inner"><strong>${shortEuro(monthData.expenses)}</strong><small>dépenses prévues</small></div></div>
    <div class="donut-list">${rows.map((item,index)=>`<div class="donut-row"><span class="color-dot" style="background:${categoryPalette[index]}"></span><span class="truncate" title="${esc(item.label)}">${esc(item.label)}</span><strong>${shortEuro(item.value)}</strong><small>${percent(item.value/(total||1))}</small></div>`).join('')||'<p class="muted">Aucune dépense prévue.</p>'}</div></div>`;
}
function heatmap() {
  const counts=dailyActivity(state.transactions,year,month);
  const offset=(new Date(Number(year),month,1).getDay()+6)%7;
  const slots=[...Array.from({length:offset},()=>'<div class="heat-placeholder"></div>'),...counts.map((n,i)=>`<div class="heat-cell level-${Math.min(4,n)}" title="${i+1} ${MONTHS[month].toLowerCase()} : ${n} transaction${n>1?'s':''}"><span>${i+1}</span></div>`)];
  return `<div class="heat-content"><div class="heat-days">${['L','M','M','J','V','S','D'].map(s=>`<span>${s}</span>`).join('')}</div><div class="heat-grid">${slots.join('')}</div>
    <div class="heat-footer"><span>${counts.reduce((a,b)=>a+b,0)} opération(s) renseignée(s)</span><span>Moins <i class="heat-key level-0"></i><i class="heat-key level-1"></i><i class="heat-key level-2"></i><i class="heat-key level-3"></i> Plus</span></div></div>`;
}
function transactionLine(transaction) {
  const positive=transaction.amount>=0;
  return `<div class="compact-row tx-row"><span class="row-avatar">${icon(positive?'arrowDown':'credit',19)}</span><div class="row-label"><strong>${esc(transaction.label)}</strong><small>${esc(transaction.category)} · ${esc(formatDate(transaction.date))}</small></div><span class="spacer"></span><strong class="amount ${positive?'positive':''}">${positive?'+':''}${euro(transaction.amount)}</strong></div>`;
}
function renderRecentTransactions() {
  const items=transactionsInMonth(state,year,month).slice(0,4);
  return items.length?`<div class="compact-list">${items.map(transactionLine).join('')}</div>`:empty('Aucune transaction','Ajoutez une opération pour alimenter le suivi quotidien.',btn('add-transaction','Ajouter','secondary small'));
}
function renderCompactAccounts() {
  return state.accounts.length?`<div class="compact-list">${state.accounts.slice(0,4).map(a=>`<button type="button" class="compact-row clickable" data-action="edit-account" data-id="${esc(a.id)}"><span class="row-avatar">${icon('wallet',19)}</span><div class="row-label"><strong>${esc(a.name)}</strong><small>${esc(a.type)}</small></div><span class="spacer"></span><strong class="account-sum">${accountBalance(a,year,month)==null?'À renseigner':euro(accountBalance(a,year,month))}</strong>${icon('chevron',16)}</button>`).join('')}</div>`:empty('Aucun compte annexe','Ajoutez N26 ou tout autre compte à suivre.',btn('add-account','Créer un compte','secondary small'));
}
function renderCompactProjects() {
  return state.projects.length?`<div class="compact-list">${state.projects.slice(0,4).map((p,i)=>`<button type="button" class="compact-row project-row clickable" data-action="edit-project" data-id="${esc(p.id)}"><span class="row-avatar project-avatar">${icon(i%3===0?'motorcycle':i%3===1?'piggy':'briefcase',21)}</span><div class="row-label project-description"><strong>${esc(p.name)}</strong><small>${esc(p.description||'Objectif personnel')}</small></div><div class="project-numbers"><strong>${euro(p.target)}</strong><small>${euro(p.saved)} financés</small></div><div class="progress-cell"><wa-progress-bar value="${projectProgress(p)*100}" aria-label="Projet financé à ${Math.round(projectProgress(p)*100)} %"></wa-progress-bar><small>${percent(projectProgress(p))}</small></div>${icon('chevron',16)}</button>`).join('')}</div>`:empty('Aucun projet','Ajoutez un objectif avec un montant cible.',btn('add-project','Nouveau projet','secondary small'));
}
function renderBudget() {
  const summary=annualBudget(state,year),m=monthlyBudget(state,year,month);
  return `${titleRow('Budget prévisionnel','Tous vos postes de revenus et de dépenses, dans la logique de votre classeur Excel.',`${activeMonthText()}`)}
    <div class="view-toolbar"><div class="segmented"><wa-button type="button" size="s" appearance="${annualGrid?'plain':'filled'}" variant="${annualGrid?'neutral':'brand'}" data-action="budget-month" class="${annualGrid?'':'selected'}">Mensuel</wa-button><wa-button type="button" size="s" appearance="${annualGrid?'filled':'plain'}" variant="${annualGrid?'brand':'neutral'}" data-action="budget-year" class="${annualGrid?'selected':''}">Annuel</wa-button></div>${btn('add-line',webIcon('plus')+' Ajouter un poste','primary')}</div>
    <div class="kpi-grid"><div class="small-kpi"><small>Revenus du mois</small><strong>${euro(m.income)}</strong></div><div class="small-kpi"><small>Charges et dépenses</small><strong>${euro(m.expenses)}</strong></div><div class="small-kpi"><small>Épargne / projets / crédits</small><strong>${euro(m.savings)}</strong></div><div class="small-kpi"><small>Marge mensuelle</small><strong class="${m.cashflow<0?'negative':''}">${euro(m.cashflow)}</strong></div></div>
    ${annualGrid?renderAnnualGrid(summary):renderMonthlyLines()}`;
}
function groupedLines(group) {return state.years[year].lines.filter(line=>line.group===group);}
function renderMonthlyLines() {
  return `<div class="budget-categories">${GROUPS.map(g=>{
    const lines=groupedLines(g.id);const sum=round(lines.reduce((total,line)=>total+lineAmount(line,month,state.settings),0));
    return `<section class="panel budget-group"><header class="budget-group-heading"><span class="group-icon">${icon(g.icon,19)}</span><div><h2>${g.label}</h2><small>${lines.length} poste(s)</small></div><strong>${euro(sum)}</strong></header>
    <div class="budget-lines">${lines.map(line=>`<div class="budget-line"><div><strong>${esc(line.label)}</strong><small>${esc(line.type)}${line.links?.[String(month)]?' · lié aux paramètres':''}</small></div><div class="budget-controls"><wa-input size="xs" class="amount-control" type="number" data-field="budget-amount" data-id="${esc(line.id)}" data-month="${month}" step="0.01" value="${line.links?.[String(month)]?lineAmount(line,month,state.settings):amountValue(line.amounts[month])}" ${line.links?.[String(month)]?'disabled title="Valeur pilotée depuis Paramètres"':''} aria-label="${esc(line.label)} en ${esc(MONTHS[month])}"><span slot="end">€</span></wa-input>${actionIcon('edit-line','edit',`Modifier ${line.label}`,`data-id="${esc(line.id)}"`)}${actionIcon('delete-line','trash',`Supprimer ${line.label}`,`data-id="${esc(line.id)}"`)}</div></div>`).join('')||'<div class="muted padding">Aucun poste.</div>'}</div></section>`;}).join('')}</div>`;
}
function renderAnnualGrid(summary) {
  return `<section class="panel annual-panel"><div class="table-scroll"><table class="budget-table"><thead><tr><th>Poste</th>${MONTHS.map(m=>`<th>${esc(m.slice(0,4))}</th>`).join('')}<th>Total</th></tr></thead><tbody>${GROUPS.map(group=>{
    const lines=groupedLines(group.id);const subtotal=MONTHS.map((_,i)=>round(lines.reduce((n,l)=>n+lineAmount(l,i,state.settings),0)));
    return `<tr class="table-group"><td colspan="14">${esc(group.label)}</td></tr>${lines.map(line=>`<tr><th>${esc(line.label)}</th>${MONTHS.map((_,i)=>`<td><input type="number" step=".01" data-field="budget-amount" data-id="${esc(line.id)}" data-month="${i}" value="${line.links?.[String(i)]?lineAmount(line,i,state.settings):amountValue(line.amounts[i])}" ${line.links?.[String(i)]?'disabled title="Lié aux paramètres"':''} aria-label="${esc(line.label)} ${MONTHS[i]}"></td>`).join('')}<td>${shortEuro(MONTHS.reduce((n,_,i)=>n+lineAmount(line,i,state.settings),0))}</td></tr>`).join('')}<tr class="table-subtotal"><th>Total ${esc(group.label)}</th>${subtotal.map(v=>`<td>${shortEuro(v)}</td>`).join('')}<td>${shortEuro(subtotal.reduce((n,v)=>n+v,0))}</td></tr>`;
  }).join('')}<tr class="table-net"><th>Marge disponible</th>${summary.months.map(m=>`<td class="${m.cashflow<0?'negative':''}">${shortEuro(m.cashflow)}</td>`).join('')}<td>${shortEuro(summary.cashflow)}</td></tr></tbody></table></div></section>`;
}
function renderAnalytics() {
  const annual=annualBudget(state,year);
  return `${titleRow('Analyses budgétaires','Suivez les tendances de revenus, de dépenses et de marge sur l’année.',activeMonthText())}
    <div class="kpi-grid"><div class="small-kpi"><small>Revenus annuels</small><strong>${euro(annual.income)}</strong></div><div class="small-kpi"><small>Dépenses annuelles</small><strong>${euro(annual.expenses)}</strong></div><div class="small-kpi"><small>Épargne patrimoniale</small><strong>${euro(annual.wealthSavings)}</strong><small>${percent(annual.savingsRate)} des revenus</small></div><div class="small-kpi"><small>Cash-flow annuel</small><strong>${euro(annual.cashflow)}</strong></div></div>
    <div class="analytics-grid"><section class="panel"><div class="panel-title">${icon('bar')}<h2>Revenus / dépenses · ${year}</h2></div>${fullYearChart(annual.months)}</section><section class="panel"><div class="panel-title">${icon('target')}<h2>Marge par mois</h2></div>${marginLineChart(annual.months)}<p class="panel-note">${annual.belowThreshold} mois sous la marge minimale définie dans les paramètres.</p></section></div>`;
}
function fullYearChart(months) {
  const max=Math.max(1000,...months.map(x=>Math.max(x.income,x.expenses)))*1.1;
  return `<div class="chart-wrap year-chart"><svg viewBox="0 0 900 285" role="img" aria-label="Revenus et dépenses prévisionnels sur douze mois">${[0,.25,.5,.75,1].map(k=>`<line x1="68" x2="890" y1="${239-k*205}" y2="${239-k*205}" stroke="#34413d"/><text class="chart-text" x="58" y="${244-k*205}" text-anchor="end">${shortEuro(max*k)}</text>`).join('')}${months.map((m,i)=>{const h1=m.income/max*205,h2=m.expenses/max*205,x=75+i*68;return `<rect x="${x}" y="${239-h1}" width="24" height="${h1}" rx="4" fill="#cfe5d5"/><rect x="${x+25}" y="${239-h2}" width="24" height="${h2}" rx="4" fill="#628f7d"/><text class="chart-text" x="${x+23}" y="265" text-anchor="middle">${MONTHS[i].slice(0,3)}</text>`;}).join('')}</svg></div><p class="panel-note"><span class="legend-square income-color"></span> Revenus &nbsp; <span class="legend-square expense-color"></span> Dépenses (hors épargne et projets)</p>`;
}
function renderTransactions() {
  const items=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  const scoped=items.filter(t=>t.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`));
  const total=scoped.reduce((n,t)=>n+t.amount,0);
  return `${titleRow('Transactions','Opérations saisies manuellement. Le budget Excel reste une prévision indépendante.',activeMonthText())}<div class="view-toolbar"><p class="muted">${scoped.length} transaction(s) · flux net de ${euro(total)} · ${monYear()}</p>${btn('add-transaction',icon('plus',16)+' Ajouter une transaction','primary')}</div>
    <section class="panel list-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Compte</th><th class="align-right">Montant</th><th class="align-right">Actions</th></tr></thead><tbody>${scoped.map(t=>`<tr><td>${formatDate(t.date)}</td><td><strong>${esc(t.label)}</strong></td><td>${esc(t.category)}</td><td>${esc(state.accounts.find(a=>a.id===t.accountId)?.name||'—')}</td><td class="align-right ${t.amount>=0?'positive':''}">${t.amount>=0?'+':''}${euro(t.amount)}</td><td class="align-right">${actionIcon('edit-transaction','edit','Modifier',`data-id="${esc(t.id)}"`)}${actionIcon('delete-transaction','trash','Supprimer',`data-id="${esc(t.id)}"`)}</td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">Aucune opération sur cette période. Ajoutez une transaction pour commencer.</td></tr>'}</tbody></table></div></section>
    <p class="help-note">Les opérations servent au suivi des mouvements et à l’activité. Elles ne sont pas déduites à nouveau des budgets prévisionnels et ne modifient pas automatiquement les soldes manuels des comptes.</p>`;
}
function renderProjects() {
  const target=state.projects.reduce((n,p)=>n+p.target,0),saved=state.projects.reduce((n,p)=>n+p.saved,0);
  return `${titleRow('Projets de financement','Créez plusieurs objectifs et mesurez votre progression sans les confondre avec les dépenses.',btn('add-project',icon('plus',16)+' Nouveau projet','primary'))}
    <div class="kpi-grid two"><div class="small-kpi"><small>Montant total des objectifs</small><strong>${euro(target)}</strong></div><div class="small-kpi"><small>Montant déjà financé</small><strong>${euro(saved)}</strong></div></div>
    <div class="project-cards">${state.projects.map((p,i)=>`<section class="panel funding-card"><div class="funding-top"><span class="funding-icon">${icon(i%3===0?'motorcycle':i%3===1?'piggy':'briefcase',26)}</span><div><h2>${esc(p.name)}</h2><p>${esc(p.description||'Objectif personnel')}</p></div><span class="spacer"></span>${actionIcon('edit-project','edit','Modifier le projet',`data-id="${esc(p.id)}"`)}${actionIcon('delete-project','trash','Supprimer le projet',`data-id="${esc(p.id)}"`)}</div><div class="funding-values"><strong>${euro(p.saved)}</strong><span>sur ${euro(p.target)}</span></div><wa-progress-bar class="large" value="${projectProgress(p)*100}" aria-label="Projet financé à ${Math.round(projectProgress(p)*100)} %"></wa-progress-bar><div class="funding-footer"><span>${percent(projectProgress(p))} financé</span><span>Reste ${euro(Math.max(0,p.target-p.saved))}</span></div></section>`).join('')||empty('Aucun projet','Ajoutez un objectif : moto, voyage, PC ou épargne de précaution.',btn('add-project','Créer mon premier projet','primary'))}</div>
    <p class="help-note">Le montant « déjà financé » est renseigné par vos soins. Les versements prévus dans le budget sont conservés à part : aucun double comptage.</p>`;
}
function renderAccounts() {
  return `${titleRow('Comptes annexes','Suivez N26, un livret, un compte partagé ou tout autre compte que vous ajoutez.',`${activeMonthText()} ${btn('add-account',icon('plus',16)+' Ajouter un compte','primary')}`)}
    <div class="account-cards">${state.accounts.map(a=>{const bal=accountBalance(a,year,month);return `<section class="panel account-card"><header><span class="funding-icon">${icon('wallet',25)}</span><div><h2>${esc(a.name)}</h2><small>${esc(a.type)}</small></div><span class="spacer"></span>${actionIcon('edit-account','edit','Modifier le compte',`data-id="${esc(a.id)}"`)}${actionIcon('delete-account','trash','Supprimer le compte',`data-id="${esc(a.id)}"`)}</header><p class="balance-label">Solde saisi · ${esc(monYear())}</p><strong class="balance-amount">${bal===null?'Non renseigné':euro(bal)}</strong>${a.legacyExpenses?`<div class="legacy-envelope">${legacyEnvelope(a)}</div>`:''}<div class="account-actions">${btn('edit-balance',icon('edit',15)+' Modifier le solde','secondary small',`data-id="${esc(a.id)}"`)}${a.legacyExpenses?btn('edit-account-spending','Dépenses N26','secondary small',`data-id="${esc(a.id)}"`):''}</div></section>`;}).join('')||empty('Aucun compte','Ajoutez un compte pour suivre son solde mensuel.',btn('add-account','Ajouter un compte','primary'))}</div>
    <p class="help-note">Les soldes sont des valeurs manuelles, indépendantes des prévisions budgétaires. Lors de l’import Excel, aucun solde bancaire n’est inventé.</p>`;
}
function legacyEnvelope(account) {
  const source=account.legacyExpenses?.[year];
  const spent=source?.expenses?.[month]??null;
  const line=state.years[year].lines.find(l=>l.role==='n26Envelope'||l.label==='N26 Loisir');
  const envelope=line?lineAmount(line,month,state.settings):null;
  return `<p>Enveloppe loisirs : ${envelope===null?'—':euro(envelope)}<br>Dépenses déclarées : ${spent===null?'—':euro(spent)}${spent===null||envelope===null?'':`<br>Reste enveloppe : ${euro(envelope-spent)}`}</p>`;
}
function spendingForm(account) {
  const entry=account.legacyExpenses?.[year];
  if(!entry)return;
  openForm('Dépenses N26',[{name:'spent',label:`Dépenses de ${monYear()} (€)`,type:'number',value:entry.expenses[month]??0,min:0}],value=>{if(value.spent<0)throw new Error('Montant négatif non autorisé.');entry.expenses[month]=value.spent;},'Ces dépenses détaillent une enveloppe déjà présente dans le budget. Elles ne sont pas retranchées une deuxième fois.');
}
function renderSettings() {
  return `${titleRow('Paramètres','Ces valeurs alimentent certaines cellules liées de votre budget Excel.')}
    <div class="settings-layout"><section class="panel settings-panel"><div class="panel-title">${icon('filter',19)}<h2>Prévisions et objectifs</h2></div><div class="settings-grid">${SETTINGS.map(setting=>`<label class="settings-field"><span><strong>${esc(setting.label)}</strong><small>${esc(setting.hint)}</small></span><wa-input class="amount-control" size="s" type="number" data-field="setting" data-key="${setting.key}" step="${setting.key==='loanMonths'?'1':'0.01'}" value="${state.settings[setting.key]}" aria-label="${esc(setting.label)}"><span slot="end">${setting.unit}</span></wa-input></label>`).join('')}</div></section>
    <section class="panel tools-panel"><div class="panel-title">${icon('download',19)}<h2>Données et sauvegardes</h2></div><p>Vos données sont enregistrées dans le stockage local de ce navigateur. Aucun compte ni serveur nécessaire.</p><div class="tool-buttons">${btn('export',icon('download',17)+' Exporter en JSON','primary')}${btn('import',icon('upload',17)+' Importer un JSON','secondary')}${btn('reset',icon('refresh',17)+' Réinitialiser la démo','danger')}</div><p class="help-note">Compatible avec les sauvegardes JSON de la version précédente (v1), sans les écrans repas et courses.</p></section>
    <section class="panel tools-panel drive-panel"><div class="panel-title">${icon('coins',19)}<h2>Google Drive · synchronisation</h2></div>
      <p>Connexion Google et stockage dans l’espace Drive privé de Nicolabz Identity (<code>appDataFolder</code>). Aucune donnée envoyée sans votre action.</p>
      <div class="drive-status" id="driveStatus" role="status">Connexion non vérifiée</div>
      <div class="drive-actions">
        ${btn('auth-login','Se connecter avec Google','secondary')}${btn('auth-drive','Autoriser Google Drive','secondary')}${btn('drive-sync',icon('refresh',16)+' Synchroniser','primary')}
        ${btn('drive-pull',icon('download',16)+' Récupérer depuis Drive','secondary')}
        ${btn('drive-push',icon('upload',16)+' Envoyer vers Drive','secondary')}
        ${btn('auth-drive-disconnect','Dissocier Google Drive','text-btn')}${btn('auth-logout','Déconnexion','text-btn')}
      </div>
      <p class="drive-meta" id="driveMeta">Connexion via Nicolabz Identity : aucune clé Google n’est nécessaire dans Marge.</p>
      <p class="help-note">Synchronisation manuelle : aucune fusion automatique. Les modifications d'un autre appareil sont détectées lors de la synchronisation. Exportez un JSON avant un remplacement important.</p>
    </section></div>`;
}
function fieldHtml(field) {
  const common=`name="${esc(field.name)}" id="f-${esc(field.name)}" ${field.required===false?'':'required'}`;
  const label=esc(field.label);
  if(field.type==='select')return `<wa-select class="form-control" size="s" label="${label}" ${common} value="${esc(field.value??'')}">${field.options.map(item=>optionHtml(item.value,item.label,field.value)).join('')}</wa-select>`;
  if(field.type==='textarea')return `<wa-textarea class="form-control" size="s" label="${label}" ${common} rows="2" resize="vertical" maxlength="500" value="${esc(field.value??'')}"></wa-textarea>`;
  return `<wa-input class="form-control" size="s" label="${label}" ${common} type="${field.type||'text'}" value="${esc(field.value??'')}" ${field.type==='number'?'step="0.01"':''} ${field.min!==undefined?`min="${field.min}"`:''} ${field.type==='text'?'maxlength="120"':''}></wa-input>`;
}
function readFormValues(form,fields) {
  // Les contrôles Web Awesome sont form-associated. La lecture explicite de value
  // évite de dépendre du timing de customElements lorsque le formulaire vient d'être affiché.
  return Object.fromEntries(fields.map(field=>{
    const control=form.querySelector(`[name="${field.name}"]`);
    const raw=control?.value??'';
    return [field.name,field.type==='number' ? (String(raw).trim()===''?null:Number(raw)) : String(raw).trim()];
  }));
}
function openForm(title,fields,onSave,description='') {
  dialog.label=title;
  dialog.innerHTML=`<form class="modal-form" id="dialogForm">${description?`<p class="modal-description">${esc(description)}</p>`:''}<div class="form-fields">${fields.map(fieldHtml).join('')}</div><div class="modal-footer"><wa-button type="button" size="s" appearance="outlined" variant="neutral" id="cancelModal">Annuler</wa-button><wa-button type="submit" size="s" appearance="filled" variant="brand">Enregistrer</wa-button></div></form>`;
  dialog.open=true;
  dialog.querySelector('#cancelModal').addEventListener('click',()=>{dialog.open=false;});
  dialog.querySelector('form').addEventListener('submit',event=>{
    event.preventDefault();
    const values=readFormValues(event.currentTarget,fields);
    if(fields.some(field=>field.required!==false && (values[field.name]===null||values[field.name]===''))){showToast('Complétez les champs obligatoires.',true);return;}
    if(fields.some(field=>field.type==='number' && (values[field.name]!==null && !Number.isFinite(values[field.name])))){showToast('Saisissez des montants valides.',true);return;}
    try{onSave(values);dialog.open=false;commit();}catch(error){showToast(error.message,true);}
  });
}
function projectForm(project) {
  const creating=!project;
  openForm(creating?'Créer un projet':'Modifier le projet',[
    {name:'name',label:'Nom du projet',type:'text',value:project?.name||''},
    {name:'description',label:'Description',type:'textarea',value:project?.description||'',required:false},
    {name:'target',label:'Montant cible (€)',type:'number',value:project?.target??1000,min:0},
    {name:'saved',label:'Montant déjà financé (€)',type:'number',value:project?.saved??0,min:0},
  ],value=>{if(!value.name||value.target<0||value.saved<0)throw new Error('Renseignez un nom et des montants positifs.');if(creating)state.projects.push({id:id(),...value});else Object.assign(project,value);});
}
function accountForm(account) {
  const creating=!account;
  openForm(creating?'Ajouter un compte':'Modifier le compte',[
    {name:'name',label:'Nom du compte',type:'text',value:account?.name||''},
    {name:'type',label:'Type de compte',type:'select',value:account?.type||'Compte courant',options:['Compte courant','Compte annexe','Compte partagé','Épargne','Livret','Autre'].map(v=>({value:v,label:v}))},
    ...(creating?[{name:'balance',label:`Solde pour ${monYear()} (€) · facultatif`,type:'number',value:0,required:false}]:[]),
  ],value=>{if(!value.name)throw new Error('Renseignez le nom du compte.');if(creating){const balances={'2026':blankYearBalances(),'2027':blankYearBalances()};balances[year][month]=value.balance;state.accounts.push({id:id(),name:value.name,type:value.type,balances});}else Object.assign(account,{name:value.name,type:value.type});});
}
function lineForm(line) {
  const creating=!line;
  openForm(creating?'Ajouter un poste':'Modifier le poste',[
    {name:'label',label:'Libellé',type:'text',value:line?.label||''},
    {name:'group',label:'Section',type:'select',value:line?.group||'variable',options:GROUPS.map(g=>({value:g.id,label:g.label}))},
    {name:'type',label:'Type de poste',type:'select',value:line?.type||'Variable',options:['Revenu','Épargne','Projet','Crédit','Fixe','Variable','Autre'].map(v=>({value:v,label:v}))},
    ...(creating?[{name:'amount',label:'Montant mensuel par défaut (€)',type:'number',value:0}]:[]),
  ],value=>{if(!value.label)throw new Error('Le libellé ne peut pas être vide.');if(creating)state.years[year].lines.push({id:id(),label:value.label,group:value.group,type:value.type,amounts:MONTHS.map(()=>value.amount),links:{}});else Object.assign(line,{label:value.label,group:value.group,type:value.type});});
}
function transactionForm(transaction) {
  const creating=!transaction;
  const date=`${year}-${String(month+1).padStart(2,'0')}-${String(Math.min(28,new Date().getDate())).padStart(2,'0')}`;
  openForm(creating?'Ajouter une transaction':'Modifier la transaction',[
    {name:'date',label:'Date',type:'date',value:transaction?.date||date},
    {name:'label',label:'Libellé',type:'text',value:transaction?.label||''},
    {name:'category',label:'Catégorie',type:'select',value:transaction?.category||'Divers',options:['Revenus','Logement','Alimentation','Transport','Loisirs','Abonnements','Santé','Épargne','Divers','Autres'].map(v=>({value:v,label:v}))},
    {name:'amount',label:'Montant (+ entrée / − sortie)',type:'number',value:transaction?.amount??-20},
    {name:'accountId',label:'Compte (facultatif)',type:'select',value:transaction?.accountId||'',options:[{value:'',label:'Aucun compte'},...state.accounts.map(a=>({value:a.id,label:a.name}))]},
  ],value=>{if(!value.label)throw new Error('Le libellé est obligatoire.');const dateParts=value.date.split('-').map(Number);const d=new Date(`${value.date}T12:00:00`);if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||d.getFullYear()!==dateParts[0]||d.getMonth()+1!==dateParts[1]||d.getDate()!==dateParts[2])throw new Error('Date invalide.');value.accountId=value.accountId||null;if(creating)state.transactions.push({id:id(),...value});else Object.assign(transaction,value);});
}
function balanceForm(account) {
  const current=accountBalance(account,year,month);
  openForm(`Solde de ${account.name}`,[{name:'balance',label:`Solde en ${monYear()} (€)`,type:'number',value:current??0}],value=>{account.balances[year][month]=value.balance;});
}
function askDelete(items,key,label) {
  const element=items.find(item=>item.id===key);if(!element)return;
  if(!confirm(`Supprimer « ${label||element.name||element.label} » ? Cette action est irréversible sans sauvegarde JSON.`))return;
  if(items===state.accounts)state.transactions.forEach(t=>{if(t.accountId===key)t.accountId=null;});
  items.splice(items.indexOf(element),1);commit('Élément supprimé.');
}
function updateDriveStatus() {
  const indicator=document.querySelector('#driveStatus');
  if (indicator) {
    indicator.classList.toggle('connected',sessionState.driveConnected);
    indicator.textContent=identityError ? `Service indisponible : ${identityError}`
      : !sessionState.authenticated ? 'Compte Google non connecté'
      : !sessionState.driveConnected ? 'Compte connecté · autorisation Drive requise'
      : 'Google Drive connecté · prêt à synchroniser';
    const meta=document.querySelector('#driveMeta');
    const anchor=getIdentitySyncInfo({ storage:localStorage, appId:identityApi.appId, userId:sessionState.user?.id });
    if (meta) meta.textContent=anchor
      ? `Dernière synchronisation confirmée : ${new Date(anchor.updatedAt).toLocaleString('fr-FR')} · version ${anchor.version}`
      : 'Aucune synchronisation confirmée sur cet appareil pour ce compte.';
  }
  updateProfile();
}

function updateProfile() {
  renderIdentityProfile(document, {
    session: sessionState,
    checking: identityChecking,
    error: identityError,
    locallyModified,
  });
}

function refreshSession() {
  // Une seule requête simultanée, même si l'onglet reprend le focus au retour OAuth.
  if (sessionRefreshPromise) return sessionRefreshPromise;
  identityChecking=true;
  updateDriveStatus();
  sessionRefreshPromise=(async()=>{
    try {
      sessionState=parseIdentitySession(await identityApi.getSession());
      identityError=null;
    } catch(error) {
      // Une indisponibilité de l’API ne prouve pas que Google a déconnecté l'utilisateur.
      identityError=error.message;
      console.error('[Marge] Échec de vérification de session Nicolabz Identity :', error);
    } finally {
      identityChecking=false;
      sessionRefreshPromise=null;
      updateDriveStatus();
    }
    return sessionState;
  })();
  return sessionRefreshPromise;
}

/** Le paramètre de callback OAuth n'est pas une preuve d'authentification. */
function consumeAuthResult() {
  const url=new URL(location.href);
  const result=url.searchParams.get('auth');
  if (result===null) return null;
  url.searchParams.delete('auth');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  return result;
}

function returnUrl() {
  // Le serveur vérifie l'origine et le chemin de retour autorisés.
  const url=new URL(location.href);
  url.searchParams.delete('auth');
  return url.href;
}
function startLogin() {location.assign(identityApi.loginUrl(returnUrl()));}
function startDriveConsent() {
  if (!sessionState.authenticated) {startLogin();return;}
  location.assign(identityApi.driveConsentUrl(returnUrl()));
}
async function logout() {
  try {
    await identityApi.logout();
    sessionState={authenticated:false,user:null,driveConnected:false};
    identityError=null;
    locallyModified=false;
    updateDriveStatus();
    showToast('Compte déconnecté. Le budget local est conservé.');
  } catch(error) {showToast(`Déconnexion : ${error.message}`,true);}
}
async function disconnectDrive() {
  if (!confirm('Dissocier l’autorisation Drive ? Les fichiers Drive ne seront pas supprimés.')) return;
  try {
    await identityApi.disconnectDrive();
    await refreshSession();
    showToast('Accès Drive dissocié. Le budget local est conservé.');
  } catch(error) {showToast(`Drive : ${error.message}`,true);}
}

function requestSyncChoice({type,message}) {
  return new Promise(resolve=>{
    syncChoiceDialog.label=type==='empty'?'Créer une sauvegarde Drive':'Conflit de sauvegardes';
    syncChoiceDialog.querySelector('#syncChoiceText').textContent=message;
    syncChoiceDialog.querySelector('[data-sync-choice="remote"]').hidden=type==='empty';
    syncChoiceDialog.querySelector('[data-sync-choice="local"]').textContent=type==='empty'?'Créer sur Google Drive':'Conserver la version locale (écraser Drive)';
    const controller=new AbortController();
    let finished=false;
    const finish=choice=>{
      if(finished)return;
      finished=true;
      controller.abort();
      syncChoiceDialog.open=false;
      resolve(choice);
    };
    syncChoiceDialog.querySelectorAll('[data-sync-choice]').forEach(button=>{
      button.addEventListener('click',()=>finish(button.dataset.syncChoice),{signal:controller.signal});
    });
    syncChoiceDialog.addEventListener('wa-hide',()=>finish('cancel'),{signal:controller.signal});
    syncChoiceDialog.open=true;
  });
}
async function driveAction(mode) {
  if (driveBusy) return;
  if (!sessionState.authenticated) {startLogin();return;}
  if (!sessionState.driveConnected) {startDriveConsent();return;}
  driveBusy=true;
  try {
    const result=await synchronizeIdentity({
      api:identityApi,
      userId:sessionState.user.id,
      mode,
      storage:localStorage,
      getData:()=>state,
      setData:incoming=>{saveData(incoming);state=incoming;render();},
      choose:requestSyncChoice,
    });
    const messages={
      created:'Première sauvegarde créée dans Google Drive.',
      uploaded:'Budget enregistré dans Google Drive.',
      downloaded:'Budget Google Drive restauré localement.',
      identical:'Votre budget local et Drive sont identiques.',
      cancel:'Synchronisation annulée : aucune donnée remplacée.',
    };
    if (result !== 'cancel') locallyModified=false;
    showToast(messages[result]||'Synchronisation terminée.');
    updateDriveStatus();
  } catch(error) {
    if(error.code==='SYNC_CONFLICT')showToast('Conflit : Drive a changé pendant l’enregistrement. Relancez la synchronisation pour choisir la version.',true);
    else if(error.code==='DRIVE_RECONNECT_REQUIRED'||error.code==='DRIVE_NOT_CONNECTED') {
      await refreshSession();
      showToast('Drive doit être réautorisé depuis le menu du compte.',true);
    } else showToast(`Google Drive : ${error.message}`,true);
  } finally {driveBusy=false;}
}

function act(action,target) {
  const key=target.dataset.id;
  const lookup=(items)=>items.find(item=>item.id===key);
  switch(action) {
    case 'drive-sync':void driveAction('auto');break;
    case 'auth-refresh':void refreshSession();break;
    case 'drive-pull':void driveAction('pull');break;
    case 'drive-push':void driveAction('push');break;
    case 'auth-login':startLogin();break;
    case 'auth-drive':startDriveConsent();break;
    case 'auth-logout':void logout();break;
    case 'auth-drive-disconnect':void disconnectDrive();break;
    case 'import':importInput.click();break;
    case 'export':try{exportData(state);showToast('Sauvegarde JSON téléchargée.');}catch(e){showToast(e.message,true);}break;
    case 'view-transactions':setView('transactions');break;
    case 'view-projects':setView('projects');break;
    case 'view-accounts':setView('accounts');break;
    case 'add-project':projectForm(null);break;
    case 'edit-project':projectForm(lookup(state.projects));break;
    case 'delete-project':askDelete(state.projects,key);break;
    case 'add-account':accountForm(null);break;
    case 'edit-account':accountForm(lookup(state.accounts));break;
    case 'delete-account':askDelete(state.accounts,key);break;
    case 'edit-balance':balanceForm(lookup(state.accounts));break;
    case 'edit-account-spending':spendingForm(lookup(state.accounts));break;
    case 'add-line':lineForm(null);break;
    case 'edit-line':lineForm(lookup(state.years[year].lines));break;
    case 'delete-line':askDelete(state.years[year].lines,key);break;
    case 'add-transaction':transactionForm(null);break;
    case 'edit-transaction':transactionForm(lookup(state.transactions));break;
    case 'delete-transaction':askDelete(state.transactions,key);break;
    case 'budget-month':annualGrid=false;render();break;
    case 'budget-year':annualGrid=true;render();break;
    case 'prev-month':month--;if(month<0){month=11;year=year==='2027'?'2026':'2027';}render();break;
    case 'next-month':month++;if(month>11){month=0;year=year==='2026'?'2027':'2026';}render();break;
    case 'reset':if(confirm('Réinitialiser toutes les données locales avec la démonstration ? Exportez-les d’abord si vous souhaitez les conserver.')){state=createDemoData();year='2026';month=9;commit('Démonstration réinitialisée.');}break;
  }
}
function init() {
  try{state=loadData();}catch(error){state=createDemoData();showToast(`Données locales illisibles : ${error.message} — démo chargée sans effacer la sauvegarde.`,true);}
  const view=location.hash.slice(1);if(allowedViews.has(view))currentView=view;
  render();
  // La page fonctionne hors ligne : la vérification SSO est non bloquante.
  const authResult=consumeAuthResult();
  void refreshSession().then(session=>{
    if (authResult === 'connected' && !session.authenticated && !identityError) {
      showToast('Retour Google reçu, mais aucune session active détectée. Réessaie de vérifier la connexion.',true);
    }
  });
  // Après un retour OAuth ou un changement d'onglet, on relit l'état du serveur.
  window.addEventListener('pageshow',event=>{if(event.persisted)void refreshSession();});
  window.addEventListener('focus',()=>{void refreshSession();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshSession();});
  document.querySelector('#profileMenu')?.addEventListener('wa-show',()=>{void refreshSession();});
  document.querySelector('#profileMenu')?.addEventListener('wa-select',event=>{
    const action=event.detail?.item?.value;
    if (typeof action==='string') act(action,event.detail.item);
  });
  document.addEventListener('click',event=>{
    const viewButton=event.target.closest('[data-view]');if(viewButton){setView(viewButton.dataset.view);return;}
    const actionButton=event.target.closest('[data-action]');if(actionButton){act(actionButton.dataset.action,actionButton);}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='monthSelect'){month=Number(el.value);render();return;}
    if(el.id==='yearSelect'){year=el.value;render();return;}
    if(el.dataset.field==='setting') {
      const number=Number(el.value);if(el.value.trim()===''||!Number.isFinite(number)){showToast('Valeur numérique invalide.',true);render();return;}
      state.settings[el.dataset.key]=number;commit('Paramètres actualisés.');return;
    }
    if(el.dataset.field==='budget-amount') {
      const line=state.years[year].lines.find(l=>l.id===el.dataset.id);
      const value=el.value.trim()===''?null:Number(el.value);
      if(!line||value!==null&&!Number.isFinite(value)){showToast('Montant invalide.',true);render();return;}
      line.amounts[Number(el.dataset.month)]=value;commit('Budget recalculé.');
    }
  });
  importInput.addEventListener('change',async()=>{
    const file=importInput.files?.[0];if(!file)return;
    try{const incoming=await readImport(file);if(!confirm(`Importer « ${file.name} » et remplacer vos données actuelles ? Exportez d’abord si nécessaire.`))return;
      saveData(incoming);state=incoming;locallyModified=true;year='2026';month=9;render();showToast('Import réussi. Votre budget est disponible.');
    }catch(error){showToast(`Import refusé : ${error.message}`,true);}finally{importInput.value='';}
  });
  window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(allowedViews.has(view)){currentView=view;render();}});
}
init();
