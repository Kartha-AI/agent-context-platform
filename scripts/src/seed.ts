import { getPool, closePool, logger, ContextObjectRepo, TransactionRepo, ChangeLogRepo } from '@acp/core';

async function seed(): Promise<void> {
  const pool = getPool();
  const objectRepo = new ContextObjectRepo(pool);
  const txnRepo = new TransactionRepo(pool);
  const changeLogRepo = new ChangeLogRepo(pool);

  logger.info('Seeding sample data...');

  const acme = await objectRepo.upsert(
    {
      objectType: 'entity',
      subtype: 'customer',
      canonicalName: 'Acme Corp',
      context: {
        attributes: {
          name: 'Acme Corp',
          industry: 'Manufacturing',
          segment: 'enterprise',
          status: 'active',
          website: 'https://acme.example.com',
          employeeCount: 5200,
          flags: ['strategic', 'expansion-target'],
        },
        measures: {
          arr: 480000,
          mrr: 40000,
          nps: 42,
          healthScore: 73,
          openCases: 3,
          lifetimeValue: 1440000,
        },
        actors: {
          owner: 'Sarah Chen',
          csm: 'Marcus Johnson',
          ae: 'Diana Ross',
          champion: 'Tom Rodriguez',
          primaryContact: {
            name: 'Tom Rodriguez',
            email: 'tom@acme.example.com',
            role: 'VP Engineering',
          },
        },
        temporals: {
          contractStart: '2024-01-15',
          contractEnd: '2025-01-14',
          renewalDate: '2025-01-14',
          lastContactDate: '2025-02-28',
          onboardedDate: '2024-02-01',
        },
        locations: {
          hqCountry: 'US',
          hqState: 'CA',
          hqCity: 'San Francisco',
          region: 'West',
          territory: 'US-West-Enterprise',
        },
        intents: {
          churnRisk: 'medium',
          expansionLikelihood: 'high',
          useCases: ['supply-chain-optimization', 'inventory-management'],
          painPoints: ['slow-onboarding', 'missing-integrations'],
        },
        processes: {
          adoptionStage: 'expanding',
          renewalStage: 'not_started',
          supportTier: 'premium',
        },
      },
      sourceRefs: [{ system: 'salesforce', id: 'ACC-001', object: 'Account' }],
      confidence: 0.95,
    },
    {
      attributes: { name: 'Acme Corp', industry: 'Manufacturing', segment: 'enterprise', status: 'active', website: 'https://acme.example.com', employeeCount: 5200, flags: ['strategic', 'expansion-target'] },
      measures: { arr: 480000, mrr: 40000, nps: 42, healthScore: 73, openCases: 3, lifetimeValue: 1440000 },
      actors: { owner: 'Sarah Chen', csm: 'Marcus Johnson', ae: 'Diana Ross', champion: 'Tom Rodriguez', primaryContact: { name: 'Tom Rodriguez', email: 'tom@acme.example.com', role: 'VP Engineering' } },
      temporals: { contractStart: '2024-01-15', contractEnd: '2025-01-14', renewalDate: '2025-01-14', lastContactDate: '2025-02-28', onboardedDate: '2024-02-01' },
      locations: { hqCountry: 'US', hqState: 'CA', hqCity: 'San Francisco', region: 'West', territory: 'US-West-Enterprise' },
      intents: { churnRisk: 'medium', expansionLikelihood: 'high', useCases: ['supply-chain-optimization', 'inventory-management'], painPoints: ['slow-onboarding', 'missing-integrations'] },
      processes: { adoptionStage: 'expanding', renewalStage: 'not_started', supportTier: 'premium' },
    },
  );
  logger.info({ objectId: acme.objectId }, 'Seeded Acme Corp');

  await changeLogRepo.insert({
    objectId: acme.objectId,
    objectType: 'entity',
    subtype: 'customer',
    changeType: 'created',
    contextSnapshot: { measures: { arr: 480000, healthScore: 73 } },
  });

  const globex = await objectRepo.upsert(
    {
      objectType: 'entity',
      subtype: 'customer',
      canonicalName: 'Globex Industries',
      context: {
        attributes: {
          name: 'Globex Industries',
          industry: 'Technology',
          segment: 'mid-market',
          status: 'active',
          employeeCount: 850,
        },
        measures: {
          arr: 120000,
          mrr: 10000,
          nps: 67,
          healthScore: 88,
          openCases: 1,
        },
        actors: {
          owner: 'Marcus Johnson',
          csm: 'Sarah Chen',
          primaryContact: {
            name: 'Lisa Park',
            email: 'lisa@globex.example.com',
            role: 'CTO',
          },
        },
        temporals: {
          contractStart: '2024-06-01',
          contractEnd: '2025-05-31',
          renewalDate: '2025-05-31',
          lastContactDate: '2025-03-01',
        },
        locations: {
          hqCountry: 'US',
          hqState: 'NY',
          hqCity: 'New York',
          region: 'East',
        },
        intents: {
          churnRisk: 'low',
          expansionLikelihood: 'medium',
        },
        processes: {
          adoptionStage: 'mature',
          renewalStage: 'not_started',
          supportTier: 'standard',
        },
      },
      sourceRefs: [{ system: 'salesforce', id: 'ACC-002', object: 'Account' }],
    },
    {
      attributes: { name: 'Globex Industries', industry: 'Technology', segment: 'mid-market', status: 'active', employeeCount: 850 },
      measures: { arr: 120000, mrr: 10000, nps: 67, healthScore: 88, openCases: 1 },
      actors: { owner: 'Marcus Johnson', csm: 'Sarah Chen', primaryContact: { name: 'Lisa Park', email: 'lisa@globex.example.com', role: 'CTO' } },
      temporals: { contractStart: '2024-06-01', contractEnd: '2025-05-31', renewalDate: '2025-05-31', lastContactDate: '2025-03-01' },
      locations: { hqCountry: 'US', hqState: 'NY', hqCity: 'New York', region: 'East' },
      intents: { churnRisk: 'low', expansionLikelihood: 'medium' },
      processes: { adoptionStage: 'mature', renewalStage: 'not_started', supportTier: 'standard' },
    },
  );
  logger.info({ objectId: globex.objectId }, 'Seeded Globex Industries');

  await changeLogRepo.insert({
    objectId: globex.objectId,
    objectType: 'entity',
    subtype: 'customer',
    changeType: 'created',
    contextSnapshot: { measures: { arr: 120000, healthScore: 88 } },
  });

  await txnRepo.insert(acme.objectId, {
    transactionType: 'case_opened',
    context: {
      subject: 'API integration timeout issues',
      priority: 'high',
      category: 'technical',
    },
    actors: { reporter: 'Tom Rodriguez', assignee: 'Support Team' },
  });

  await txnRepo.insert(acme.objectId, {
    transactionType: 'qbr_completed',
    context: {
      summary: 'Quarterly review completed. Customer satisfied but wants faster integrations.',
      outcome: 'positive',
      nextQbrDate: '2025-06-15',
    },
    actors: { csm: 'Marcus Johnson', attendees: ['Tom Rodriguez', 'Sarah Chen'] },
  });

  await txnRepo.insert(acme.objectId, {
    transactionType: 'risk_assessed',
    context: {
      riskLevel: 'medium',
      factors: ['contract-renewal-approaching', 'open-support-issues'],
      recommendation: 'Schedule executive check-in before renewal',
    },
    actors: { assessedBy: 'cs-risk-agent' },
  });

  await txnRepo.insert(globex.objectId, {
    transactionType: 'nps_received',
    context: { score: 9, feedback: 'Great product, easy to use' },
    actors: { respondent: 'Lisa Park' },
    measures: { score: 9 },
  });

  logger.info('Seed data complete');
  await closePool();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
