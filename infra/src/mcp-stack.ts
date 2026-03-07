import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { AcpConfig } from './config.js';

export interface McpStackProps extends cdk.StackProps {
  config: AcpConfig;
  vpc: ec2.Vpc;
  dbInstance: rds.DatabaseInstance;
  dbSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.ISecret;
}

export class McpStack extends cdk.Stack {
  public readonly albDnsName: string;

  constructor(scope: Construct, id: string, props: McpStackProps) {
    super(scope, id, props);
    const { config, vpc, dbInstance, dbSecurityGroup, dbSecret } = props;

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `acp-${config.environment}-mcp`,
    });

    const repo = new ecr.Repository(this, 'McpRepo', {
      repositoryName: `acp-${config.environment}-mcp-server`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    const logGroup = new logs.LogGroup(this, 'McpLogs', {
      logGroupName: `/acp/${config.environment}/mcp-server`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, 'McpTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

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

    taskDef.addContainer('mcp-server', {
      image: ecs.ContainerImage.fromEcrRepository(repo, 'latest'),
      portMappings: [{ containerPort: 3001 }],
      environment: {
        PORT: '3001',
        DATABASE_URL: dbUrl,
        DB_POOL_MAX: '20',
        LOG_LEVEL: config.environment === 'prod' ? 'info' : 'debug',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'mcp', logGroup }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget -qO- http://localhost:3001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    });

    dbSecret.grantRead(taskDef.taskRole);

    const fargateSg = new ec2.SecurityGroup(this, 'FargateSg', {
      vpc,
      description: 'Security group for MCP Fargate tasks',
    });

    dbSecurityGroup.addIngressRule(fargateSg, ec2.Port.tcp(5432), 'Fargate to RDS');

    const service = new ecs.FargateService(this, 'McpService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [fargateSg],
      platformVersion: ecs.FargatePlatformVersion.LATEST,
    });

    const scaling = service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 4 });
    scaling.scaleOnCpuUtilization('CpuScaling', { targetUtilizationPercent: 70 });

    const alb = new elbv2.ApplicationLoadBalancer(this, 'McpAlb', {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const listener = alb.addListener('HttpListener', { port: 80 });

    listener.addTargets('McpTarget', {
      port: 3001,
      targets: [service],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    fargateSg.addIngressRule(
      ec2.Peer.securityGroupId(alb.connections.securityGroups[0].securityGroupId),
      ec2.Port.tcp(3001),
      'ALB to Fargate',
    );

    this.albDnsName = alb.loadBalancerDnsName;
    new cdk.CfnOutput(this, 'McpAlbDns', { value: alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'EcrRepoUri', { value: repo.repositoryUri });
  }
}
