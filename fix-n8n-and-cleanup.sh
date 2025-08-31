#!/bin/bash

# Fix n8n Workflow and Clean Up Bad Index Entries
# This script will clean up orphaned documents and provide the fix for n8n

echo "========================================="
echo "Ask Foreman Index and Workflow Fix Script"
echo "========================================="
echo ""

# Step 1: Find all documents with null or empty client values
echo "Step 1: Finding documents with null/empty client values..."
echo ""

SEARCH_RESULT=$(curl -s -X POST "https://workflows.saxtechnology.com/webhook/ask-foreman/index/search" \
  -H "Content-Type: application/json" \
  -d '{
    "search": "*",
    "top": 1000,
    "select": "id,client,fileName",
    "count": true
  }')

# Parse the results using Python
python3 << 'PYTHON_SCRIPT'
import json
import subprocess
import sys

search_result = '''$SEARCH_RESULT'''
try:
    data = json.loads(search_result)
except:
    print("Error parsing search results")
    sys.exit(1)

# Find documents with null or empty client
docs_to_delete = []
for doc in data.get('value', []):
    client = doc.get('client')
    if client is None or client == '' or client == 'null':
        docs_to_delete.append(doc.get('id'))
        print(f"  - Found orphaned doc: {doc.get('fileName', 'Unknown')} (client: {client})")

if not docs_to_delete:
    print("✅ No orphaned documents found! Index is clean.")
else:
    print(f"\n⚠️  Found {len(docs_to_delete)} orphaned documents to clean up")
    print("\nStep 2: Deleting orphaned documents...")
    
    # Delete in batches of 50
    batch_size = 50
    for i in range(0, len(docs_to_delete), batch_size):
        batch = docs_to_delete[i:i+batch_size]
        print(f"  Deleting batch {i//batch_size + 1} ({len(batch)} documents)...")
        
        delete_payload = json.dumps({"documentIds": batch})
        result = subprocess.run([
            'curl', '-s', '-X', 'POST',
            'https://workflows.saxtechnology.com/webhook/ask-foreman/index/delete',
            '-H', 'Content-Type: application/json',
            '-d', delete_payload
        ], capture_output=True, text=True)
        
        try:
            delete_response = json.loads(result.stdout)
            if delete_response.get('success'):
                print(f"    ✅ Batch deleted successfully")
            else:
                print(f"    ⚠️  Batch deletion may have failed: {delete_response}")
        except:
            print(f"    ❌ Error deleting batch: {result.stdout}")

    print(f"\n✅ Cleanup complete! Removed {len(docs_to_delete)} orphaned documents")

PYTHON_SCRIPT

echo ""
echo "========================================="
echo "n8n Workflow Fix Instructions"
echo "========================================="
echo ""
echo "Since the n8n API doesn't support direct workflow updates, you need to:"
echo ""
echo "1. Login to n8n at: https://workflows.saxtechnology.com"
echo "2. Open workflow: 'SAXTech Foreman AI'"
echo "3. Find node: 'Prepare Search Index1' (position [2096, 816])"
echo "4. Double-click to edit"
echo "5. Copy the fixed code from: fix-index-issues.md"
echo "6. Save the node and workflow"
echo ""
echo "The key fix ensures the client field is NEVER null or empty by:"
echo "  - Multiple fallback sources for client name"
echo "  - Defaulting to 'unknown-client' if no client found"
echo "  - Final validation before indexing"
echo ""
echo "========================================="
echo "Verification"
echo "========================================="
echo ""
echo "After fixing the n8n workflow, test with:"
echo ""
echo "1. Upload a new document and verify client field is set:"
echo "   curl -X POST 'https://workflows.saxtechnology.com/webhook/ask-foreman/index/search' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"search\": \"*\", \"top\": 5, \"select\": \"client,fileName\", \"count\": true}'"
echo ""
echo "2. Test client deletion:"
echo "   curl -X POST 'https://workflows.saxtechnology.com/webhook/ask-foreman/clients/delete' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"clientName\": \"test-client\", \"source\": \"admin-panel\"}'"
echo ""
echo "========================================="
echo "Complete!"
echo "========================================="
