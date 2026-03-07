import { ContextTemplate } from '@acp/core';

export const opportunityTemplate: ContextTemplate = {
  templateId: 'crm-opportunity',
  objectType: 'entity',
  subtype: 'opportunity',
  version: '1.0.0',
  description: 'Deal/pipeline item with stage, value, and timeline',
  schema: {
    attributes: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['new_business', 'expansion', 'renewal'] },
        stage: { type: 'string', enum: ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
        status: { type: 'string', enum: ['open', 'won', 'lost'] },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        product: { type: 'string' },
      },
      required: ['name'],
    },
    measures: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        probability: { type: 'number', minimum: 0, maximum: 100 },
        weightedAmount: { type: 'number' },
        arr: { type: 'number' },
        discount: { type: 'number', minimum: 0, maximum: 100 },
      },
    },
    actors: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        champion: { type: 'string' },
        economicBuyer: { type: 'string' },
        competitor: { type: 'string' },
      },
    },
    temporals: {
      type: 'object',
      properties: {
        createdDate: { type: 'string', format: 'date' },
        closeDate: { type: 'string', format: 'date' },
        lastActivityDate: { type: 'string', format: 'date' },
        nextStepDate: { type: 'string', format: 'date' },
      },
    },
    intents: {
      type: 'object',
      properties: {
        lossReason: { type: 'string' },
        nextSteps: { type: 'string' },
        competitiveNotes: { type: 'string' },
        risks: { type: 'array', items: { type: 'string' } },
      },
    },
    processes: {
      type: 'object',
      properties: {
        salesProcess: { type: 'string' },
        approvalStatus: { type: 'string', enum: ['not_needed', 'pending', 'approved', 'rejected'] },
        forecastCategory: { type: 'string', enum: ['pipeline', 'best_case', 'commit', 'closed'] },
      },
    },
  },
  transactionTypes: [
    'stage_changed',
    'amount_updated',
    'meeting_scheduled',
    'proposal_sent',
    'contract_sent',
    'deal_won',
    'deal_lost',
    'competitor_identified',
    'risk_flagged',
  ],
};
