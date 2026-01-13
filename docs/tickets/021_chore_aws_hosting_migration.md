# Ticket #021: Chore - Migrate from GitHub Pages to AWS Hosting

**Status**: Open
**Priority**: High
**Type**: chore
**Estimated Points**: 8
**Phase**: 2-UI

---

## Summary

Migrate Shredly v2 from temporary GitHub Pages hosting to production AWS infrastructure at shredly.me, replacing Shredly v1 with a simplified client-side-only stack (no Lambda/DynamoDB/API Gateway in Phase 1).

## Background

Shredly v2 is currently hosted on GitHub Pages at https://wabbazzar.github.io/shredly2/ as a temporary development solution. Shredly v1 is live at https://shredly.me with full AWS infrastructure (S3, CloudFront, Route 53, ACM SSL). We need to:

1. Replace v1 with v2 at shredly.me (direct replacement, no blue-green deployment)
2. Simplify AWS infrastructure for client-side-only app (remove Lambda/DynamoDB/API Gateway)
3. Migrate app icons and PWA assets from v1
4. Remove GitHub Pages configuration from codebase
5. Set up auto-deploy from master branch to S3+CloudFront

**Rationale**: GitHub Pages is not a production hosting solution. AWS provides global CDN (CloudFront), HTTPS (ACM), and DNS management (Route 53). Shredly v1 infrastructure is already provisioned and paid for - we're just replacing the hosted content.

## Technical Requirements

### Data Structures

No data structure changes required. This is purely infrastructure work.

### Code Locations

**Files to Delete**:
- `.github/workflows/deploy.yml` - GitHub Pages deployment workflow
- `src/routes/+layout.ts` - Prerender config for GitHub Pages
- `static/.nojekyll` - Jekyll processing prevention

**Files to Modify**:
- `svelte.config.js` - Remove `paths.base` and `GITHUB_PAGES` env check
- `static/manifest.json` - Update with comprehensive icon references from v1
- `package.json` - Add AWS deployment scripts

**Files to Create**:
- `infrastructure/aws-cdk/app.ts` - Simplified CDK app (S3 + CloudFront + Route 53 only)
- `infrastructure/aws-cdk/lib/shredly-v2-infrastructure-stack.ts` - CDK stack definition
- `infrastructure/aws-cdk/package.json` - CDK dependencies
- `infrastructure/aws-cdk/tsconfig.json` - TypeScript config for CDK
- `infrastructure/deploy.sh` - Deployment automation script
- `infrastructure/sync-to-s3.sh` - S3 sync + CloudFront invalidation script
- `.github/workflows/aws-deploy.yml` - Auto-deploy on push to master
- `static/browserconfig.xml` - Windows tile config (from v1)

**Assets to Copy from v1** (`../shredly/assets/icons/` -> `/home/wabbazzar/code/shredly2/static/`):
- `app_icon.png` (1024x1024) - Main app icon, all sizes
- `icon-192.png` - PWA home screen icon (Android, iOS)
- `icon-512.png` - PWA splash screen icon

### TypeScript Types

```typescript
// infrastructure/aws-cdk/lib/shredly-v2-infrastructure-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface ShreldyV2InfrastructureStackProps extends cdk.StackProps {
  environment: string; // 'dev' | 'prod'
  domainName: string; // 'shredly.me' for prod
}

export class ShreldyV2InfrastructureStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly webBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ShreldyV2InfrastructureStackProps);
}
```

## Implementation Plan

### Phase 1: Copy App Icons and Update PWA Config (1 point)

**Goal**: Migrate app icons from v1 to v2 and update manifest.json for comprehensive PWA support.

**Steps**:
1. Copy app icons from v1 to v2 static directory
2. Update `static/manifest.json` with comprehensive icon references
3. Create `static/browserconfig.xml` for Windows tiles
4. Verify icons are accessible in dev server

**Files**:
- Copy: `/home/wabbazzar/code/shredly/assets/icons/app_icon.png` -> `/home/wabbazzar/code/shredly2/static/app_icon.png`
- Copy: `/home/wabbazzar/code/shredly/assets/icons/icon-192.png` -> `/home/wabbazzar/code/shredly2/static/icon-192.png`
- Copy: `/home/wabbazzar/code/shredly/assets/icons/icon-512.png` -> `/home/wabbazzar/code/shredly2/static/icon-512.png`
- Modify: `/home/wabbazzar/code/shredly2/static/manifest.json`
- Create: `/home/wabbazzar/code/shredly2/static/browserconfig.xml`

**Testing**:
- [ ] Run `npm run dev` and verify icons load at http://localhost:5173/app_icon.png
- [ ] Verify manifest.json is valid JSON
- [ ] Test PWA install on Chrome desktop (should show app icon)
- [ ] Verify browserconfig.xml is valid XML

**Commit Message**:
```
chore(pwa): migrate app icons from v1 and update manifest

- Copy app_icon.png, icon-192.png, icon-512.png from v1
- Update manifest.json with comprehensive icon references
- Add browserconfig.xml for Windows tile support
- Prepare for AWS hosting migration
```

**Agent Invocations**:
```bash
# Manual file copy (not code-writer task)
cp /home/wabbazzar/code/shredly/assets/icons/app_icon.png /home/wabbazzar/code/shredly2/static/
cp /home/wabbazzar/code/shredly/assets/icons/icon-192.png /home/wabbazzar/code/shredly2/static/
cp /home/wabbazzar/code/shredly/assets/icons/icon-512.png /home/wabbazzar/code/shredly2/static/

# shredly-code-writer for manifest.json and browserconfig.xml updates
# Invoke: shredly-code-writer agent with "Update manifest.json and create browserconfig.xml per ticket #021 Phase 1"
```

---

### Phase 2: Create AWS CDK Infrastructure (3 points)

**Goal**: Create simplified CDK stack for client-side-only app (S3 + CloudFront + Route 53 + ACM SSL).

**Steps**:
1. Create `infrastructure/aws-cdk/` directory structure
2. Create `package.json` with CDK dependencies
3. Create `tsconfig.json` for TypeScript compilation
4. Create `app.ts` as CDK entry point
5. Create `lib/shredly-v2-infrastructure-stack.ts` with S3, CloudFront, Route 53, ACM resources
6. Install dependencies with `npm install`
7. Build CDK app with `npm run build`

**Files**:
- Create: `/home/wabbazzar/code/shredly2/infrastructure/aws-cdk/package.json`
- Create: `/home/wabbazzar/code/shredly2/infrastructure/aws-cdk/tsconfig.json`
- Create: `/home/wabbazzar/code/shredly2/infrastructure/aws-cdk/app.ts`
- Create: `/home/wabbazzar/code/shredly2/infrastructure/aws-cdk/lib/shredly-v2-infrastructure-stack.ts`
- Create: `/home/wabbazzar/code/shredly2/infrastructure/aws-cdk/cdk.json` (CDK config)
- Create: `/home/wabbazzar/code/shredly2/infrastructure/aws-cdk/.gitignore` (exclude node_modules, cdk.out)

**CDK Stack Resources**:
```typescript
// S3 Bucket for static hosting
const webBucket = new s3.Bucket(this, 'ShreldyV2WebBucket', {
  bucketName: `shredly-v2-web-${environment}`,
  removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: environment !== 'prod',
  versioned: true,
  publicReadAccess: false,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  websiteIndexDocument: 'index.html',
  websiteErrorDocument: 'index.html',
});

// ACM Certificate for HTTPS (must be in us-east-1 for CloudFront)
const certificate = new acm.Certificate(this, 'ShreldyV2Certificate', {
  domainName: props.domainName,
  subjectAlternativeNames: [`www.${props.domainName}`],
  validation: acm.CertificateValidation.fromDns(),
});

// CloudFront Distribution for global CDN
const distribution = new cloudfront.Distribution(this, 'ShreldyV2Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(webBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
  },
  domainNames: [props.domainName, `www.${props.domainName}`],
  certificate: certificate,
  defaultRootObject: 'index.html',
  errorResponses: [
    {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
    },
  ],
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
});

// Route 53 Hosted Zone (use existing from v1 or create new)
const hostedZone = route53.HostedZone.fromLookup(this, 'ShreldyHostedZone', {
  domainName: props.domainName,
});

// Route 53 A Record pointing to CloudFront
new route53.ARecord(this, 'ShreldyV2ARecord', {
  zone: hostedZone,
  recordName: props.domainName,
  target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
});

// Route 53 A Record for www subdomain
new route53.ARecord(this, 'ShreldyV2WWWRecord', {
  zone: hostedZone,
  recordName: `www.${props.domainName}`,
  target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
});
```

**Testing**:
- [ ] `npm install` succeeds in `infrastructure/aws-cdk/`
- [ ] `npm run build` compiles TypeScript without errors
- [ ] `npx cdk synth --context environment=prod` generates CloudFormation template
- [ ] Review CloudFormation template for correctness (S3, CloudFront, Route 53, ACM)
- [ ] No Lambda, DynamoDB, API Gateway resources in template

**Commit Message**:
```
chore(infra): create AWS CDK stack for v2 hosting

- Add CDK package.json with aws-cdk-lib dependencies
- Create CDK app entry point (app.ts)
- Implement ShreldyV2InfrastructureStack (S3, CloudFront, Route 53, ACM)
- Exclude backend resources (Lambda, DynamoDB, API Gateway)
- Support dev/prod environments via context
```

**Agent Invocations**:
```bash
# shredly-code-writer for all CDK infrastructure files
# Invoke: shredly-code-writer agent with "Create AWS CDK infrastructure per ticket #021 Phase 2"

# Verify build
cd infrastructure/aws-cdk && npm install && npm run build
npx cdk synth --context environment=prod
```

---

### Phase 3: Create Deployment Scripts (2 points)

**Goal**: Automate infrastructure deployment and content sync to S3 with CloudFront invalidation.

**Steps**:
1. Create `infrastructure/deploy.sh` for CDK deployments (bootstrap, synth, deploy, destroy)
2. Create `infrastructure/sync-to-s3.sh` for uploading built assets to S3 + CloudFront cache invalidation
3. Make scripts executable with `chmod +x`
4. Test dry-run of sync script (without actual AWS credentials)

**Files**:
- Create: `/home/wabbazzar/code/shredly2/infrastructure/deploy.sh`
- Create: `/home/wabbazzar/code/shredly2/infrastructure/sync-to-s3.sh`

**deploy.sh Template**:
```bash
#!/bin/bash
# AWS CDK Deployment Script for Shredly v2
# Usage: ./infrastructure/deploy.sh [environment] [action]
# Example: ./infrastructure/deploy.sh prod deploy

set -e

ENVIRONMENT=${1:-dev}
ACTION=${2:-deploy}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$SCRIPT_DIR/aws-cdk"

echo "🚀 Shredly v2 AWS Deployment"
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"

cd "$CDK_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    npm install
fi

# Build the CDK app
echo "🔨 Building CDK app..."
npm run build

case $ACTION in
    "bootstrap")
        echo "🌱 Bootstrapping CDK environment..."
        npx cdk bootstrap --context environment=$ENVIRONMENT
        ;;
    "synth")
        echo "🔍 Synthesizing CloudFormation template..."
        npx cdk synth --context environment=$ENVIRONMENT
        ;;
    "deploy")
        echo "🚀 Deploying infrastructure..."
        npx cdk deploy --context environment=$ENVIRONMENT --require-approval never
        ;;
    "destroy")
        echo "💥 Destroying infrastructure..."
        npx cdk destroy --context environment=$ENVIRONMENT --force
        ;;
    "diff")
        echo "📊 Showing deployment diff..."
        npx cdk diff --context environment=$ENVIRONMENT
        ;;
    *)
        echo "❌ Unknown action: $ACTION"
        echo "Available actions: bootstrap, synth, deploy, destroy, diff"
        exit 1
        ;;
esac

echo "✅ Deployment action completed successfully!"
```

**sync-to-s3.sh Template**:
```bash
#!/bin/bash
# S3 Sync Script for Shredly v2
# Usage: ./infrastructure/sync-to-s3.sh [environment]
# Example: ./infrastructure/sync-to-s3.sh prod

set -e

ENVIRONMENT=${1:-dev}
AWS_PROFILE=${AWS_PROFILE:-personal}
BUCKET_NAME="shredly-v2-web-${ENVIRONMENT}"
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "ShreldyV2InfrastructureStack-${ENVIRONMENT}" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text \
    --profile $AWS_PROFILE)

echo "🚀 Syncing Shredly v2 to S3"
echo "Environment: $ENVIRONMENT"
echo "Bucket: $BUCKET_NAME"
echo "Distribution: $DISTRIBUTION_ID"

# Build the app
echo "🔨 Building SvelteKit app..."
npm run build

# Sync to S3
echo "📤 Uploading to S3..."
aws s3 sync build/ "s3://${BUCKET_NAME}/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --profile $AWS_PROFILE

# Upload HTML files with shorter cache (for SPA routing)
aws s3 sync build/ "s3://${BUCKET_NAME}/" \
    --cache-control "public, max-age=0, must-revalidate" \
    --exclude "*" \
    --include "*.html" \
    --profile $AWS_PROFILE

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --profile $AWS_PROFILE

echo "✅ Deployment complete!"
echo "🌐 URL: https://shredly.me (DNS propagation may take up to 48 hours)"
```

**Testing**:
- [ ] Scripts are executable (`chmod +x infrastructure/*.sh`)
- [ ] `./infrastructure/deploy.sh prod synth` runs without errors
- [ ] Review sync-to-s3.sh logic (correct cache headers, invalidation)
- [ ] Scripts follow bash best practices (set -e, error handling)

**Commit Message**:
```
chore(infra): add deployment automation scripts

- Create deploy.sh for CDK infrastructure management
- Create sync-to-s3.sh for content deployment + cache invalidation
- Support bootstrap, synth, deploy, destroy, diff actions
- Set appropriate cache headers for static assets
```

**Agent Invocations**:
```bash
# shredly-code-writer for deployment scripts
# Invoke: shredly-code-writer agent with "Create deployment scripts per ticket #021 Phase 3"

# Make executable
chmod +x infrastructure/deploy.sh infrastructure/sync-to-s3.sh
```

---

### Phase 4: Remove GitHub Pages Configuration (1 point)

**Goal**: Clean up all GitHub Pages-specific configuration from codebase.

**Steps**:
1. Delete `.github/workflows/deploy.yml`
2. Delete `src/routes/+layout.ts`
3. Delete `static/.nojekyll`
4. Remove `paths.base` and `GITHUB_PAGES` env check from `svelte.config.js`
5. Test local build to ensure no errors

**Files**:
- Delete: `/home/wabbazzar/code/shredly2/.github/workflows/deploy.yml`
- Delete: `/home/wabbazzar/code/shredly2/src/routes/+layout.ts`
- Delete: `/home/wabbazzar/code/shredly2/static/.nojekyll`
- Modify: `/home/wabbazzar/code/shredly2/svelte.config.js` (remove lines 4-6, 20-22)

**svelte.config.js After Cleanup**:
```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		alias: {
			$lib: './src/lib',
			$data: './src/data'
		}
	}
};

export default config;
```

**Testing**:
- [ ] `npm run build` succeeds with no errors
- [ ] `npm run preview` works (serves on localhost:4173)
- [ ] Verify build/ directory contains index.html at root
- [ ] No GitHub Pages-specific files remain in project
- [ ] TypeScript compilation succeeds (`npm run typecheck`)

**Commit Message**:
```
chore(config): remove GitHub Pages configuration

- Delete .github/workflows/deploy.yml (GitHub Pages workflow)
- Delete src/routes/+layout.ts (prerender config)
- Delete static/.nojekyll (Jekyll prevention)
- Remove paths.base from svelte.config.js
- Prepare for AWS hosting at root domain
```

**Agent Invocations**:
```bash
# Manual file deletion (simple enough for direct bash)
rm .github/workflows/deploy.yml
rm src/routes/+layout.ts
rm static/.nojekyll

# shredly-code-writer for svelte.config.js cleanup
# Invoke: shredly-code-writer agent with "Clean up svelte.config.js per ticket #021 Phase 4"
```

---

### Phase 5: Create GitHub Actions Workflow for AWS Deploy (1 point)

**Goal**: Auto-deploy to AWS on every push to master branch.

**Steps**:
1. Create `.github/workflows/aws-deploy.yml` with build + deploy steps
2. Configure AWS credentials using GitHub Secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
3. Test workflow dry-run (without actual AWS deployment)

**Files**:
- Create: `/home/wabbazzar/code/shredly2/.github/workflows/aws-deploy.yml`

**aws-deploy.yml Template**:
```yaml
# AWS Deployment Workflow for Shredly v2
# Auto-deploys to S3 + CloudFront on push to master
name: Deploy to AWS

on:
  push:
    branches: [master]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ENVIRONMENT: prod

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate SvelteKit files
        run: npx svelte-kit sync

      - name: Run tests
        run: npm test

      - name: TypeScript check
        run: npm run typecheck

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://shredly.me
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Get CloudFront Distribution ID
        id: get-distribution
        run: |
          DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
            --stack-name "ShreldyV2InfrastructureStack-${{ env.ENVIRONMENT }}" \
            --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
            --output text)
          echo "distribution_id=$DISTRIBUTION_ID" >> $GITHUB_OUTPUT

      - name: Sync to S3
        run: |
          # Upload assets with long cache
          aws s3 sync build/ "s3://shredly-v2-web-${{ env.ENVIRONMENT }}/" \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "*.html"

          # Upload HTML with short cache (SPA routing)
          aws s3 sync build/ "s3://shredly-v2-web-${{ env.ENVIRONMENT }}/" \
            --cache-control "public, max-age=0, must-revalidate" \
            --exclude "*" \
            --include "*.html"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ steps.get-distribution.outputs.distribution_id }} \
            --paths "/*"

      - name: Deployment summary
        run: |
          echo "✅ Deployment complete!"
          echo "🌐 URL: https://shredly.me"
          echo "📦 S3 Bucket: shredly-v2-web-${{ env.ENVIRONMENT }}"
          echo "🔄 CloudFront Distribution: ${{ steps.get-distribution.outputs.distribution_id }}"
```

**Testing**:
- [ ] Workflow YAML is valid (check syntax with yamllint or GitHub Actions validator)
- [ ] Workflow includes test job before deploy (fail-safe)
- [ ] AWS credentials are parameterized (no hardcoded keys)
- [ ] CloudFront invalidation uses correct distribution ID from stack outputs
- [ ] S3 sync uses correct bucket name and cache headers

**Commit Message**:
```
chore(ci): add GitHub Actions workflow for AWS deployment

- Create aws-deploy.yml for auto-deploy on master push
- Run tests before deploying (fail-safe)
- Sync build output to S3 with appropriate cache headers
- Invalidate CloudFront cache after deployment
- Require AWS credentials via GitHub Secrets
```

**Agent Invocations**:
```bash
# shredly-code-writer for GitHub Actions workflow
# Invoke: shredly-code-writer agent with "Create AWS deployment workflow per ticket #021 Phase 5"
```

---

## Testing Strategy

### Unit Tests

No unit tests required (infrastructure-only work).

### Integration Tests

No integration tests required (infrastructure-only work).

### Manual Testing

**Phase 1 - Icons**:
```bash
npm run dev
# Open browser to http://localhost:5173/app_icon.png
# Verify icon displays
# Open http://localhost:5173/manifest.json
# Verify JSON is valid and includes all icon references
```

**Phase 2 - CDK Synth**:
```bash
cd infrastructure/aws-cdk
npm install
npm run build
npx cdk synth --context environment=prod
# Review CloudFormation template output
# Verify S3, CloudFront, Route 53, ACM resources present
# Verify NO Lambda, DynamoDB, API Gateway resources
```

**Phase 3 - Deployment Scripts**:
```bash
# Test deploy script (dry-run with synth)
./infrastructure/deploy.sh prod synth

# Review sync-to-s3.sh logic (do NOT run until infrastructure is deployed)
cat infrastructure/sync-to-s3.sh
```

**Phase 4 - GitHub Pages Cleanup**:
```bash
npm run build
npm run preview
# Open http://localhost:4173
# Verify app loads correctly at root path (not /shredly2)
```

**Phase 5 - GitHub Actions**:
```bash
# Validate YAML syntax
cat .github/workflows/aws-deploy.yml | npx js-yaml
# Check workflow runs on push to master (after commit)
```

**AWS Deployment (After All Phases)**:
```bash
# 1. Bootstrap CDK (one-time setup)
./infrastructure/deploy.sh prod bootstrap

# 2. Deploy infrastructure
./infrastructure/deploy.sh prod deploy
# Wait 5-10 minutes for CloudFormation stack creation
# Note CloudFront distribution URL from outputs

# 3. Test CloudFront URL before updating DNS
curl -I https://[cloudfront-distribution-id].cloudfront.net
# Should return 200 OK

# 4. Sync content to S3
./infrastructure/sync-to-s3.sh prod

# 5. Test CloudFront URL again (with content)
open https://[cloudfront-distribution-id].cloudfront.net
# Should load Shredly v2 app

# 6. Update Porkbun nameservers to Route 53 (final step)
# Get Route 53 nameservers from AWS Console
# Update Porkbun domain settings: shredly.me -> Route 53 nameservers

# 7. Wait for DNS propagation (up to 48 hours, usually <2 hours)
dig shredly.me
# Should show Route 53 nameservers

# 8. Test production URL
open https://shredly.me
# Should load Shredly v2 app with HTTPS
```

**Mobile PWA Testing**:
```bash
# iOS Safari
# 1. Navigate to https://shredly.me
# 2. Tap Share button
# 3. Tap "Add to Home Screen"
# 4. Verify app icon appears (not generic browser icon)
# 5. Tap app icon on home screen
# 6. Verify app opens in standalone mode (no browser UI)

# Android Chrome
# 1. Navigate to https://shredly.me
# 2. Tap "Install app" prompt or menu -> "Add to Home screen"
# 3. Verify app icon appears on home screen
# 4. Tap app icon
# 5. Verify app opens in standalone mode
```

### Test Acceptance Criteria

- [ ] All 566 unit tests pass (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] GitHub Pages config completely removed from codebase
- [ ] CDK synth generates valid CloudFormation template
- [ ] CDK stack deploys successfully to AWS
- [ ] S3 bucket created with correct name and settings
- [ ] CloudFront distribution created with custom domain (shredly.me)
- [ ] ACM SSL certificate issued and attached to CloudFront
- [ ] Route 53 A records point to CloudFront distribution
- [ ] DNS resolves shredly.me to CloudFront
- [ ] HTTPS works with no browser warnings
- [ ] App loads correctly at https://shredly.me
- [ ] PWA install works on iOS and Android with correct app icon
- [ ] GitHub Actions workflow triggers on push to master
- [ ] Auto-deploy workflow succeeds (test + deploy jobs)

---

## Success Criteria

- [ ] shredly.me serves Shredly v2 SvelteKit app
- [ ] HTTPS working with ACM certificate (no browser warnings)
- [ ] CloudFront CDN distributing globally (verify with curl from different regions)
- [ ] App icons correctly configured for PWA (iOS/Android home screen shows correct icon)
- [ ] Auto-deploy on git push to master (GitHub Actions workflow)
- [ ] DNS propagation complete (dig shredly.me shows Route 53 nameservers)
- [ ] All GitHub Pages config removed from codebase
- [ ] v1 content fully replaced by v2 (no residual v1 files in S3)
- [ ] Route 53 hosted zone contains only v2 records
- [ ] No Lambda, DynamoDB, or API Gateway resources in CDK stack
- [ ] Build output is optimized (cache headers, compression)
- [ ] 566 tests still passing after migration

---

## Dependencies

### Blocked By
- None (all prerequisites complete - CLI engine done, UI functional)

### Blocks
- Mobile Capacitor builds (cannot publish to app stores without production domain)
- Service worker for offline support (needs HTTPS)
- Future backend features (user sync, social features)

### External Dependencies
- AWS account with active credentials
- Porkbun domain access (for updating nameservers)
- GitHub Secrets configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)
- AWS CLI installed and configured (`aws configure --profile personal`)

---

## Risks & Mitigations

### Risk 1: DNS Propagation Delay
- **Impact**: High (users cannot access site during propagation)
- **Probability**: Medium (DNS can take up to 48 hours)
- **Mitigation**:
  - Test CloudFront distribution URL before updating DNS
  - Update DNS during low-traffic period (late night UTC)
  - Keep v1 running until v2 DNS is confirmed working
  - Use dig/nslookup to monitor propagation progress

### Risk 2: ACM Certificate Validation Delay
- **Impact**: High (cannot enable HTTPS without certificate)
- **Probability**: Medium (DNS validation can take 30 minutes to 24 hours)
- **Mitigation**:
  - Deploy infrastructure well before DNS cutover
  - Use DNS validation (not email validation)
  - Verify Route 53 hosted zone has correct NS records
  - CDK handles validation records automatically

### Risk 3: CloudFront Cache Serving Stale Content
- **Impact**: Medium (users see old content after deployment)
- **Probability**: High (CloudFront caches aggressively)
- **Mitigation**:
  - Always run cache invalidation after S3 sync
  - Use versioned asset filenames (SvelteKit does this by default)
  - Set appropriate Cache-Control headers (long for assets, short for HTML)
  - Test with hard refresh (Cmd+Shift+R) after deployment

### Risk 4: GitHub Actions Workflow Fails to Deploy
- **Impact**: Medium (manual deployment required)
- **Probability**: Low (well-tested workflow pattern)
- **Mitigation**:
  - Test workflow with workflow_dispatch trigger first
  - Include test job as prerequisite (fail early)
  - Keep manual deployment script (infrastructure/sync-to-s3.sh) as backup
  - Monitor GitHub Actions logs for errors

### Risk 5: S3 Bucket Name Collision
- **Impact**: Low (cannot create bucket)
- **Probability**: Low (bucket names are unique, but shredly-v2-web-prod might be taken)
- **Mitigation**:
  - Include AWS account ID in bucket name (shredly-v2-web-prod-037195638157)
  - Use CDK account token: `shredly-v2-web-${environment}-${this.account}`
  - If name is taken, add unique suffix (timestamp or UUID)

### Risk 6: Breaking Production v1 Site During Migration
- **Impact**: High (users cannot access site)
- **Probability**: Low (careful DNS management)
- **Mitigation**:
  - Do NOT touch v1 infrastructure or S3 bucket until v2 is confirmed working
  - Test v2 thoroughly on CloudFront distribution URL before DNS cutover
  - Keep v1 DNS records intact until v2 is live
  - Have rollback plan: revert Porkbun nameservers to v1 Route 53 hosted zone

---

## Notes

### AWS Cost Estimate

**Monthly costs for client-side-only app**:
- S3 storage: ~$0.50 (assuming 100MB of static assets, negligible GET requests)
- CloudFront: ~$1-5 (depends on traffic, free tier covers first 1TB of data transfer)
- Route 53: $0.50 per hosted zone + $0.40 per million queries (negligible for low traffic)
- ACM SSL: **FREE** (AWS-managed certificates are free)
- **Total**: ~$2-6/month (compared to $0 for GitHub Pages, but includes CDN and custom domain)

### Migration Timeline

**Conservative estimate (with propagation delays)**:
- Phase 1 (Icons): 15 minutes
- Phase 2 (CDK Infrastructure): 1 hour
- Phase 3 (Deployment Scripts): 30 minutes
- Phase 4 (GitHub Pages Cleanup): 15 minutes
- Phase 5 (GitHub Actions): 30 minutes
- **Development Total**: 2.5 hours (3 points)

**AWS Deployment**:
- CDK bootstrap: 5 minutes
- CDK deploy: 10-30 minutes (CloudFormation stack creation)
- ACM certificate validation: 30 minutes to 24 hours (DNS validation)
- CloudFront distribution creation: 10-20 minutes
- S3 sync: 2-5 minutes
- DNS propagation: 1-48 hours (usually <2 hours)
- **Deployment Total**: 1-50 hours (mostly waiting for AWS resources)

**Point Estimate**: 8 points (conservative, includes AWS waiting time risk)

### Rollback Strategy

If v2 deployment fails or has critical issues:

```bash
# 1. Revert Porkbun nameservers to v1 Route 53 hosted zone
# (Get nameservers from v1 infrastructure stack outputs)

# 2. Wait for DNS propagation to revert (1-2 hours)

# 3. Investigate v2 issue without time pressure

# 4. Fix v2 issue

# 5. Test v2 again on CloudFront distribution URL

# 6. Retry DNS cutover when ready
```

### Post-Migration Cleanup (Future Ticket)

After v2 is confirmed stable for 1-2 weeks:
- Delete v1 CDK stack (Lambda, DynamoDB, API Gateway, old S3 bucket)
- Delete v1 Route 53 hosted zone (if separate from v2)
- Archive v1 codebase repository
- Update documentation to remove v1 references

### SvelteKit Build Optimization

Current build output (GitHub Pages):
- adapter-static with fallback: 'index.html' (SPA mode)
- All routes pre-rendered as static HTML

AWS hosting requirements:
- Same adapter-static configuration (no changes needed)
- CloudFront error response: 404 -> 200 /index.html (for client-side routing)
- Cache-Control headers: long for assets (hashed filenames), short for HTML

No changes needed to SvelteKit configuration - adapter-static works perfectly for AWS S3+CloudFront.

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: infra, pwa, config, ci, deploy
- **NEVER include "🤖 Generated with [Claude Code]" or "Co-Authored-By: Claude"**

**Commit after EVERY phase completion** - this is our safety net for rollback.

---

## Definition of Done

- [ ] All phases implemented and tested
- [ ] All tests passing (566 tests)
- [ ] TypeScript compilation succeeds
- [ ] GitHub Pages configuration completely removed
- [ ] CDK infrastructure deployed to AWS
- [ ] CloudFront distribution serving v2 app
- [ ] DNS propagation complete (shredly.me resolves to CloudFront)
- [ ] HTTPS working with ACM certificate
- [ ] PWA install works on iOS/Android with correct app icon
- [ ] Auto-deploy workflow triggers on master push
- [ ] Manual deployment script tested and documented
- [ ] v1 content replaced by v2 (no residual files)
- [ ] CLAUDE.md "Current Development Status" updated
