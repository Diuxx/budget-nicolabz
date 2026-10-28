export const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export const GROUPS = [
  { id: 'income', label: 'Revenus', icon: 'arrow-down-left' },
  { id: 'savings', label: 'Épargne, projets et crédits', icon: 'piggy' },
  { id: 'fixed', label: 'Charges fixes', icon: 'house' },
  { id: 'variable', label: 'Dépenses variables', icon: 'wallet' },
];
export const SETTINGS = [
  { key:'salaryTarget', label:'Salaire cible', hint:'Projection de septembre à décembre 2026', unit:'€' },
  { key:'pelMinimum', label:'Versement PEL', hint:'Projection de septembre 2026', unit:'€' },
  { key:'livretTarget', label:'Objectif Livret A', hint:'Repère sans déduction supplémentaire', unit:'€' },
  { key:'peaTarget', label:'Objectif PEA', hint:'Repère sans déduction supplémentaire', unit:'€' },
  { key:'loanPayment', label:'Mensualité de crédit', hint:'Projection d’octobre à décembre 2026', unit:'€' },
  { key:'minMargin', label:'Marge minimale souhaitée', hint:'Seuil d’alerte du reste disponible', unit:'€' },
  { key:'loanAmount', label:'Montant initial du prêt', hint:'Information', unit:'€' },
  { key:'loanMonths', label:'Durée du prêt', hint:'Information', unit:'mois' },
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
    threshold: Number(data.settings.minMargin)||0,
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
    version:2, importedFromExcel:false,
    settings:{salaryTarget:3200,pelMinimum:200,livretTarget:350,peaTarget:150,loanPayment:205,minMargin:300,loanAmount:4600,loanMonths:24},
    years:{'2026':{lines:createLines('2026')},'2027':{lines:createLines('2027')}},
    accounts:[
      {id:'demo-a1',name:'N26',type:'Compte courant',balances:{'2026':MONTHS.map((_,i)=>round(480+i*23)),'2027':blankYearBalances()}},
      {id:'demo-a2',name:'Livret A',type:'Épargne',balances:{'2026':MONTHS.map((_,i)=>round(2100+i*180)),'2027':blankYearBalances()}},
      {id:'demo-a3',name:'Compte commun',type:'Compte partagé',balances:{'2026':MONTHS.map((_,i)=>round(620-i*8)),'2027':blankYearBalances()}},
    ],
    projects:[
      {id:'demo-p1',name:'Moto CB125R',description:'Mon prochain deux-roues',target:4600,saved:1850},
      {id:'demo-p2',name:'Épargne sécurité',description:'Constituer un fonds de secours',target:5000,saved:2350},
      {id:'demo-p3',name:'PC / Setup',description:'Améliorer mon espace de travail',target:2000,saved:650},
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
