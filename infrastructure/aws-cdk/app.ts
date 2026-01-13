#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ShreldyV2InfrastructureStack } from './lib/shredly-v2-infrastructure-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const domainName = environment === 'prod' ? 'shredly.me' : `shredly-${environment}.me`;

new ShreldyV2InfrastructureStack(app, `ShreldyV2InfrastructureStack-${environment}`, {
  environment,
  domainName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012', // Dummy account for synth without credentials
    region: 'us-east-1', // Must be us-east-1 for ACM certificates used with CloudFront
  },
  description: `Shredly v2 ${environment} infrastructure (S3 + CloudFront + Route 53 + ACM)`,
});

app.synth();
