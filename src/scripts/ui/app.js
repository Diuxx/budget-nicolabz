import { currentPeriodKey } from '../core/period-model.js';
import { IdentityApi } from '../services/identity-api.js';
import { IDENTITY_BASE_URL, IDENTITY_APP_ID } from '../config/identity.js';
import { createBudgetPresentation } from './budget-presentation.js';
import { createBudgetViews } from './budget-views.js';
import { createManagementViews } from './management-views.js';
import { createApplicationController } from './application-controller.js';
import { createFormDialog } from './form-dialog.js';
import { createBudgetForms } from './budget-forms.js';
import { createManagementForms } from './management-forms.js';
import { createIdentityController } from './identity-controller.js';
import { createDataTools } from './data-tools.js';
import { bindApplicationEvents } from './application-events.js';

const model = {data:undefined,currentView:'budget',selectedPeriod:currentPeriodKey(),fundingFilter:'all',loadError:null};
const connection = {busy:false,locallyModified:false,sessionState:{authenticated:false,user:null,driveConnected:false}};
const dialog = document.querySelector('#modal');
const resetDialog = document.querySelector('#resetDialog');
const importInput = document.querySelector('#importInput');
const identityApi = new IdentityApi({baseUrl:IDENTITY_BASE_URL,appId:IDENTITY_APP_ID});

const presentation = createBudgetPresentation(model);
const budgetViews = createBudgetViews({model,presentation});
const managementViews = createManagementViews({model,presentation,accountSummary:budgetViews.accountSummary});
const views = {
  dashboard:budgetViews.renderDashboard, budget:budgetViews.renderBudget,
  analytics:budgetViews.renderAnalytics, transactions:budgetViews.renderTransactions,
  projects:managementViews.renderProjects, accounts:managementViews.renderAccounts,
  settings:managementViews.renderSettings,
};
// Le callback est exécuté après la composition, au premier rendu.
const controller = createApplicationController({model,connection,views,
  app:document.querySelector('#app'),toastElement:document.querySelector('#toast'),
  onRendered:()=>identity.updateDriveStatus(),
});
const {render,showToast,mutate} = controller;
const identity = createIdentityController({model,connection,identityApi,render,showToast,
  syncChoiceDialog:document.querySelector('#syncChoiceDialog'),
});
const formDialog = createFormDialog({dialog,mutate,showToast});
const budgetForms = createBudgetForms({model,presentation,dialog,openForm:formDialog.openForm});
const managementForms = createManagementForms({model,dialog,openForm:formDialog.openForm,mutate});
const dataTools = createDataTools({model,connection,identityApi,resetDialog,importInput,render,showToast});

controller.initialize();
identity.startSessionTracking();
bindApplicationEvents({model,presentation,controller,budgetForms,managementForms,
  formDialog,dataTools,identity,dialog,resetDialog,importInput,
});
