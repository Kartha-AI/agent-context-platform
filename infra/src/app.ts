import * as cdk from 'aws-cdk-lib';
import { getConfig } from './config.js';
import { DataStack } from './data-stack.js';
import { ApiStack } from './api-stack.js';
import { McpStack } from './mcp-stack.js';

const app = new cdk.App();
const config = getConfig();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const dataStack = new DataStack(app, `acp-${config.environment}-data`, {
  config,
  env,
});

new ApiStack(app, `acp-${config.environment}-api`, {
  config,
  env,
  vpc: dataStack.vpc,
  dbInstance: dataStack.dbInstance,
  dbSecurityGroup: dataStack.dbSecurityGroup,
  dbSecret: dataStack.dbSecret,
  apiKeySecret: dataStack.apiKeySecret,
});

new McpStack(app, `acp-${config.environment}-mcp`, {
  config,
  env,
  vpc: dataStack.vpc,
  dbInstance: dataStack.dbInstance,
  dbSecurityGroup: dataStack.dbSecurityGroup,
  dbSecret: dataStack.dbSecret,
});

app.synth();
