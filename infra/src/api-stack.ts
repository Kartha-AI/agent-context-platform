import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { AcpConfig } from './config.js';

export interface ApiStackProps extends cdk.StackProps {
  config: AcpConfig;
  vpc: ec2.Vpc;
  dbInstance: rds.DatabaseInstance;
  dbSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.ISecret;
  apiKeySecret: secretsmanager.Secret;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { config, vpc, dbInstance, dbSecurityGroup, dbSecret, apiKeySecret } = props;

    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc,
      description: 'Security group for ACP Lambda functions',
    });

    dbSecurityGroup.addIngressRule(lambdaSg, ec2.Port.tcp(5432), 'Lambda to RDS');

    const dbUrl = cdk.Fn.join('', [
      'postgresql://',
      dbSecret.secretValueFromJson('username').unsafeUnwrap(),
      ':',
      dbSecret.secretValueFromJson('password').unsafeUnwrap(),
      '@',
      dbInstance.dbInstanceEndpointAddress,
      ':',
      dbInstance.dbInstanceEndpointPort,
      '/acp',
    ]);

    const commonEnv: Record<string, string> = {
      DATABASE_URL: dbUrl,
      DB_POOL_MAX: '5',
      LOG_LEVEL: config.environment === 'prod' ? 'info' : 'debug',
      API_KEYS_SECRET: apiKeySecret.secretName,
    };

    const commonProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: commonEnv,
    };

    const upsertFn = new lambda.Function(this, 'UpsertFn', {
      ...commonProps,
      functionName: `acp-${config.environment}-upsert-object`,
      handler: 'dist/handlers/upsert-object.handler',
      code: lambda.Code.fromAsset('../packages/api'),
    });

    const bulkUpsertFn = new lambda.Function(this, 'BulkUpsertFn', {
      ...commonProps,
      functionName: `acp-${config.environment}-bulk-upsert`,
      handler: 'dist/handlers/bulk-upsert.handler',
      code: lambda.Code.fromAsset('../packages/api'),
      timeout: cdk.Duration.seconds(60),
    });

    const getObjectFn = new lambda.Function(this, 'GetObjectFn', {
      ...commonProps,
      functionName: `acp-${config.environment}-get-object`,
      handler: 'dist/handlers/get-object.handler',
      code: lambda.Code.fromAsset('../packages/api'),
    });

    const recordTxnFn = new lambda.Function(this, 'RecordTxnFn', {
      ...commonProps,
      functionName: `acp-${config.environment}-record-txn`,
      handler: 'dist/handlers/record-transaction.handler',
      code: lambda.Code.fromAsset('../packages/api'),
    });

    const getChangesFn = new lambda.Function(this, 'GetChangesFn', {
      ...commonProps,
      functionName: `acp-${config.environment}-get-changes`,
      handler: 'dist/handlers/get-changes.handler',
      code: lambda.Code.fromAsset('../packages/api'),
    });

    const healthFn = new lambda.Function(this, 'HealthFn', {
      ...commonProps,
      functionName: `acp-${config.environment}-health`,
      handler: 'dist/handlers/health.handler',
      code: lambda.Code.fromAsset('../packages/api'),
    });

    for (const fn of [upsertFn, bulkUpsertFn, getObjectFn, recordTxnFn, getChangesFn, healthFn]) {
      dbSecret.grantRead(fn);
      apiKeySecret.grantRead(fn);
    }

    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: `acp-${config.environment}`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    httpApi.addRoutes({
      path: '/v1/objects',
      methods: [apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('UpsertIntegration', upsertFn),
    });

    httpApi.addRoutes({
      path: '/v1/objects/bulk',
      methods: [apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('BulkUpsertIntegration', bulkUpsertFn),
    });

    httpApi.addRoutes({
      path: '/v1/objects/changes',
      methods: [apigw.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetChangesIntegration', getChangesFn),
    });

    httpApi.addRoutes({
      path: '/v1/objects/{id}',
      methods: [apigw.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetObjectIntegration', getObjectFn),
    });

    httpApi.addRoutes({
      path: '/v1/objects/{id}/txns',
      methods: [apigw.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('RecordTxnIntegration', recordTxnFn),
    });

    httpApi.addRoutes({
      path: '/v1/health',
      methods: [apigw.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('HealthIntegration', healthFn),
    });

    this.apiUrl = httpApi.apiEndpoint;
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
  }
}
