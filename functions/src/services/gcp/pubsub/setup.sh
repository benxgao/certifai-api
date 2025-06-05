#!/bin/bash

# PubSub Service Deployment Script
# This script helps set up the necessary PubSub topics and subscriptions

set -e

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"your-project-id"}
REGION=${REGION:-"us-central1"}

echo "🚀 Setting up PubSub resources for project: $PROJECT_ID"

# Function to create topic if it doesn't exist
create_topic() {
    local topic_name=$1
    echo "📢 Creating topic: $topic_name"

    if gcloud pubsub topics describe "$topic_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
        echo "   ✅ Topic $topic_name already exists"
    else
        gcloud pubsub topics create "$topic_name" --project="$PROJECT_ID"
        echo "   ✅ Topic $topic_name created"
    fi
}

# Function to create subscription if it doesn't exist
create_subscription() {
    local subscription_name=$1
    local topic_name=$2
    local ack_deadline=${3:-600}

    echo "📬 Creating subscription: $subscription_name"

    if gcloud pubsub subscriptions describe "$subscription_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
        echo "   ✅ Subscription $subscription_name already exists"
    else
        gcloud pubsub subscriptions create "$subscription_name" \
            --topic="$topic_name" \
            --project="$PROJECT_ID" \
            --ack-deadline="$ack_deadline"
        echo "   ✅ Subscription $subscription_name created"
    fi
}

# Function to create subscription with dead letter queue
create_subscription_with_dlq() {
    local subscription_name=$1
    local topic_name=$2
    local dlq_topic_name=$3
    local max_delivery_attempts=${4:-5}
    local ack_deadline=${5:-600}

    echo "📬 Creating subscription with DLQ: $subscription_name"

    # Ensure DLQ topic exists
    create_topic "$dlq_topic_name"

    if gcloud pubsub subscriptions describe "$subscription_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
        echo "   ✅ Subscription $subscription_name already exists"
    else
        gcloud pubsub subscriptions create "$subscription_name" \
            --topic="$topic_name" \
            --project="$PROJECT_ID" \
            --ack-deadline="$ack_deadline" \
            --dead-letter-topic="$dlq_topic_name" \
            --max-delivery-attempts="$max_delivery_attempts"
        echo "   ✅ Subscription $subscription_name created with DLQ"
    fi
}

# Example setup for common use cases
echo "📋 Setting up example PubSub resources..."

# User events
create_topic "user-events"
create_subscription "user-events-processor" "user-events" 300
create_topic "user-events-dlq"
create_subscription "user-events-dlq-processor" "user-events-dlq" 600

# Order processing
create_topic "order-events"
create_subscription_with_dlq "order-processor" "order-events" "order-events-dlq" 3 600

# Payment processing
create_topic "payment-events"
create_subscription_with_dlq "payment-processor" "payment-events" "payment-events-dlq" 2 300

# Notification system
create_topic "notifications"
create_subscription "email-notifications" "notifications" 120
create_subscription "sms-notifications" "notifications" 120
create_subscription "push-notifications" "notifications" 60

echo ""
echo "🎉 PubSub setup completed successfully!"
echo ""
echo "📊 Resource summary:"
gcloud pubsub topics list --project="$PROJECT_ID" --format="table(name)"
echo ""
gcloud pubsub subscriptions list --project="$PROJECT_ID" --format="table(name,topic,ackDeadlineSeconds)"

echo ""
echo "🔧 Next steps:"
echo "1. Update your environment variables:"
echo "   export GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
echo "2. Ensure your service account has the following roles:"
echo "   - Pub/Sub Publisher"
echo "   - Pub/Sub Subscriber"
echo "   - Pub/Sub Viewer"
echo "3. Test the setup by running the test script:"
echo "   npm run test:pubsub"
