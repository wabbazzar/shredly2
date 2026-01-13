import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ShreldyV2InfrastructureStackProps extends cdk.StackProps {
  environment: string; // 'dev' | 'prod'
  domainName: string; // 'shredly.me' for prod
}

export class ShreldyV2InfrastructureStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly webBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ShreldyV2InfrastructureStackProps) {
    super(scope, id, props);

    const { environment, domainName } = props;

    // S3 Bucket for static hosting
    this.webBucket = new s3.Bucket(this, 'ShreldyV2WebBucket', {
      bucketName: `shredly-v2-web-${environment}-${this.account}`,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    // Origin Access Identity for CloudFront to access S3
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'ShreldyV2OAI', {
      comment: `OAI for Shredly v2 ${environment}`,
    });

    // Grant read access to OAI
    this.webBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.webBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // ACM Certificate for HTTPS (must be in us-east-1 for CloudFront)
    const certificate = new acm.Certificate(this, 'ShreldyV2Certificate', {
      domainName: domainName,
      subjectAlternativeNames: [`www.${domainName}`],
      validation: acm.CertificateValidation.fromDns(),
    });

    // CloudFront Distribution for global CDN
    this.distribution = new cloudfront.Distribution(this, 'ShreldyV2Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.webBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
      },
      domainNames: [domainName, `www.${domainName}`],
      certificate: certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0), // Don't cache 404s in SPA
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // USA, Canada, Europe
      enableLogging: false, // Can enable for production debugging
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // Route 53 Hosted Zone (use existing from v1 or create new)
    const hostedZone = route53.HostedZone.fromLookup(this, 'ShreldyHostedZone', {
      domainName: domainName,
    });

    // Route 53 A Record pointing to CloudFront (apex domain)
    new route53.ARecord(this, 'ShreldyV2ARecord', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      comment: `Shredly v2 ${environment} apex domain`,
    });

    // Route 53 A Record for www subdomain
    new route53.ARecord(this, 'ShreldyV2WWWRecord', {
      zone: hostedZone,
      recordName: `www.${domainName}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      comment: `Shredly v2 ${environment} www subdomain`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.webBucket.bucketName,
      description: 'S3 bucket name for web assets',
      exportName: `ShreldyV2-${environment}-BucketName`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `ShreldyV2-${environment}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `ShreldyV2-${environment}-DistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'DomainName', {
      value: domainName,
      description: 'Custom domain name',
      exportName: `ShreldyV2-${environment}-DomainName`,
    });
  }
}
