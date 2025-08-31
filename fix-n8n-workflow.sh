#!/bin/bash

# n8n API Configuration
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNGM1ZDRmMy0wODlkLTQ3MDQtOWMxNy01MDY3Njc4ZjIxYzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU2MTcyNjAwfQ.hB9qJWoV-aFJCcYR791HALl9iBiP8lgdDM8lmG--3sI"
WORKFLOW_ID="nC5gkystSoLrrKkN"
API_URL="https://workflows.saxtechnology.com/api/v1"

echo "Fetching current workflow..."
WORKFLOW=$(curl -s -X GET "$API_URL/workflows/$WORKFLOW_ID" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Accept: application/json")

# Create a temporary Python script to update the workflow
cat > /tmp/update_workflow.py << 'EOF'
import json
import sys

# Read the workflow from stdin
workflow = json.loads(sys.stdin.read())

# Find and update the Pass Through Data node
for node in workflow['nodes']:
    if node.get('name') == 'Pass Through Data':
        print(f"Found Pass Through Data node, updating...")
        node['parameters']['jsCode'] = '''// Pass through data safely with access to previous nodes
const currentData = $json || {};
const inputItems = $input?.all() || [];
const inputData = inputItems.length > 0 ? inputItems[0].json : {};

// Try to get data from Prepare File Data node
let prepareFileData = {};
try {
  // Access the Prepare File Data node output
  const prepareFileNode = $('Prepare File Data').item;
  if (prepareFileNode && prepareFileNode.json) {
    prepareFileData = prepareFileNode.json;
  }
} catch (e) {
  console.log('Could not access Prepare File Data node directly');
}

// Merge data from all sources
const mergedData = {
  ...prepareFileData,  // Start with Prepare File Data
  ...inputData,        // Add input data
  ...currentData       // Add current data
};

// Ensure critical fields are set with multiple fallbacks
const output = {
  ...mergedData,
  // Critical fields for conversion
  client: mergedData.client || mergedData.clientName || prepareFileData.client || 'unknown',
  clientName: mergedData.client || mergedData.clientName || prepareFileData.clientName || 'unknown',
  fileName: mergedData.fileName || prepareFileData.fileName || 'unknown',
  uniqueFileName: mergedData.uniqueFileName || mergedData.fileName || prepareFileData.uniqueFileName || 'unknown',
  category: mergedData.category || prepareFileData.category || 'documents',
  categoryFolder: mergedData.categoryFolder || mergedData.category || prepareFileData.categoryFolder || 'documents',
  // CRITICAL: Ensure blob URLs are present
  originalBlobUrl: mergedData.originalBlobUrl || mergedData.uploadUrl || prepareFileData.originalBlobUrl || prepareFileData.uploadUrl,
  convertedBlobUrl: mergedData.convertedBlobUrl || mergedData.convertedUrl || prepareFileData.convertedBlobUrl || prepareFileData.convertedUrl,
  mimeType: mergedData.mimeType || prepareFileData.mimeType || 'application/octet-stream',
  // Preserve other important fields
  originalFilePath: mergedData.originalFilePath || prepareFileData.originalFilePath,
  convertedFilePath: mergedData.convertedFilePath || prepareFileData.convertedFilePath,
  uploadedAt: mergedData.uploadedAt || prepareFileData.uploadedAt || new Date().toISOString()
};

console.log('Pass Through Data output:', {
  client: output.client,
  fileName: output.fileName,
  hasOriginalBlobUrl: !!output.originalBlobUrl,
  originalBlobUrlStart: output.originalBlobUrl ? output.originalBlobUrl.substring(0, 50) : 'missing'
});

return output;'''
        break

# Also update the Convert Document node to have better error handling
for node in workflow['nodes']:
    if node.get('name') == 'Convert Document':
        print(f"Found Convert Document node, updating JSON body...")
        # Update the JSON body to reference data correctly
        node['parameters']['jsonBody'] = '''={
  "BlobUrl": "{{ $('Prepare File Data').item.json.originalBlobUrl || $('Prepare File Data').item.json.uploadUrl || $json.originalBlobUrl }}",
  "FileName": "{{ $('Prepare File Data').item.json.uniqueFileName || $('Prepare File Data').item.json.fileName || $json.fileName }}",
  "MimeType": "{{ $('Prepare File Data').item.json.mimeType || $json.mimeType }}",
  "client": "{{ $('Prepare File Data').item.json.client || $('Prepare File Data').item.json.clientName || $json.client }}",
  "category": "{{ $('Prepare File Data').item.json.categoryFolder || $('Prepare File Data').item.json.category || $json.category }}"
}'''
        break

# Output the updated workflow
print(json.dumps(workflow, indent=2))
EOF

# Update the workflow
echo "Updating workflow nodes..."
UPDATED_WORKFLOW=$(echo "$WORKFLOW" | python3 /tmp/update_workflow.py)

# Save the updated workflow
echo "$UPDATED_WORKFLOW" > /tmp/updated_workflow.json

# Send the update to n8n
echo "Sending update to n8n..."
curl -X PUT "$API_URL/workflows/$WORKFLOW_ID" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "@/tmp/updated_workflow.json" \
  -o /tmp/update_response.json \
  -w "\nHTTP Status: %{http_code}\n"

# Check response
if [ $? -eq 0 ]; then
    echo "Workflow updated successfully!"
    echo "Response saved to /tmp/update_response.json"
else
    echo "Failed to update workflow"
    cat /tmp/update_response.json
fi

# Clean up
rm -f /tmp/update_workflow.py /tmp/updated_workflow.json
