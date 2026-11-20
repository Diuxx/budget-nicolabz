import { writeFileSync } from 'node:fs';
import { BUDGET_SCHEMA } from '../src/scripts/core/budget-schema.js';
import { createEmptyBudget } from '../src/scripts/core/period-model.js';

for(const [name,value] of [['pecule-budget-v1.schema.json',BUDGET_SCHEMA],['pecule-modele-import-v1.json',createEmptyBudget()]]){
  writeFileSync(new URL(`../src/assets/schemas/${name}`,import.meta.url),JSON.stringify(value,null,2)+'\n');
}
