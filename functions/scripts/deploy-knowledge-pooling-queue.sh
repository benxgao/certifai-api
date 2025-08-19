#!/bin/bash

# Deploy Knowledge Pooling Cloud Tasks queue
echo "Deploying Knowledge Pooling Cloud Tasks queue..."

# Check required environment variables
if [ -z "$GCP_REGION" ]; then
    echo "❌ GCP_REGION is not set. Using default: us-central1"
    GCP_REGION="us-central1"
fi

echo "📍 Deploying queue in region: $GCP_REGION"

# Create knowledge pooling queue with the same configuration as exam questions queue
gcloud tasks queues create knowledge-pooling-queue \
  --max-dispatches-per-second=10 \
  --max-retry-duration=86400s \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=5 \
  --location="$GCP_REGION"

echo "✅ Knowledge Pooling queue deployment complete!"
echo "Queue Name: knowledge-pooling-queue"
echo "Location: $GCP_REGION"
echo "Max Dispatches/Second: 10"
echo "Max Retry Duration: 24 hours"
echo ""
echo "🔧 Next steps:"
echo "1. Ensure your service account has 'roles/cloudtasks.enqueuer' permission"
echo "2. Test the queue with: ./scripts/validate-cloud-tasks-auth.sh"
echo "3. Deploy your cloud functions: firebase deploy --only functions"
