import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { AcpConfig } from './config.js';

export interface DataStackProps extends cdk.StackProps {
  config: AcpConfig;
}

export class DataStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecret: secretsmanager.ISecret;
  public readonly apiKeySecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { config } = props;

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      maxAzs: 2,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      description: 'Security group for ACP RDS',
      allowAllOutbound: false,
    });

    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: config.rdsSecretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'acp' }),
        generateStringKey: 'password',
        excludeCharacters: '/@"\\',
      },
    });

    const parameterGroup = new rds.ParameterGroup(this, 'DbParamGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      parameters: {
        'shared_preload_libraries': 'vector',
      },
    });

    this.dbInstance = new rds.DatabaseInstance(this, 'Db', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: new ec2.InstanceType(config.dbInstanceClass),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'acp',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageType: rds.StorageType.GP3,
      multiAz: config.environment === 'prod',
      deletionProtection: config.environment === 'prod',
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      parameterGroup,
    });

    this.apiKeySecret = new secretsmanager.Secret(this, 'ApiKeySecret', {
      secretName: config.apiKeySecretName,
      description: 'API keys for ACP REST API',
    });

    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, 'DbEndpoint', { value: this.dbInstance.dbInstanceEndpointAddress });
  }
}
