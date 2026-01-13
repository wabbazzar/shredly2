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
        npx cdk bootstrap --profile personal --context environment=$ENVIRONMENT
        ;;
    "synth")
        echo "🔍 Synthesizing CloudFormation template..."
        npx cdk synth --profile personal --context environment=$ENVIRONMENT
        ;;
    "deploy")
        echo "🚀 Deploying infrastructure..."
        npx cdk deploy --profile personal --context environment=$ENVIRONMENT --require-approval never
        ;;
    "destroy")
        echo "💥 Destroying infrastructure..."
        npx cdk destroy --profile personal --context environment=$ENVIRONMENT --force
        ;;
    "diff")
        echo "📊 Showing deployment diff..."
        npx cdk diff --profile personal --context environment=$ENVIRONMENT
        ;;
    *)
        echo "❌ Unknown action: $ACTION"
        echo "Available actions: bootstrap, synth, deploy, destroy, diff"
        exit 1
        ;;
esac

echo "✅ Deployment action completed successfully!"
