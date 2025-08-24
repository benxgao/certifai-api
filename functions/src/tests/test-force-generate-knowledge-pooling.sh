#!/bin/bash

# Generate Knowledge Pooling API Test Script
# Tests the POST /api/users/:user_id/certifications/:cert_id/knowledge-pooling endpoint

BASE_URL="http://127.0.0.1:5001/certifai-uat/us-central1/endpoints"
USER_ID="user_123"
CERT_ID="1"
EXAM_ID="exam_456"
ENDPOINT="$BASE_URL/api/users/$USER_ID/certifications/$CERT_ID/knowledge-pooling"

echo "🧪 Testing Generate Knowledge Pooling API Endpoint"
echo "Endpoint: $ENDPOINT"
echo ""

# Test 1: Generate knowledge pooling with specific exam_id
echo "🚀 Test 1: Generate Knowledge Pooling with exam_id"
echo "Request: POST $ENDPOINT"

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -d '{
    "exam_id": "'$EXAM_ID'",
    "forceGenerate": false
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ Test completed"
echo ""

# Test 2: Force regenerate knowledge pooling
echo "� Test 2: Force Regenerate Knowledge Pooling"
echo "Request: POST $ENDPOINT"

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -d '{
    "exam_id": "'$EXAM_ID'",
    "forceGenerate": true
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ Test completed"
echo ""

# Test 3: Missing exam_id
echo "❌ Test 3: Missing exam_id"
echo "Request: POST $ENDPOINT"

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -d '{
    "forceGenerate": true
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ Test completed"
echo ""

# Test 4: Invalid user_id
echo "📋 Test 4: Invalid user_id"
INVALID_ENDPOINT="$BASE_URL/api/users/invalid_user/certifications/$CERT_ID/knowledge-pooling"
echo "Request: POST $INVALID_ENDPOINT"

curl -X POST "$INVALID_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -d '{
    "exam_id": "'$EXAM_ID'",
    "forceGenerate": false
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ Test completed"
echo ""

# Test 5: Invalid cert_id
echo "📋 Test 5: Invalid cert_id (non-numeric)"
INVALID_CERT_ENDPOINT="$BASE_URL/api/users/$USER_ID/certifications/invalid_cert/knowledge-pooling"
echo "Request: POST $INVALID_CERT_ENDPOINT"

curl -X POST "$INVALID_CERT_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -d '{
    "exam_id": "'$EXAM_ID'",
    "forceGenerate": false
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ Test completed"
echo ""

# Test 6: Missing authentication
echo "🔒 Test 6: Missing Authentication"
echo "Request: POST $ENDPOINT (no auth header)"

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": "'$EXAM_ID'",
    "forceGenerate": false
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ All tests completed"
echo ""

echo "📊 Summary:"
echo "- Test 1: Generate with specific exam_id and forceGenerate=false"
echo "- Test 2: Force regenerate with forceGenerate=true"
echo "- Test 3: Missing exam_id validation"
echo "- Test 4: Invalid user_id handling"
echo "- Test 5: Invalid cert_id handling"
echo "- Test 6: Authentication requirement"
echo ""
echo "🎯 Expected behavior:"
echo "- Test 1: Should return 200 with knowledge pooling data"
echo "- Test 2: Should return 200 with regenerated data"
echo "- Test 3: Should return 400 (exam_id required)"
echo "- Test 4: Should return 404 or 403 (user not found or unauthorized)"
echo "- Test 5: Should return 400 (invalid cert_id format)"
echo "- Test 6: Should return 401 (authentication required)"
