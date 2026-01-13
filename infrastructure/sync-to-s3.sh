#!/bin/bash
# S3 Sync Script for Shredly v2
# Usage: ./infrastructure/sync-to-s3.sh [environment]
# Example: ./infrastructure/sync-to-s3.sh prod

set -e

ENVIRONMENT=${1:-dev}
AWS_PROFILE=${AWS_PROFILE:-personal}
BUCKET_NAME="shredly-v2-web-${ENVIRONMENT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Syncing Shredly v2 to S3"
echo "Environment: $ENVIRONMENT"
echo "AWS Profile: $AWS_PROFILE"

# Get CloudFront distribution ID from stack outputs
echo "📡 Getting CloudFront distribution ID..."
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "ShreldyV2InfrastructureStack-${ENVIRONMENT}" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text \
    --profile $AWS_PROFILE)

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "❌ Error: Could not retrieve CloudFront distribution ID"
    echo "Make sure the CDK stack is deployed first: ./infrastructure/deploy.sh $ENVIRONMENT deploy"
    exit 1
fi

echo "Bucket: $BUCKET_NAME"
echo "Distribution: $DISTRIBUTION_ID"

# Build the app
echo "🔨 Building SvelteKit app..."
cd "$PROJECT_ROOT"
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
    --profile $AWS_PROFILE \
    --no-cli-pager

echo "✅ Deployment complete!"
echo "🌐 URL: https://shredly.me (DNS propagation may take up to 48 hours)"
