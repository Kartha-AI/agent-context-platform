export interface AcpConfig {
  environment: 'dev' | 'staging' | 'prod';
  vpcCidr: string;
  dbInstanceClass: string;
  apiKeySecretName: string;
  rdsSecretName: string;
}

export function getConfig(): AcpConfig {
  const env = (process.env.ACP_ENV ?? 'dev') as AcpConfig['environment'];
  return {
    environment: env,
    vpcCidr: '10.0.0.0/16',
    dbInstanceClass: env === 'prod' ? 'db.r6g.large' : 'db.t4g.medium',
    apiKeySecretName: 'acp/api-keys',
    rdsSecretName: 'acp/rds-credentials',
  };
}
