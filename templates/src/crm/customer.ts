import { ContextTemplate } from '@acp/core';

export const customerTemplate: ContextTemplate = {
  templateId: 'crm-customer',
  objectType: 'entity',
  subtype: 'customer',
  version: '1.0.0',
  description: 'CRM customer/account with sales, support, and financial context',
  schema: {
    attributes: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        industry: { type: 'string' },
        segment: { type: 'string', enum: ['enterprise', 'mid-market', 'smb'] },
        status: { type: 'string', enum: ['active', 'churned', 'prospect', 'trial'] },
        website: { type: 'string' },
        employeeCount: { type: 'number' },
        flags: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    },
    measures: {
      type: 'object',
      properties: {
        arr: { type: 'number', description: 'Annual recurring revenue' },
        mrr: { type: 'number', description: 'Monthly recurring revenue' },
        nps: { type: 'number', description: 'Net promoter score' },
        healthScore: { type: 'number', minimum: 0, maximum: 100 },
        openCases: { type: 'number' },
        lifetimeValue: { type: 'number' },
        expansionRevenue: { type: 'number' },
      },
    },
    actors: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        csm: { type: 'string', description: 'Customer success manager' },
        ae: { type: 'string', description: 'Account executive' },
        champion: { type: 'string' },
        economicBuyer: { type: 'string' },
        primaryContact: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
    temporals: {
      type: 'object',
      properties: {
        contractStart: { type: 'string', format: 'date' },
        contractEnd: { type: 'string', format: 'date' },
        renewalDate: { type: 'string', format: 'date' },
        lastContactDate: { type: 'string', format: 'date' },
        onboardedDate: { type: 'string', format: 'date' },
        lastQbrDate: { type: 'string', format: 'date' },
      },
    },
    locations: {
      type: 'object',
      properties: {
        hqCountry: { type: 'string' },
        hqState: { type: 'string' },
        hqCity: { type: 'string' },
        region: { type: 'string' },
        territory: { type: 'string' },
      },
    },
    intents: {
      type: 'object',
      properties: {
        churnRisk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        expansionLikelihood: { type: 'string', enum: ['low', 'medium', 'high'] },
        useCases: { type: 'array', items: { type: 'string' } },
        painPoints: { type: 'array', items: { type: 'string' } },
        strategicGoals: { type: 'array', items: { type: 'string' } },
      },
    },
    processes: {
      type: 'object',
      properties: {
        onboardingStage: { type: 'string' },
        adoptionStage: { type: 'string', enum: ['onboarding', 'adopting', 'expanding', 'mature'] },
        renewalStage: { type: 'string', enum: ['not_started', 'initiated', 'negotiating', 'closed'] },
        supportTier: { type: 'string', enum: ['basic', 'standard', 'premium', 'enterprise'] },
      },
    },
  },
  transactionTypes: [
    'case_opened',
    'case_closed',
    'qbr_completed',
    'risk_assessed',
    'renewal_initiated',
    'expansion_identified',
    'escalation_created',
    'nps_received',
    'contract_renewed',
    'contract_amended',
    'churn_warning',
    'health_score_updated',
  ],
};
