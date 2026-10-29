/** Schéma public d'échange de Marge v4 (JSON Schema Draft 2020-12).
 * Les règles relationnelles (liens, dates exactes et unicité des IDs) restent
 * vérifiées par validateData : JSON Schema ne couvre pas ces invariants.
 */
const nonNegative = { type: 'number', minimum: 0 };
const nullableAmount = { type: ['number', 'null'], minimum: 0 };
const nullableDate = { type: ['string', 'null'], pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$' };
const nullableId = { type: ['string', 'null'], minLength: 1, maxLength: 120 };
const named = {
  type: 'object', required: ['id', 'name'],
  properties: { id: { type: 'string', minLength: 1, maxLength: 120 }, name: { type: 'string', minLength: 1, maxLength: 160 } },
};
const line = {
  type: 'object', required: ['id', 'name', 'accountId', 'plannedAmount', 'realAmount', 'plannedDate', 'realDate'],
  properties: {
    ...named.properties,
    accountId: { type: 'string', minLength: 1, maxLength: 120 },
    plannedAmount: nonNegative, realAmount: nullableAmount,
    plannedDate: nullableDate, realDate: nullableDate,
  },
};
export const BUDGET_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://nicolabz.dev/schemas/marge-budget-v4.schema.json',
  title: 'Marge — Sauvegarde de budget v4',
  description: 'Patron public des imports/exports JSON de Marge. Les champs d’archives facultatifs sont acceptés.',
  type: 'object',
  required: ['version', 'periods', 'accounts', 'incomeTypes', 'expenseCategories', 'projects', 'legacyTransactions'],
  properties: {
    version: { const: 4 },
    periods: { type: 'array', maxItems: 12000, items: { $ref: '#/$defs/period' } },
    accounts: { type: 'array', maxItems: 1000, items: { $ref: '#/$defs/account' } },
    incomeTypes: { type: 'array', maxItems: 1000, items: { $ref: '#/$defs/incomeType' } },
    expenseCategories: { type: 'array', maxItems: 1000, items: { $ref: '#/$defs/category' } },
    projects: { type: 'array', maxItems: 1000, items: { $ref: '#/$defs/project' } },
    legacyTransactions: { type: 'array' },
  },
  $defs: {
    account: { ...named, required: ['id', 'name', 'type'], properties: { ...named.properties, type: { type: 'string', minLength: 1, maxLength: 160 } } },
    incomeType: { ...named, required: ['id', 'name', 'saving'], properties: { ...named.properties, saving: { type: 'boolean' } } },
    category: named,
    income: { ...line, required: [...line.required, 'typeId', 'deductedFromIncomeId'], properties: {
      ...line.properties, note: { type: 'string', maxLength: 1000 }, typeId: { type: 'string', minLength: 1, maxLength: 120 }, deductedFromIncomeId: nullableId,
    } },
    expense: { ...line, required: [...line.required, 'type', 'categoryId', 'incomeId', 'note'], properties: {
      ...line.properties,
      type: { enum: ['fixed', 'variable', 'savings'] },
      categoryId: { type: 'string', minLength: 1, maxLength: 120 },
      incomeId: nullableId,
      note: { type: 'string', maxLength: 1000 },
    } },
    period: {
      type: 'object', required: ['date', 'incomes', 'expenses'],
      properties: {
        date: { type: 'string', pattern: '^[1-9]\\d{3}-(0[1-9]|1[0-2])$' },
        incomes: { type: 'array', maxItems: 1000, items: { $ref: '#/$defs/income' } },
        expenses: { type: 'array', maxItems: 1000, items: { $ref: '#/$defs/expense' } },
        minMargin: nonNegative, // ancien champ en lecture seule, non utilisé par Marge
      },
    },
    project: { ...named, required: ['id','name','description','type','target','saved'], properties: {
      ...named.properties,
      description: { type: 'string', maxLength: 500 },
      type: { enum: ['savings', 'financing'] },
      target: nonNegative, saved: nonNegative,
      loanAmount: nonNegative, loanPayment: nonNegative,
      loanMonths: { type: 'integer', minimum: 1 },
    } },
  },
};

/** Validateur léger du sous-ensemble de JSON Schema réellement utilisé ci-dessus.
 * Aucun téléchargement/compilateur n'est nécessaire dans le navigateur.
 */
export function validateAgainstBudgetSchema(value) {
  const validate = (schema, item, path) => {
    if (schema.$ref) {
      const key = schema.$ref.slice('#/$defs/'.length);
      return validate(BUDGET_SCHEMA.$defs[key], item, path);
    }
    if ('const' in schema && item !== schema.const) throw new Error(`${path} : valeur attendue ${schema.const}.`);
    if (schema.enum && !schema.enum.includes(item)) throw new Error(`${path} : valeur non autorisée.`);
    if (schema.type) {
      const candidates = Array.isArray(schema.type) ? schema.type : [schema.type];
      const valid = candidates.some(type => {
        if (type === 'null') return item === null;
        if (type === 'array') return Array.isArray(item);
        if (type === 'object') return item !== null && typeof item === 'object' && !Array.isArray(item);
        if (type === 'integer') return Number.isSafeInteger(item);
        if (type === 'number') return typeof item === 'number' && Number.isFinite(item);
        return typeof item === type;
      });
      if (!valid) throw new Error(`${path} : type invalide (attendu : ${candidates.join(' ou ')}).`);
    }
    if (item === null) return;
    if (typeof item === 'string') {
      if (schema.minLength !== undefined && item.trim().length < schema.minLength) throw new Error(`${path} : texte manquant.`);
      if (schema.maxLength !== undefined && item.length > schema.maxLength) throw new Error(`${path} : texte trop long.`);
      if (schema.pattern && !(new RegExp(schema.pattern)).test(item)) throw new Error(`${path} : format invalide.`);
    }
    if (typeof item === 'number' && schema.minimum !== undefined && item < schema.minimum) throw new Error(`${path} : montant ou durée inférieur au minimum.`);
    if (Array.isArray(item)) {
      if (schema.maxItems !== undefined && item.length > schema.maxItems) throw new Error(`${path} : trop d’éléments.`);
      if (schema.items) item.forEach((entry, i) => validate(schema.items, entry, `${path}[${i}]`));
    } else if (item && typeof item === 'object') {
      for (const key of schema.required ?? []) if (!Object.hasOwn(item, key)) throw new Error(`${path}.${key} : champ obligatoire manquant.`);
      for (const [key, prop] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(item, key)) validate(prop, item[key], `${path}.${key}`);
    }
  };
  validate(BUDGET_SCHEMA, value, 'budget');
  return value;
}
