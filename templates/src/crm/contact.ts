import { ContextTemplate } from '@acp/core';

export const contactTemplate: ContextTemplate = {
  templateId: 'crm-contact',
  objectType: 'entity',
  subtype: 'contact',
  version: '1.0.0',
  description: 'Individual person with role and company association',
  schema: {
    attributes: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        title: { type: 'string' },
        department: { type: 'string' },
        role: { type: 'string', enum: ['champion', 'decision_maker', 'influencer', 'end_user', 'blocker'] },
        status: { type: 'string', enum: ['active', 'inactive', 'churned'] },
        companyId: { type: 'string' },
        companyName: { type: 'string' },
      },
      required: ['email'],
    },
    measures: {
      type: 'object',
      properties: {
        engagementScore: { type: 'number', minimum: 0, maximum: 100 },
        lastLoginDaysAgo: { type: 'number' },
        meetingsLast30Days: { type: 'number' },
        emailsLast30Days: { type: 'number' },
        featureUsageScore: { type: 'number' },
      },
    },
    actors: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        reportsTo: { type: 'string' },
      },
    },
    temporals: {
      type: 'object',
      properties: {
        lastContactDate: { type: 'string', format: 'date' },
        lastMeetingDate: { type: 'string', format: 'date' },
        createdDate: { type: 'string', format: 'date' },
      },
    },
    locations: {
      type: 'object',
      properties: {
        timezone: { type: 'string' },
        city: { type: 'string' },
        country: { type: 'string' },
      },
    },
    intents: {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        priorities: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  transactionTypes: [
    'meeting_held',
    'email_sent',
    'email_received',
    'call_completed',
    'sentiment_assessed',
    'role_changed',
  ],
};
