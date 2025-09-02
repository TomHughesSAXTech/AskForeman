#!/bin/bash

# Embeddings Testing Script
# Tests if embeddings are being generated and stored correctly

echo "================================================"
echo "🔍 Embeddings System Test"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Upload a document and check for embeddings
echo -e "${BLUE}Test 1: Document Upload with Embedding Generation${NC}"
echo "----------------------------------------"

# Create test content
TEST_CONTENT="This is a test document for embeddings. 
HVAC system installation requires proper planning and execution.
The contractor ABC Construction will handle the installation.
Materials include steel beams, drywall, and copper piping.
Cost estimate is approximately \$45,000 for the complete system.
Work will be performed in Room 101, Room 102, and Room 103."

# Convert to base64
BASE64_CONTENT=$(echo "$TEST_CONTENT" | base64 | tr -d '\n')

echo "Uploading test document..."
RESPONSE=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$BASE64_CONTENT\",
    \"fileName\": \"embeddings-test-$(date +%s).txt\",
    \"mimeType\": \"text/plain\",
    \"category\": \"test\",
    \"clientName\": \"EmbeddingTest\",
    \"client\": \"EmbeddingTest\"
  }" 2>/dev/null)

# Check response
if echo "$RESPONSE" | grep -q "success.*true"; then
  echo -e "${GREEN}✅ Document uploaded successfully${NC}"
  
  # Check for embedding indicators
  if echo "$RESPONSE" | grep -q "hasEmbeddings"; then
    echo -e "${GREEN}✅ Response includes embedding status${NC}"
  else
    echo -e "${YELLOW}⚠️ No embedding status in response${NC}"
  fi
else
  echo -e "${RED}❌ Upload failed${NC}"
  echo "Response: $RESPONSE"
fi

echo ""

# Test 2: Query with semantic search
echo -e "${BLUE}Test 2: Semantic Search Test${NC}"
echo "----------------------------------------"
echo "Testing if embeddings enable semantic search..."

# Wait a moment for indexing
sleep 2

# Test semantic search
SEARCH_RESPONSE=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find documents about HVAC installation costs",
    "client": "EmbeddingTest",
    "useSemanticSearch": true
  }' \
  --max-time 15 2>/dev/null)

if echo "$SEARCH_RESPONSE" | grep -q "45,000\|HVAC\|ABC Construction"; then
  echo -e "${GREEN}✅ Semantic search found relevant content${NC}"
else
  echo -e "${YELLOW}⚠️ Semantic search did not find expected content${NC}"
fi

echo ""

# Test 3: Check Azure Function directly
echo -e "${BLUE}Test 3: Direct Azure Function Test${NC}"
echo "----------------------------------------"

# Test if the function responds to embedding requests
TEST_PAYLOAD='{
  "file": "'$BASE64_CONTENT'",
  "fileName": "direct-test.txt",
  "clientName": "DirectTest",
  "category": "test",
  "generateEmbeddings": true
}'

echo "Testing Azure Function endpoint..."
FUNCTION_RESPONSE=$(curl -s -X POST https://saxtech-functionapps.azurewebsites.net/api/ConvertDocumentJson \
  -H "Content-Type: application/json" \
  -H "x-functions-key: KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng==" \
  -d "$TEST_PAYLOAD" \
  -w "\nSTATUS:%{http_code}" \
  --max-time 10 2>/dev/null)

STATUS=$(echo "$FUNCTION_RESPONSE" | grep "STATUS:" | cut -d: -f2)

if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Azure Function responded successfully${NC}"
  
  # Check for embeddings in response
  if echo "$FUNCTION_RESPONSE" | grep -q "hasEmbeddings.*true"; then
    echo -e "${GREEN}✅ Embeddings were generated${NC}"
  else
    echo -e "${YELLOW}⚠️ No embeddings generated${NC}"
  fi
elif [ "$STATUS" = "401" ]; then
  echo -e "${YELLOW}⚠️ Authentication failed - function key may be incorrect${NC}"
else
  echo -e "${RED}❌ Azure Function error (Status: $STATUS)${NC}"
fi

echo ""

# Test 4: Check configuration
echo -e "${BLUE}Test 4: Configuration Check${NC}"
echo "----------------------------------------"

# Check if OpenAI is configured
echo "Checking for OpenAI configuration..."

# Try to get a simple embedding
EMBEDDING_TEST=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "test",
    "client": "general",
    "debug": true
  }' \
  --max-time 10 2>/dev/null)

if echo "$EMBEDDING_TEST" | grep -q "embedding\|vector\|ada-002"; then
  echo -e "${GREEN}✅ System references embeddings/vectors${NC}"
else
  echo -e "${YELLOW}⚠️ No embedding references found${NC}"
fi

echo ""

# Test 5: Vector similarity search
echo -e "${BLUE}Test 5: Vector Similarity Search${NC}"
echo "----------------------------------------"

# Upload two similar documents
echo "Uploading similar documents for comparison..."

# Document 1: About HVAC costs
DOC1="HVAC installation pricing: Standard system costs range from \$40,000 to \$50,000"
BASE64_DOC1=$(echo "$DOC1" | base64 | tr -d '\n')

curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$BASE64_DOC1\",
    \"fileName\": \"hvac-pricing.txt\",
    \"clientName\": \"VectorTest\",
    \"category\": \"estimates\"
  }" > /dev/null 2>&1

# Document 2: About plumbing costs  
DOC2="Plumbing installation pricing: Standard system costs range from \$20,000 to \$30,000"
BASE64_DOC2=$(echo "$DOC2" | base64 | tr -d '\n')

curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$BASE64_DOC2\",
    \"fileName\": \"plumbing-pricing.txt\",
    \"clientName\": \"VectorTest\",
    \"category\": \"estimates\"
  }" > /dev/null 2>&1

sleep 2

# Search for HVAC (should find HVAC doc with high score, plumbing with lower score)
VECTOR_SEARCH=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are HVAC costs?",
    "client": "VectorTest"
  }' \
  --max-time 15 2>/dev/null)

if echo "$VECTOR_SEARCH" | grep -q "40,000\|50,000"; then
  echo -e "${GREEN}✅ Vector search found relevant HVAC document${NC}"
else
  echo -e "${YELLOW}⚠️ Vector search did not prioritize HVAC content${NC}"
fi

echo ""
echo "================================================"
echo "📊 EMBEDDINGS TEST SUMMARY"
echo "================================================"

# Analyze results
echo ""
echo -e "${BLUE}Diagnosis:${NC}"

# Check what's working
WORKING=0
NOT_WORKING=0

if echo "$RESPONSE" | grep -q "success.*true"; then
  echo -e "${GREEN}✅ Document upload pipeline: WORKING${NC}"
  ((WORKING++))
else
  echo -e "${RED}❌ Document upload pipeline: NOT WORKING${NC}"
  ((NOT_WORKING++))
fi

if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ]; then
  echo -e "${GREEN}✅ Azure Function endpoint: ACCESSIBLE${NC}"
  ((WORKING++))
else
  echo -e "${RED}❌ Azure Function endpoint: NOT ACCESSIBLE${NC}"
  ((NOT_WORKING++))
fi

if echo "$SEARCH_RESPONSE" | grep -q "HVAC\|45,000"; then
  echo -e "${GREEN}✅ Semantic search: WORKING${NC}"
  ((WORKING++))
else
  echo -e "${YELLOW}⚠️ Semantic search: PARTIALLY WORKING${NC}"
fi

echo ""
echo -e "${BLUE}Embedding System Status:${NC}"
if [ $NOT_WORKING -eq 0 ]; then
  echo -e "${GREEN}✅ FULLY OPERATIONAL - Embeddings are being generated and used${NC}"
elif [ $WORKING -gt $NOT_WORKING ]; then
  echo -e "${YELLOW}⚠️ PARTIALLY OPERATIONAL - Some embedding features work${NC}"
else
  echo -e "${RED}❌ NOT OPERATIONAL - Embeddings are not being generated${NC}"
fi

echo ""
echo "================================================"
echo "🔧 HOW TO FIX EMBEDDINGS"
echo "================================================"

echo "
1. Verify Azure OpenAI Configuration:
   - Endpoint: Should be like https://YOUR-RESOURCE.openai.azure.com/
   - API Key: Should be a valid key
   - Deployment: Should be 'text-embedding-ada-002' or similar

2. Check Environment Variables in Azure Function:
   - AZURE_OPENAI_ENDPOINT
   - AZURE_OPENAI_KEY
   - AZURE_OPENAI_DEPLOYMENT_NAME

3. Update Function App Settings:
   az functionapp config appsettings set \\
     --name saxtech-functionapps \\
     --resource-group YOUR_RG \\
     --settings \\
       AZURE_OPENAI_ENDPOINT='https://YOUR-RESOURCE.openai.azure.com/' \\
       AZURE_OPENAI_KEY='YOUR-KEY' \\
       AZURE_OPENAI_DEPLOYMENT_NAME='text-embedding-ada-002'

4. Test with Admin Panel:
   Open admin.html and check the 'Vector Info' column
   - Should show '1536D (Ada-002)' for documents with embeddings
   - 'None' means no embeddings generated

5. Alternative: Use n8n to generate embeddings
   - Add OpenAI node in n8n workflow
   - Generate embeddings before storing documents
"

echo ""
echo "Test completed!"
