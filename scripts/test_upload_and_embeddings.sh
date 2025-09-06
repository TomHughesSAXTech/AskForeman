#!/bin/bash

# Test script to verify document upload and embedding generation pipeline

echo "========================================="
echo "Document Upload & Embedding Test Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get API keys from Azure
echo -e "${YELLOW}Setting up environment variables...${NC}"
export AZURE_OPENAI_KEY=$(az functionapp config appsettings list --name SAXTech-DocProcessor --resource-group SAXTech-AI --query "[?name=='AZURE_OPENAI_KEY'].value" -o tsv)
export SEARCH_API_KEY=$(az functionapp config appsettings list --name SAXTech-DocProcessor --resource-group SAXTech-AI --query "[?name=='SEARCH_API_KEY'].value" -o tsv)

if [ -z "$AZURE_OPENAI_KEY" ] || [ -z "$SEARCH_API_KEY" ]; then
    echo -e "${RED}Error: Could not retrieve API keys from Azure${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API keys retrieved${NC}"

# Function to check document count in search index
check_document_count() {
    local client=$1
    local count=$(curl -s -X GET \
        "https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/\$count?api-version=2021-04-30-Preview" \
        -H "api-key: $SEARCH_API_KEY" \
        -H "Content-Type: application/json")
    
    if [ -z "$client" ]; then
        echo "Total documents in index: $count"
    else
        local client_count=$(curl -s -X POST \
            "https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/search?api-version=2021-04-30-Preview" \
            -H "api-key: $SEARCH_API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"search\": \"*\", \"filter\": \"client eq '$client'\", \"count\": true}" | \
            python3 -c "import sys, json; print(json.load(sys.stdin).get('@odata.count', 0))")
        echo "Documents for client '$client': $client_count"
    fi
}

# Function to wait for document processing
wait_for_processing() {
    echo -e "${YELLOW}Waiting for document processing (30 seconds)...${NC}"
    for i in {1..30}; do
        echo -n "."
        sleep 1
    done
    echo ""
}

# Main test flow
echo ""
echo "Step 1: Check initial document count"
echo "-------------------------------------"
check_document_count

echo ""
echo "Step 2: Ready for document upload"
echo "---------------------------------"
echo -e "${YELLOW}Please upload a test document now using the web interface:${NC}"
echo "1. Go to https://askforeman.com/estimator.html or projects.html"
echo "2. Select or create a new client (e.g., 'TestClient')"
echo "3. Upload a PDF or image file"
echo "4. Note the client name you used"
echo ""
read -p "Enter the client name you used for upload: " CLIENT_NAME
read -p "Press Enter after upload is complete..."

# Wait for processing
wait_for_processing

echo ""
echo "Step 3: Check document count after upload"
echo "-----------------------------------------"
check_document_count
check_document_count "$CLIENT_NAME"

echo ""
echo "Step 4: Generate embeddings for uploaded documents"
echo "---------------------------------------------------"
echo -e "${YELLOW}Running embedding generation script...${NC}"

python3 scripts/generate_embeddings_for_new_docs.py --client "$CLIENT_NAME"

echo ""
echo "Step 5: Test search with semantic query"
echo "----------------------------------------"
echo -e "${YELLOW}Testing semantic search...${NC}"

# Test semantic search
SEARCH_QUERY="construction materials"
echo "Searching for: '$SEARCH_QUERY'"

SEARCH_RESULT=$(curl -s -X POST \
    "https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/search?api-version=2021-04-30-Preview" \
    -H "api-key: $SEARCH_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"search\": \"$SEARCH_QUERY\",
        \"filter\": \"client eq '$CLIENT_NAME'\",
        \"queryType\": \"semantic\",
        \"semanticConfiguration\": \"default\",
        \"count\": true,
        \"top\": 5
    }")

RESULT_COUNT=$(echo "$SEARCH_RESULT" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('@odata.count', 0))")

if [ "$RESULT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Semantic search returned $RESULT_COUNT results${NC}"
    echo ""
    echo "Top result:"
    echo "$SEARCH_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'value' in data and len(data['value']) > 0:
    doc = data['value'][0]
    print(f\"  - File: {doc.get('fileName', 'Unknown')}`)
    print(f\"  - Score: {doc.get('@search.score', 'N/A')}`)
    print(f\"  - Client: {doc.get('client', 'Unknown')}`)
"
else
    echo -e "${RED}✗ No search results found${NC}"
fi

echo ""
echo "========================================="
echo "Test Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "- Documents were uploaded to client: $CLIENT_NAME"
echo "- Embeddings were generated: Check output above"
echo "- Semantic search is working: $( [ "$RESULT_COUNT" -gt 0 ] && echo "Yes" || echo "No" )"
echo ""
echo "To manually check the Azure Function logs:"
echo "az webapp log tail --name SAXTech-DocProcessor --resource-group SAXTech-AI"
