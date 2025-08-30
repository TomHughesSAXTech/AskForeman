#!/bin/bash

# Script to clear Azure Search index completely
# This will delete ALL documents from the index

echo "========================================="
echo "Azure Search Index Clear Tool"
echo "========================================="
echo ""

# Configuration
SEARCH_SERVICE="fcssearchservice"
INDEX_NAME="fcs-construction-docs-index-v2"
API_KEY="UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv"
API_VERSION="2023-11-01"

echo "⚠️  WARNING: This will DELETE ALL documents from the index!"
echo "Index: $INDEX_NAME"
echo "Service: $SEARCH_SERVICE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Method 1: Deleting all documents from index..."
echo "================================================"

# First, get all document IDs
echo "Fetching all document IDs..."
SEARCH_URL="https://${SEARCH_SERVICE}.search.windows.net/indexes/${INDEX_NAME}/docs/search?api-version=${API_VERSION}"

# Search for all documents and get their IDs
ALL_DOCS=$(curl -s -X POST "$SEARCH_URL" \
  -H "Content-Type: application/json" \
  -H "api-key: $API_KEY" \
  -d '{
    "search": "*",
    "select": "id",
    "top": 1000
  }')

# Extract document count
DOC_COUNT=$(echo "$ALL_DOCS" | grep -o '"@odata.count":[0-9]*' | cut -d':' -f2)
echo "Found $DOC_COUNT documents in the index"

if [ "$DOC_COUNT" -gt 0 ]; then
    # Extract all IDs and create delete operations
    echo "Creating delete operations..."
    
    # Create a JSON array of delete operations
    DELETE_JSON='{"value": ['
    
    # Parse IDs from the response
    IDS=$(echo "$ALL_DOCS" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    FIRST=true
    for ID in $IDS; do
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            DELETE_JSON+=','
        fi
        DELETE_JSON+='{"@search.action":"delete","id":"'$ID'"}'
    done
    
    DELETE_JSON+=']}'
    
    # Execute the delete operation
    echo "Deleting documents..."
    DELETE_URL="https://${SEARCH_SERVICE}.search.windows.net/indexes/${INDEX_NAME}/docs/index?api-version=${API_VERSION}"
    
    RESPONSE=$(curl -s -X POST "$DELETE_URL" \
      -H "Content-Type: application/json" \
      -H "api-key: $API_KEY" \
      -d "$DELETE_JSON")
    
    echo "Delete operation completed."
    echo "Response: $RESPONSE"
else
    echo "No documents to delete."
fi

echo ""
echo "================================================"
echo "Method 2: Reset via Indexer (if configured)"
echo "================================================"

# Try to reset and run the indexer
INDEXER_NAME="fcs-construction-docs-indexer-v2"

echo "Attempting to reset indexer: $INDEXER_NAME"
RESET_URL="https://${SEARCH_SERVICE}.search.windows.net/indexers/${INDEXER_NAME}/reset?api-version=${API_VERSION}"

RESET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$RESET_URL" \
  -H "api-key: $API_KEY")

if [ "$RESET_RESPONSE" = "204" ]; then
    echo "✅ Indexer reset successful"
    
    # Run the indexer
    echo "Running indexer to rebuild from source..."
    RUN_URL="https://${SEARCH_SERVICE}.search.windows.net/indexers/${INDEXER_NAME}/run?api-version=${API_VERSION}"
    
    RUN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$RUN_URL" \
      -H "api-key: $API_KEY")
    
    if [ "$RUN_RESPONSE" = "202" ]; then
        echo "✅ Indexer started successfully"
    else
        echo "⚠️  Indexer run returned status: $RUN_RESPONSE"
    fi
else
    echo "⚠️  Indexer reset returned status: $RESET_RESPONSE (indexer may not exist)"
fi

echo ""
echo "================================================"
echo "Verification"
echo "================================================"

# Wait a moment for changes to propagate
sleep 2

# Check document count
echo "Checking remaining document count..."
CHECK_URL="https://${SEARCH_SERVICE}.search.windows.net/indexes/${INDEX_NAME}/docs/\$count?api-version=${API_VERSION}"

COUNT=$(curl -s -X GET "$CHECK_URL" \
  -H "api-key: $API_KEY")

echo "Documents remaining in index: $COUNT"

echo ""
echo "✅ Index clear operation completed!"
echo ""
echo "Next steps:"
echo "1. Upload new documents through your application"
echo "2. Or run your n8n workflow to re-index documents"
echo "3. Verify documents are indexed correctly"
