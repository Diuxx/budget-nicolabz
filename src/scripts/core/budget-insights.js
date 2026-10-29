import { incomeAvailable } from './period-model.js';
import { round } from './model.js';

/**
 * La sélection reste séparée des identifiants métier : un compte et un revenu
 * peuvent porter le même id sans rendre le filtre ambigu.
 */
export function buildFundingFilters(data, period) {
  if (!period) return [{ value: 'all', label: 'Tous les comptes et revenus' }];
  const filters = [{ value: 'all', label: 'Tous les comptes et revenus' }];
  for (const account of data.accounts) {
    const incomes = period.incomes.filter(item => item.accountId === account.id);
    const hasExpenses = period.expenses.some(item => item.accountId === account.id);
    if (!incomes.length && !hasExpenses) continue;
    filters.push({ value: `account:${account.id}`, label: account.name, kind: 'account' });
    for (const income of incomes) {
      filters.push({ value: `income:${income.id}`, label: `↳ ${income.name}`, kind: 'income' });
    }
  }
  return filters;
}

export function filterBudgetEntries(period, kind, filter) {
  if (!period) return [];
  const entries = kind === 'income' ? period.incomes : period.expenses;
  if (filter === 'all') return entries;
  const [type, ...idParts] = filter.split(':');
  const id = idParts.join(':');
  if (type === 'account') return entries.filter(item => item.accountId === id);
  if (type === 'income') {
    if (kind === 'income') return entries.filter(item => item.id === id);
    return entries.filter(item => item.incomeId === id);
  }
  return [];
}

/**
 * Le suivi par type d'épargne correspond aux revenus marqués saving dans Todo.
 * Les dépenses d'épargne ne sont pas additionnées une seconde fois : elles sont
 * déjà comptabilisées dans le total global de la période.
 */
export function annualSavingsByType(data, year) {
  const savingTypes = data.incomeTypes.filter(type => type.saving);
  return savingTypes.map(type => {
    const incomeEntries = data.periods
      .filter(period => period.date.startsWith(`${year}-`))
      .flatMap(period => period.incomes.filter(item => item.typeId === type.id));
    return {
      id: type.id,
      name: type.name,
      planned: round(incomeEntries.reduce((sum, item) => sum + item.plannedAmount, 0)),
      real: round(incomeEntries.reduce((sum, item) => sum + (item.realAmount ?? 0), 0)),
      recorded: incomeEntries.filter(item => item.realAmount !== null).length,
      count: incomeEntries.length,
    };
  }).filter(type => type.count > 0).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Solde par source pour mettre en évidence un dépassement sans bloquer la saisie. */
export function fundingBalances(period, incomeId) {
  return {
    planned: round(incomeAvailable(period, incomeId, 'plannedAmount')),
    real: round(incomeAvailable(period, incomeId, 'realAmount')),
  };
}
