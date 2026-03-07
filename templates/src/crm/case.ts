import { ContextTemplate } from '@acp/core';

export const caseTemplate: ContextTemplate = {
  templateId: 'crm-case',
  objectType: 'entity',
  subtype: 'case',
  version: '1.0.0',
  description: 'Support ticket with status, priority, and resolution',
  schema: {
    attributes: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['new', 'open', 'pending', 'escalated', 'resolved', 'closed'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        category: { type: 'string' },
        subcategory: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
      },
      required: ['subject'],
    },
    measures: {
      type: 'object',
      properties: {
        responseTimeMins: { type: 'number' },
        resolutionTimeMins: { type: 'number' },
        reopenCount: { type: 'number' },
        csat: { type: 'number', minimum: 1, maximum: 5 },
        touchCount: { type: 'number' },
      },
    },
    actors: {
      type: 'object',
      properties: {
        assignee: { type: 'string' },
        reporter: { type: 'string' },
        escalatedTo: { type: 'string' },
      },
    },
    temporals: {
      type: 'object',
      properties: {
        createdDate: { type: 'string', format: 'date' },
        firstResponseDate: { type: 'string', format: 'date' },
        resolvedDate: { type: 'string', format: 'date' },
        slaDeadline: { type: 'string', format: 'date' },
        lastUpdateDate: { type: 'string', format: 'date' },
      },
    },
    intents: {
      type: 'object',
      properties: {
        rootCause: { type: 'string' },
        resolution: { type: 'string' },
        churnRisk: { type: 'boolean' },
        productFeedback: { type: 'string' },
      },
    },
    processes: {
      type: 'object',
      properties: {
        workflow: { type: 'string' },
        escalationLevel: { type: 'number', minimum: 0, maximum: 3 },
        slaStatus: { type: 'string', enum: ['within', 'at_risk', 'breached'] },
      },
    },
  },
  transactionTypes: [
    'case_created',
    'status_changed',
    'assigned',
    'escalated',
    'comment_added',
    'resolved',
    'reopened',
    'csat_received',
    'sla_breached',
  ],
};
