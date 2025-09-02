#!/bin/bash

# Knowledge Graph Testing Script
# This tests the knowledge graph functionality from the command line

echo "================================================"
echo "🧠 Knowledge Graph Functionality Test"
echo "================================================"
echo ""

# Configuration
FUNCTION_APP="https://saxtech-functionapps.azurewebsites.net/api"
FUNCTION_KEY="KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng=="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Basic Connectivity
echo "Test 1: Basic Connectivity"
echo "-------------------------"
echo "Testing endpoint: $FUNCTION_APP/ConvertDocumentJson"
echo ""

# Test without authentication
echo "Testing without auth..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FUNCTION_APP/ConvertDocumentJson" \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}')

if [ "$STATUS" = "401" ]; then
  echo -e "${GREEN}✅ Endpoint is secured (401 Unauthorized)${NC}"
elif [ "$STATUS" = "404" ]; then
  echo -e "${RED}❌ Endpoint not found (404)${NC}"
else
  echo -e "${YELLOW}⚠️  Unexpected status: $STATUS${NC}"
fi
echo ""

# Test 2: Authentication Methods
echo "Test 2: Authentication Methods"
echo "-----------------------------"

# Try with header authentication
echo "Testing with x-functions-key header..."
RESPONSE=$(curl -s -X POST "$FUNCTION_APP/ConvertDocumentJson" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: $FUNCTION_KEY" \
  -d '{"test": true, "action": "test"}' \
  -w "\nSTATUS:%{http_code}")

STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/STATUS:/d')

echo "Response Status: $STATUS"
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Header authentication successful${NC}"
  echo "Response: $BODY"
else
  echo -e "${YELLOW}⚠️  Header auth failed, trying query parameter...${NC}"
  
  # Try with query parameter
  RESPONSE=$(curl -s -X POST "$FUNCTION_APP/ConvertDocumentJson?code=$FUNCTION_KEY" \
    -H "Content-Type: application/json" \
    -d '{"test": true, "action": "test"}' \
    -w "\nSTATUS:%{http_code}")
  
  STATUS=$(echo "$RESPONSE" | grep "STATUS:" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed '/STATUS:/d')
  
  echo "Response Status: $STATUS"
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Query parameter authentication successful${NC}"
    echo "Response: $BODY"
  else
    echo -e "${RED}❌ Authentication failed with both methods${NC}"
  fi
fi
echo ""

# Test 3: Check ProcessLargePDF endpoint
echo "Test 3: ProcessLargePDF Endpoint"
echo "--------------------------------"
echo "Testing endpoint: $FUNCTION_APP/ProcessLargePDF"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FUNCTION_APP/ProcessLargePDF" \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}')

if [ "$STATUS" = "401" ]; then
  echo -e "${GREEN}✅ ProcessLargePDF endpoint is secured${NC}"
elif [ "$STATUS" = "404" ]; then
  echo -e "${RED}❌ ProcessLargePDF endpoint not found${NC}"
else
  echo -e "${YELLOW}⚠️  Unexpected status: $STATUS${NC}"
fi
echo ""

# Test 4: Simulate Knowledge Graph Operations
echo "Test 4: Knowledge Graph Operations (Simulation)"
echo "----------------------------------------------"

# Create a test document payload
TEST_DOC='{
  "action": "extract_entities",
  "content": "ABC Construction will install HVAC system in Room 101. Cost estimate: $45,000. Contractor: John Smith.",
  "clientName": "TestClient",
  "category": "estimates",
  "extractEntities": true
}'

echo "Simulating entity extraction from sample text..."
echo "Sample: 'ABC Construction will install HVAC system in Room 101. Cost: $45,000'"
echo ""

# Expected entities
echo "Expected Entity Extraction:"
echo "  • Contractor: ABC Construction"
echo "  • System: HVAC"
echo "  • Location: Room 101"
echo "  • Cost: $45,000"
echo "  • Person: John Smith"
echo ""

# Test 5: Check Alternative Endpoints
echo "Test 5: Alternative Knowledge Graph Endpoints"
echo "--------------------------------------------"

# Check if there are any knowledge-graph specific endpoints
ENDPOINTS=("knowledge-graph" "KnowledgeGraph" "extract-entities" "ExtractEntities" "process-document" "ProcessDocument")

for endpoint in "${ENDPOINTS[@]}"; do
  echo -n "Checking /$endpoint... "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FUNCTION_APP/$endpoint" \
    -H "Content-Type: application/json" \
    -d '{"test": "ping"}' 2>/dev/null)
  
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}Found (Status: $STATUS)${NC}"
  elif [ "$STATUS" = "404" ]; then
    echo -e "${RED}Not Found${NC}"
  else
    echo -e "${YELLOW}Status: $STATUS${NC}"
  fi
done
echo ""

# Summary
echo "================================================"
echo "📊 Test Summary"
echo "================================================"

# Function to test the actual implementation
test_actual_kg() {
  # This would test the actual knowledge graph if it's implemented
  echo "Testing actual knowledge graph implementation..."
  
  # Check if the functions are processing documents correctly
  SAMPLE_PAYLOAD='{
    "fileName": "test.pdf",
    "content": "Sample construction document",
    "clientName": "TestClient",
    "buildKnowledgeGraph": true
  }'
  
  RESPONSE=$(curl -s -X POST "$FUNCTION_APP/ConvertDocumentJson" \
    -H "Content-Type: application/json" \
    -H "x-functions-key: $FUNCTION_KEY" \
    -d "$SAMPLE_PAYLOAD" 2>/dev/null)
  
  if echo "$RESPONSE" | grep -q "entities\|graph\|knowledge"; then
    echo -e "${GREEN}✅ Knowledge graph references found in response${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  No knowledge graph references in response${NC}"
    return 1
  fi
}

# Run actual test
test_actual_kg

echo ""
echo "================================================"
echo "🔍 Diagnosis"
echo "================================================"

if [ "$STATUS" = "401" ]; then
  echo "The Function App is running but authentication is failing."
  echo ""
  echo "Possible issues:"
  echo "1. The function key may be incorrect or expired"
  echo "2. The function may require a different authentication method"
  echo "3. CORS might be blocking browser requests (use this script instead)"
  echo ""
  echo "Next steps:"
  echo "1. Check Azure Portal for the correct function keys"
  echo "2. Verify the function app 'saxtech-functionapps' settings"
  echo "3. Check if knowledge graph functions are actually deployed"
else
  echo "The Function App endpoints are accessible."
  echo "Knowledge graph functionality depends on:"
  echo "1. Azure Functions being properly deployed"
  echo "2. Cosmos DB Graph API being configured"
  echo "3. Azure Cognitive Search being set up"
  echo "4. OpenAI integration for entity extraction"
fi

echo ""
echo "Test completed!"
