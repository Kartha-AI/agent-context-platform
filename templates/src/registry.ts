import { ContextTemplate, TemplateValidator } from '@acp/core';
import { customerTemplate } from './crm/customer.js';
import { contactTemplate } from './crm/contact.js';
import { opportunityTemplate } from './crm/opportunity.js';
import { caseTemplate } from './crm/case.js';

const ALL_TEMPLATES: ContextTemplate[] = [
  customerTemplate,
  contactTemplate,
  opportunityTemplate,
  caseTemplate,
];

let validatorInstance: TemplateValidator | null = null;

export function getTemplateValidator(): TemplateValidator {
  if (!validatorInstance) {
    validatorInstance = new TemplateValidator();
    for (const template of ALL_TEMPLATES) {
      validatorInstance.registerTemplate(template);
    }
  }
  return validatorInstance;
}

export { ALL_TEMPLATES };
