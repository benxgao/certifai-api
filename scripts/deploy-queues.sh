#!/bin/bash

# Deploy Cloud Tasks queues
echo "Deploying Cloud Tasks queues..."
gcloud tasks queues create exam-questions-queue \
  --max-dispatches-per-second=10 \
  --max-retry-duration=86400s \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=5 \
  --location=us-central1

echo "Queue deployment complete!"
