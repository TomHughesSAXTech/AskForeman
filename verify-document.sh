#!/bin/bash

echo "=========================================="
echo "📄 Document Verification Tool"
echo "=========================================="
echo ""

# Function to check a specific document
check_document() {
    local filename="$1"
    local client="$2"
    
    echo "Searching for: $filename (Client: $client)"
    echo ""
    
    # Search via chat
    RESPONSE=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
      -H "Content-Type: application/json" \
      -d "{
        \"message\": \"Find document $filename for client $client\",
        \"client\": \"$client\"
      }" --max-time 10)
    
    if echo "$RESPONSE" | grep -qi "$filename"; then
        echo "✅ Document found in system!"
    else
        echo "⚠️ Document not found or still indexing"
    fi
    
    # Check in Azure Storage
    STORAGE_URL="https://saxtechfcs.blob.core.windows.net/fcs-clients/FCS-OriginalClients/$client"
    echo ""
    echo "Checking Azure Storage..."
    echo "URL: $STORAGE_URL/[category]/$filename"
}

# Menu
echo "What would you like to check?"
echo "1. Check a specific document"
echo "2. Upload and verify a test document"
echo "3. List all recent uploads"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        read -p "Enter filename: " filename
        read -p "Enter client name: " client
        check_document "$filename" "$client"
        ;;
    2)
        echo "Uploading test document..."
        TEST="Test document with embeddings at $(date)"
        BASE64=$(echo "$TEST" | base64 | tr -d '\n')
        
        curl -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
          -H "Content-Type: application/json" \
          -d "{
            \"file\": \"$BASE64\",
            \"fileName\": \"test-$(date +%s).txt\",
            \"clientName\": \"TestClient\",
            \"category\": \"test\"
          }" 2>/dev/null | python3 -m json.tool
        ;;
    3)
        echo "Recent uploads in test category:"
        curl -s "https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients" | \
        grep -oE "<Name>[^<]+test[^<]+</Name>" | \
        sed 's/<[^>]*>//g' | \
        tail -10
        ;;
esac

echo ""
echo "=========================================="
echo "To verify embeddings are working:"
echo "1. Open admin.html in your browser"
echo "2. Click 'View Index Contents'"
echo "3. Look at 'Vector Info' column"
echo "   - '1536D (Ada-002)' = Has embeddings ✅"
echo "   - 'None' = No embeddings ❌"
echo "=========================================="
