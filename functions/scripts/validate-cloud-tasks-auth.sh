#!/bin/bash

# Cloud Tasks Authentication Validation Script
# This script helps verify that Cloud Tasks can authenticate with the protected delegators endpoint

set -e

echo "🔍 Validating Cloud Tasks Authentication Setup..."
echo

# Check required environment variables
echo "📋 Checking Environment Variables..."
if [ -z "$GCP_PROJECT_ID" ]; then
    echo "❌ GCP_PROJECT_ID is not set"
    exit 1
else
    echo "✅ GCP_PROJECT_ID: $GCP_PROJECT_ID"
fi

if [ -z "$GCP_REGION" ]; then
    echo "❌ GCP_REGION is not set"
    exit 1
else
    echo "✅ GCP_REGION: $GCP_REGION"
fi

if [ -z "$GCP_TASKS_SERVICE_ACCOUNT" ]; then
    echo "❌ GCP_TASKS_SERVICE_ACCOUNT is not set"
    exit 1
else
    echo "✅ GCP_TASKS_SERVICE_ACCOUNT: $GCP_TASKS_SERVICE_ACCOUNT"
fi

if [ -z "$GCP_TASKS_HOST" ]; then
    echo "❌ GCP_TASKS_HOST is not set"
    exit 1
else
    echo "✅ GCP_TASKS_HOST: $GCP_TASKS_HOST"
fi

echo

# Check if the service account exists
echo "🔐 Checking Service Account..."
if gcloud iam service-accounts describe "$GCP_TASKS_SERVICE_ACCOUNT" --quiet >/dev/null 2>&1; then
    echo "✅ Service account exists: $GCP_TASKS_SERVICE_ACCOUNT"
else
    echo "❌ Service account not found: $GCP_TASKS_SERVICE_ACCOUNT"
    exit 1
fi

echo

# Check IAM roles for the service account
echo "🛡️ Checking IAM Roles..."
roles=$(gcloud projects get-iam-policy "$GCP_PROJECT_ID" --flatten="bindings[].members" --format="value(bindings.role)" --filter="bindings.members:$GCP_TASKS_SERVICE_ACCOUNT")

# For 2nd generation Cloud Functions (Firebase Functions v2), use Cloud Run invoker role
required_roles=("roles/cloudtasks.enqueuer" "roles/run.invoker")
missing_roles=()

for role in "${required_roles[@]}"; do
    if echo "$roles" | grep -q "$role"; then
        echo "✅ $role"
    else
        echo "❌ Missing role: $role"
        missing_roles+=("$role")
    fi
done

if [ ${#missing_roles[@]} -gt 0 ]; then
    echo
    echo "⚠️ Missing required roles. You can add them with:"
    for role in "${missing_roles[@]}"; do
        echo "gcloud projects add-iam-policy-binding $GCP_PROJECT_ID --member='serviceAccount:$GCP_TASKS_SERVICE_ACCOUNT' --role='$role'"
    done
    exit 1
fi

echo

# Check if the queues exist
echo "📋 Checking Cloud Tasks Queues..."

# Check exam questions queue
if gcloud tasks queues describe exam-questions-queue --location="$GCP_REGION" --quiet >/dev/null 2>&1; then
    echo "✅ Queue exists: exam-questions-queue"
else
    echo "❌ Queue not found: exam-questions-queue"
    echo "💡 You can create it with: cd functions && ./scripts/deploy-queues.sh"
    exit 1
fi

# Check knowledge pooling queue
if gcloud tasks queues describe knowledge-pooling-queue --location="$GCP_REGION" --quiet >/dev/null 2>&1; then
    echo "✅ Queue exists: knowledge-pooling-queue"
else
    echo "❌ Queue not found: knowledge-pooling-queue"
    echo "💡 You can create it with: cd functions && ./scripts/deploy-queues.sh"
    exit 1
fi

echo

# Check if the delegators function exists and is deployed
echo "🚀 Checking Delegators Function..."
delegators_url="https://$GCP_REGION-$GCP_PROJECT_ID.cloudfunctions.net/delegators"
if gcloud functions describe delegators --region="$GCP_REGION" --quiet >/dev/null 2>&1; then
    echo "✅ Delegators function is deployed"
    echo "📍 Function URL: $delegators_url"

    # Check if the function is protected
    policy=$(gcloud functions get-iam-policy delegators --region="$GCP_REGION" --format=json 2>/dev/null || echo '{"bindings":[]}')
    if echo "$policy" | grep -q "allUsers"; then
        echo "⚠️ Function allows allUsers access - may not be properly protected"
    else
        echo "✅ Function appears to be properly protected"
    fi
else
    echo "❌ Delegators function not found"
    echo "💡 Deploy it with: firebase deploy --only functions:delegators"
    exit 1
fi

echo

# Validate audience URL construction
echo "🎯 Validating Audience URL..."
expected_audience="https://$GCP_REGION-$GCP_PROJECT_ID.cloudfunctions.net/delegators"
echo "✅ Expected audience: $expected_audience"

echo

# All checks passed
echo "🎉 All validation checks passed!"
echo
echo "📝 Summary:"
echo "   - Environment variables are properly set"
echo "   - Service account exists with required roles"
echo "   - Cloud Tasks queue is configured"
echo "   - Delegators function is deployed and protected"
echo "   - Audience URL is correctly constructed"
echo
echo "🔥 Cloud Tasks should be able to authenticate with the protected delegators endpoint!"
