#!/bin/bash

# Knowledge Pooling REST API Test Script
# Tests the GET /api/users/:user_id/certifications/:cert_id/knowledge-pooling endpoint

BASE_URL="http://127.0.0.1:5001/certifai-uat/us-central1/endpoints"
ENDPOINT="$BASE_URL/api/users/user_123/certifications/1/knowledge-pooling"

echo "🧪 Testing Knowledge Pooling REST API Endpoint"
echo "Endpoint: $ENDPOINT"
echo ""

# Test 1: GET existing knowledge pooling data
echo "📖 Test 1: GET Knowledge Pooling Data"
echo "Request: GET $ENDPOINT"

curl -X GET "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ Test completed"
echo ""

# Test 2: Invalid cert_id
echo "📖 Test 2: Invalid cert_id"
INVALID_ENDPOINT="$BASE_URL/api/users/user_123/certifications/invalid/knowledge-pooling"
echo "Request: GET $INVALID_ENDPOINT"

curl -X GET "$INVALID_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ Test completed"
echo ""

# Test 3: Missing parameters
echo "📖 Test 3: Missing parameters"
MISSING_PARAMS_ENDPOINT="$BASE_URL/api/users//certifications//knowledge-pooling"
echo "Request: GET $MISSING_PARAMS_ENDPOINT"

curl -X GET "$MISSING_PARAMS_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy_token_for_testing" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || echo "Response not in JSON format"

echo ""
echo "✅ All tests completed"
echo ""
echo "📝 Note: These are basic connectivity tests. For full testing:"
echo "   1. Ensure Firebase emulator is running"
echo "   2. Use valid Firebase authentication tokens"
echo "   3. Have existing knowledge pooling data in Firestore"
echo "   4. Use real user_id and cert_id values"
