export const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export const GROUPS = [
  { id: 'income', label: 'Revenus', icon: 'arrow-down-left' },
  { id: 'savings', label: 'Épargne, projets et crédits', icon: 'piggy' },
  { id: 'fixed', label: 'Charges fixes', icon: 'house' },
  { id: 'variable', label: 'Dépenses variables', icon: 'wallet' },
];
export const PROJECT_TYPES = [
  {value:'savings',label:'Épargne'},
  {value:'financing',label:'Demande de financement'},
];
export const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const euro = n => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
export const shortEuro = n => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
export const percent = n => new Intl.NumberFormat('fr-FR',{style:'percent',maximumFractionDigits:0}).format(n||0);
export const id = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
export function lineAmount(line, month, settings) {
  const param = line.links?.[String(month)];
  return Number(param ? settings[param] : line.amounts[month]) || 0;
}
export function monthlyBudget(data, year, month) {
  const totals = Object.fromEntries(GROUPS.map(group => [group.id,0]));
  for (const line of data.years[year].lines) totals[line.group] += lineAmount(line,month,data.settings);
  for (const key of Object.keys(totals)) totals[key] = round(totals[key]);
  return {
    ...totals,
    expenses: round(totals.fixed + totals.variable),
    allocated: round(totals.savings + totals.fixed + totals.variable),
    cashflow: round(totals.income - totals.savings - totals.fixed - totals.variable),
    threshold: data.years[year].minMargins?.[month] ?? (Number(data.settings.minMargin)||0),
  };
}
export function annualBudget(data,year) {
  const months = MONTHS.map((_,i)=>monthlyBudget(data,year,i));
  const sum = key => round(months.reduce((n,m)=>n+m[key],0));
  const wealthSavings = round(data.years[year].lines.filter(l=>l.group==='savings'&&l.type==='Épargne').reduce((total,line)=>total+MONTHS.reduce((n,_,i)=>n+lineAmount(line,i,data.settings),0),0));
  return { months, income:sum('income'), savings:sum('savings'),expenses:sum('expenses'),fixed:sum('fixed'),variable:sum('variable'),cashflow:sum('cashflow'),wealthSavings, savingsRate:sum('income')>0?wealthSavings/sum('income'):0, belowThreshold:months.filter(m=>m.cashflow<m.threshold).length };
}
export function spendingBreakdown(data,year,month) {
  const lines=data.years[year].lines.filter(l=>l.group==='fixed'||l.group==='variable')
    .map(l=>({label:l.label, value:lineAmount(l,month,data.settings)})).filter(l=>l.value>0).sort((a,b)=>b.value-a.value);
  const major=lines.slice(0,5);
  const remainder=round(lines.slice(5).reduce((total,item)=>total+item.value,0));
  if (remainder>0) major.push({label:'Autres',value:remainder});
  return major;
}
export function projectProgress(project) {return project.target>0?Math.min(1,Math.max(0,project.saved/project.target)):0;}
export function dailyActivity(transactions,year,month) {
  const result=Array.from({length:new Date(Number(year),month+1,0).getDate()},()=>0);
  transactions.forEach(t=>{const d=new Date(`${t.date}T12:00:00`);if(d.getFullYear()===Number(year)&&d.getMonth()===month)result[d.getDate()-1]++;});
  return result;
}
export function transactionsInMonth(data,year,month) {return data.transactions.filter(t=>t.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).sort((a,b)=>b.date.localeCompare(a.date));}
export function accountBalance(account,year,month) {return account.balances?.[year]?.[month]??null;}
export function blankYearBalances() {return Array(12).fill(null);}
export function createDemoData() {
  const createLines=year=>[
    ['income','Revenu','Salaire',3200],['income','Revenu','Prime',0],
    ['savings','Épargne','Livret A',350],['savings','Épargne','PEL',200],['savings','Épargne','PEA',150],['savings','Projet','Financement moto',150],
    ['fixed','Fixe','Loyer',700],['fixed','Fixe','Électricité',90],['fixed','Fixe','Internet et téléphone',55],['fixed','Fixe','Assurances',80],['fixed','Fixe','Abonnements',45],
    ['variable','Variable','Alimentation',310],['variable','Variable','Transport',170],['variable','Variable','Loisirs',180],['variable','Variable','Santé',35],['variable','Variable','Divers',80],
  ].map(([group,type,label,amount],index)=>({id:`${year}-${index}`,group,type,label,amounts:MONTHS.map((_,month)=>year==='2027'&&label==='Salaire'?3350:month===7&&label==='Électricité'?65:amount),links:{}}));
  const year='2026';
  const transactionSeeds=[
    ['2026-10-28','Salaire','Revenus',3200,null],['2026-10-27','Courses du mois','Alimentation',-62.80,'demo-a1'],
    ['2026-10-23','Transport','Transport',-34.50,null],['2026-10-20','Abonnement musique','Abonnements',-10.99,null],
    ['2026-10-16','Restaurant','Loisirs',-39.90,'demo-a1'],['2026-10-12','Remboursement ami','Autres',45,null],
    ['2026-10-07','Électricité','Logement',-90,null],['2026-10-03','Loyer','Logement',-700,null],
    ['2026-09-25','Achats divers','Divers',-43.90,null],['2026-09-06','Essence','Transport',-55,null],
  ];
  return {
    version:3, importedFromExcel:false,
    settings:{},
    years:{'2026':{lines:createLines('2026'),minMargins:Array(12).fill(300)},'2027':{lines:createLines('2027'),minMargins:Array(12).fill(300)}},
    accounts:[
      {id:'demo-a1',name:'N26',type:'Compte courant',balances:{'2026':MONTHS.map((_,i)=>round(480+i*23)),'2027':blankYearBalances()}},
      {id:'demo-a2',name:'Livret A',type:'Épargne',balances:{'2026':MONTHS.map((_,i)=>round(2100+i*180)),'2027':blankYearBalances()}},
      {id:'demo-a3',name:'Compte commun',type:'Compte partagé',balances:{'2026':MONTHS.map((_,i)=>round(620-i*8)),'2027':blankYearBalances()}},
    ],
    projects:[
      {id:'demo-p1',type:'savings',name:'Moto CB125R',description:'Mon prochain deux-roues',target:4600,saved:1850},
      {id:'demo-p2',type:'savings',name:'Épargne sécurité',description:'Constituer un fonds de secours',target:5000,saved:2350},
      {id:'demo-p3',type:'savings',name:'PC / Setup',description:'Améliorer mon espace de travail',target:2000,saved:650},
    ],
    transactions:transactionSeeds.map(([date,label,category,amount,accountId],i)=>({id:`demo-t${i}`,date,label,category,amount,accountId})),
  };
}
// Un fichier Excel ne comporte pas nécessairement le solde des comptes ou l'épargne déjà accumulée.
// Lors de la migration, ces champs restent vides au lieu d'inventer des soldes.
export function migrateLegacyData(legacy) {
  const reference = legacy.gear||{};
  const total=round((Number(reference.motorcyclePrice)||0)+(reference.items||[]).reduce((sum,item)=>sum+(item.selected?(Number(item.price)||0)*(Number(item.quantity)||0):0),0));
  return {
    version:2,importedFromExcel:true,settings:structuredClone(legacy.settings),years:structuredClone(legacy.years),
    accounts:[{id:'legacy-n26',name:'N26',type:'Compte annexe',balances:{'2026':blankYearBalances(),'2027':blankYearBalances()},
      legacyExpenses:structuredClone(legacy.n26||{})}],
    projects:total>0?[{id:'legacy-moto',name:'Moto CB125R',description:'Budget du projet issu de votre classeur Excel',target:total,saved:0}]:[],
    transactions:[],
  };
}

export function adjacentMonth(year, month, direction) {
  const index=Number(year)*12+month+direction;
  const nextYear=Math.floor(index/12);
  if(!Number.isInteger(index)||nextYear<1000||nextYear>9999)throw new Error('Année hors limites.');
  return {year:String(nextYear),month:index%12};
}
export function ensureBudgetYear(data, year, sourceYear, sourceMonth) {
  if(Object.hasOwn(data.years,year))return false;
  if(!/^[1-9]\d{3}$/.test(year))throw new Error('Année invalide.');
  const source=data.years[sourceYear];
  if(!source)throw new Error('Année de référence absente.');
  data.years[year]={
    lines:source.lines.map(line=>({...structuredClone(line),id:id(),amounts:Array(12).fill(null),links:{}})),
    minMargins:Array(12).fill(source.minMargins[sourceMonth]),
  };
  for(const account of data.accounts)account.balances[year]??=blankYearBalances();
  return true;
}

export function carryPreviousMonth(data, year, month) {
  const target=data.years[year];
  if(target.carriedMonths?.includes(month)||target.lines.some(line=>line.amounts[month]!==null))return false;
  const previous=adjacentMonth(year,month,-1),source=data.years[previous.year];
  if(!source||!source.lines.some(line=>line.amounts[previous.month]!==null))return false;
  if(previous.year===year){
    for(const line of target.lines)line.amounts[month]=line.amounts[previous.month];
  }else{
    // Match repeated labels in order without merging distinct budget lines.
    const available=[...source.lines];
    for(const line of target.lines){
      const index=available.findIndex(item=>item.label===line.label&&item.group===line.group&&item.type===line.type);
      if(index>=0)line.amounts[month]=available.splice(index,1)[0].amounts[previous.month];
    }
    for(const line of available){
      const copy={...structuredClone(line),id:id(),amounts:Array(12).fill(null),links:{}};
      copy.amounts[month]=line.amounts[previous.month];target.lines.push(copy);
    }
  }
  (target.carriedMonths??=[]).push(month);
  return true;
}
