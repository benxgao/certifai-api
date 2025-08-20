#!/bin/bash

# Deploy Cloud Tasks queues
echo "Deploying Cloud Tasks queues..."

# Check required environment variables
if [ -z "$GCP_REGION" ]; then
    echo "❌ GCP_REGION is not set. Using default: us-central1"
    GCP_REGION="us-central1"
fi

echo "📍 Deploying queues in region: $GCP_REGION"

# Deploy exam questions queue
echo "Creating exam-questions-queue..."
gcloud tasks queues create exam-questions-queue \
  --max-dispatches-per-second=10 \
  --max-retry-duration=86400s \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=5 \
  --location="$GCP_REGION"

echo "✅ Exam questions queue created"

# Deploy knowledge pooling queue
echo "Creating knowledge-pooling-queue..."
gcloud tasks queues create knowledge-pooling-queue \
  --max-dispatches-per-second=10 \
  --max-retry-duration=86400s \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=5 \
  --location="$GCP_REGION"

echo "✅ Knowledge pooling queue created"

# Deploy exam reports queue
echo "Creating exam-reports-queue..."
gcloud tasks queues create exam-reports-queue \
  --max-dispatches-per-second=15 \
  --max-retry-duration=86400s \
  --min-backoff=5s \
  --max-backoff=120s \
  --max-doublings=4 \
  --location="$GCP_REGION"

echo "✅ Exam reports queue created"

echo ""
echo "🎉 All queue deployments complete!"
echo "Queues created:"
echo "  - exam-questions-queue"
echo "  - knowledge-pooling-queue"
echo "  - exam-reports-queue"
echo ""
echo "🔧 Next steps:"
echo "1. Ensure your service account has 'roles/cloudtasks.enqueuer' permission"
echo "2. Test the queues with: ./scripts/validate-cloud-tasks-auth.sh"
echo "3. Deploy your cloud functions: firebase deploy --only functions"
