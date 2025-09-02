#!/bin/bash

echo "================================================"
echo "📚 Document Re-indexing Tool"
echo "================================================"
echo ""
echo "This will help you re-index existing documents to add embeddings"
echo ""

# Function to reindex a specific client's documents
reindex_client() {
    local client="$1"
    local category="$2"
    
    echo "Re-indexing $client documents in $category..."
    
    # This would need to:
    # 1. List all documents for the client
    # 2. Download each document
    # 3. Re-upload to trigger new embedding generation
    
    echo "Please use admin.html to:"
    echo "1. Filter by client: $client"
    echo "2. Select documents without vectors"
    echo "3. Click 'Re-index Selected'"
}

echo "Options:"
echo "1. Re-index ALL documents without embeddings"
echo "2. Re-index specific client's documents"
echo "3. Test semantic search quality"
echo ""
read -p "Choose option (1-3): " choice

case $choice in
    1)
        echo ""
        echo "To re-index ALL documents:"
        echo "1. Open admin.html"
        echo "2. Click 'View Index Contents'"
        echo "3. Look for documents where Vector Info = 'None'"
        echo "4. Select those documents"
        echo "5. Use the re-index option"
        echo ""
        echo "Or re-upload the original files to generate new embeddings"
        ;;
    2)
        read -p "Enter client name: " client
        reindex_client "$client" "all"
        ;;
    3)
        echo ""
        echo "Testing semantic search quality..."
        echo ""
        
        # Test searches that should work with embeddings
        echo "Test 1: Searching for 'cooling' (should find HVAC documents)..."
        curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
          -H "Content-Type: application/json" \
          -d '{"message": "Find documents about cooling systems", "client": "general"}' \
          --max-time 10 | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('response', '')
if 'HVAC' in response or 'air conditioning' in response:
    print('✅ Semantic search working! Found HVAC documents when searching for cooling')
else:
    print('⚠️ May need more documents with embeddings')
" 2>/dev/null
        
        echo ""
        echo "Test 2: Searching for 'heating' (should find boiler/furnace documents)..."
        curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
          -H "Content-Type: application/json" \
          -d '{"message": "Find documents about heating systems", "client": "general"}' \
          --max-time 10 | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('response', '')
if 'boiler' in response.lower() or 'furnace' in response.lower() or 'HVAC' in response:
    print('✅ Semantic search working! Found heating documents')
else:
    print('⚠️ May need more documents with embeddings')
" 2>/dev/null
        ;;
esac

echo ""
echo "================================================"
echo "💡 Best Practices with Embeddings:"
echo "================================================"
echo ""
echo "1. Re-index important documents first"
echo "2. Test searches with synonyms"
echo "3. Monitor search quality improvement"
echo "4. Documents with embeddings will rank better"
echo ""
