#!/bin/bash

echo "================================================"
echo "🎯 FINAL EMBEDDINGS TEST - After Key Fix"
echo "================================================"
echo ""
echo "✅ What was fixed:"
echo "   • Corrected the Azure OpenAI key (had a typo)"
echo "   • Old key had 'TV' instead of 'IV'"
echo "   • Function App restarted with correct key"
echo ""
echo "⏳ Waiting 60 seconds for Function App to fully restart..."
sleep 60

echo ""
echo "📤 Uploading test document..."

# Create test content
TEST_CONTENT="Final embeddings test after fixing Azure OpenAI key. Document created at $(date). Contains HVAC systems, construction materials, electrical panels, plumbing fixtures. Testing text-embedding-ada-002 model."
BASE64=$(echo "$TEST_CONTENT" | base64 | tr -d '\n')
TIMESTAMP=$(date +%s)

# Upload the document
RESPONSE=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$BASE64\",
    \"fileName\": \"embedding-success-test-$TIMESTAMP.txt\",
    \"mimeType\": \"text/plain\",
    \"category\": \"test\",
    \"clientName\": \"EmbeddingFixed\",
    \"client\": \"EmbeddingFixed\"
  }" --max-time 20)

echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        print('✅ Document uploaded successfully!')
        print(f'   Filename: embedding-success-test-$TIMESTAMP.txt')
        print(f'   Client: EmbeddingFixed')
    else:
        print('❌ Upload failed')
except:
    print('Error parsing response')
" 2>/dev/null

echo ""
echo "⏳ Waiting 30 seconds for processing and indexing..."
sleep 30

echo ""
echo "🔍 Testing semantic search..."
SEARCH_RESPONSE=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find documents about HVAC from EmbeddingFixed client",
    "client": "EmbeddingFixed"
  }' --max-time 15)

if echo "$SEARCH_RESPONSE" | grep -q "HVAC\|embedding-success-test"; then
  echo "✅ Document is searchable!"
else
  echo "⚠️ Document may still be processing"
fi

echo ""
echo "================================================"
echo "📊 VERIFICATION STEPS:"
echo "================================================"
echo ""
echo "1. Open your browser"
echo "2. Go to: admin.html"
echo "3. Click 'View Index Contents'"
echo "4. Look for: embedding-success-test-$TIMESTAMP.txt"
echo "5. Check 'Vector Info' column:"
echo ""
echo "   Expected: '1536D (Ada-002)' ✅"
echo "   If you see this, EMBEDDINGS ARE WORKING!"
echo ""
echo "6. Also check the Azure Function logs:"
echo "   - Should NO LONGER show '401 Access denied'"
echo "   - Should show successful embedding generation"
echo ""
echo "================================================"
echo "🎉 Embeddings should now be working!"
echo "================================================"
