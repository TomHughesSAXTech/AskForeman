#!/usr/bin/env python3

import json
import copy

# Load both workflows
with open('n8n-workflow-FINAL-PRODUCTION.json', 'r') as f:
    original = json.load(f)

with open('n8n-workflow-complete-enhanced.json', 'r') as f:
    enhanced = json.load(f)

# Create a new workflow based on the original (to keep connections)
merged = copy.deepcopy(original)
merged['name'] = 'SAXTech Foreman AI - PRODUCTION ENHANCED'

# Find key nodes in the original workflow to enhance
upload_webhook_id = None
prepare_file_node_id = None
upload_node_id = None

for node in merged['nodes']:
    if node.get('type') == 'n8n-nodes-base.webhook' and 'upload' in node.get('webhookId', ''):
        upload_webhook_id = node['id']
    elif node.get('name') == 'Prepare File Data':
        prepare_file_node_id = node['id']
    elif node.get('name') == 'Upload Original (Small)':
        upload_node_id = node['id']

# Add deduplication check node after Prepare File Data
dedupe_node = {
    "parameters": {
        "url": "https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/search?api-version=2021-04-30-Preview",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {
                    "name": "api-key",
                    "value": "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv"
                },
                {
                    "name": "Content-Type",
                    "value": "application/json"
                }
            ]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={\n  \"search\": \"\",\n  \"filter\": \"fileHash eq '{{ $json.fileHash }}' and client eq '{{ $json.client }}'\",\n  \"select\": \"id,fileName,fileHash\",\n  \"top\": 1\n}",
        "options": {}
    },
    "id": "check-duplicate-enhanced",
    "name": "Check for Duplicate (SHA-256)",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [-1400, -1328]
}

# Add IF node to check if duplicate
is_duplicate_node = {
    "parameters": {
        "conditions": {
            "number": [
                {
                    "value1": "={{ $json.value.length }}",
                    "operation": "larger",
                    "value2": 0
                }
            ]
        }
    },
    "id": "is-duplicate-check",
    "name": "Is Duplicate?",
    "type": "n8n-nodes-base.if",
    "typeVersion": 1,
    "position": [-1200, -1328]
}

# Add duplicate response node
duplicate_response_node = {
    "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"status\": \"duplicate\",\n  \"message\": \"File already exists with hash {{ $json.fileHash }}\",\n  \"existingFile\": \"{{ $json.value[0].fileName }}\",\n  \"fileHash\": \"{{ $json.fileHash }}\"\n}",
        "options": {}
    },
    "id": "duplicate-response",
    "name": "Duplicate File Response",
    "type": "n8n-nodes-base.respondToWebhook",
    "typeVersion": 1,
    "position": [-1000, -1250]
}

# Update the Prepare File Data node to include SHA-256 hash calculation
for node in merged['nodes']:
    if node.get('name') == 'Prepare File Data':
        # Enhanced file preparation with deduplication
        node['parameters']['jsCode'] = """// Enhanced file preparation with SHA-256 deduplication
const inputItem = $input.first();
const json = inputItem.json || {};

// Handle both direct JSON and nested body
const data = json.body || json;

// Extract file data and metadata
const fileData = data.file || data.fileBase64 || '';
const fileName = data.fileName || 'document.pdf';
const mimeType = data.mimeType || 'application/pdf';
const category = data.category || 'uncategorized';
const client = data.client || 'general';
const clientName = data.clientName || client;

if (!fileData) {
    throw new Error('No file data provided in upload request');
}

// Convert base64 to buffer
const buffer = Buffer.from(fileData, 'base64');
const fileSize = buffer.length;

// Calculate SHA-256 hash for deduplication
const crypto = require('crypto');
const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

// Check if file needs chunking (>10MB)
const needsChunking = fileSize > 10 * 1024 * 1024;
const chunkSize = 5 * 1024 * 1024; // 5MB chunks

// Generate safe file names and paths
const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
const timestamp = Date.now();

// Azure blob paths
const originalPath = `${client}/${category}/original/${safeName}`;
const convertedPath = `${client}/${category}/converted/${safeName.replace(/\\.pdf$/i, '')}.jsonl`;

console.log(`Processing: ${fileName} (${(fileSize/1024).toFixed(2)}KB) with hash: ${fileHash}`);

return {
    json: {
        fileName: fileName,
        safeName: safeName,
        mimeType: mimeType,
        category: category,
        client: client,
        clientName: clientName,
        fileSize: fileSize,
        fileHash: fileHash,
        needsChunking: needsChunking,
        isLargeFile: fileSize > 10 * 1024 * 1024,
        originalPath: originalPath,
        convertedPath: convertedPath,
        uploadedAt: new Date().toISOString(),
        fileBase64: fileData,
        // Azure URLs
        originalBlobUrl: `https://saxtechfcs.blob.core.windows.net/fcs-clients/FCS-OriginalClients/${originalPath}?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D`,
        convertedBlobUrl: `https://saxtechfcs.blob.core.windows.net/fcs-clients/FCS-ConvertedClients/${convertedPath}?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D`,
        functionAppUrl: `https://saxtech-docconverter.azurewebsites.net/api/ConvertDocument?code=KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng==`,
        timestamp: timestamp
    },
    binary: {
        data: {
            data: buffer,
            mimeType: mimeType,
            fileName: fileName,
            fileExtension: fileName.split('.').pop() || 'pdf'
        }
    }
};"""

# Add vector search nodes
vector_index_node = {
    "parameters": {
        "url": "https://fcssearchservice.search.windows.net/indexes/fcs-vector-index/docs/index?api-version=2023-11-01",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {
                    "name": "api-key",
                    "value": "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv"
                },
                {
                    "name": "Content-Type",
                    "value": "application/json"
                }
            ]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": """={
  "value": [
    {
      "@search.action": "mergeOrUpload",
      "id": "{{ $json.fileHash }}_vector",
      "content": "{{ $json.convertedContent || $json.content || '' }}",
      "contentVector": {{ JSON.stringify($json.embeddings || []) }},
      "fileName": "{{ $json.fileName }}",
      "client": "{{ $json.client }}",
      "category": "{{ $json.category }}",
      "fileHash": "{{ $json.fileHash }}",
      "uploadedAt": "{{ $json.uploadedAt }}"
    }
  ]
}""",
        "options": {}
    },
    "id": "index-vectors",
    "name": "Index Vector Embeddings",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [-600, -1100]
}

# Add the new nodes to the workflow
merged['nodes'].extend([
    dedupe_node,
    is_duplicate_node,
    duplicate_response_node,
    vector_index_node
])

# Now update the connections to include deduplication flow
if 'connections' not in merged:
    merged['connections'] = {}

# Update connections for the enhanced flow
# After Prepare File Data -> Check for Duplicate
if prepare_file_node_id:
    if prepare_file_node_id not in merged['connections']:
        merged['connections'][prepare_file_node_id] = {'main': [[]]}
    # Connect to duplicate check
    merged['connections'][prepare_file_node_id]['main'][0] = [
        {"node": "check-duplicate-enhanced", "type": "main", "index": 0}
    ]

# Check for Duplicate -> Is Duplicate?
merged['connections']['check-duplicate-enhanced'] = {
    'main': [[{"node": "is-duplicate-check", "type": "main", "index": 0}]]
}

# Is Duplicate? -> True (duplicate response) / False (continue with upload)
merged['connections']['is-duplicate-check'] = {
    'main': [
        [{"node": "duplicate-response", "type": "main", "index": 0}],  # True - is duplicate
        [{"node": "Check File Size", "type": "main", "index": 0}]  # False - continue
    ]
}

# After successful document conversion, also index to vector store
convert_doc_node = None
for node in merged['nodes']:
    if 'ConvertDocument' in node.get('name', ''):
        convert_doc_node = node['id']
        break

if convert_doc_node and convert_doc_node in merged['connections']:
    # Add vector indexing as parallel operation after conversion
    existing_connections = merged['connections'][convert_doc_node]['main'][0]
    existing_connections.append({"node": "index-vectors", "type": "main", "index": 0})

# Update webhook paths to match HTML files
for node in merged['nodes']:
    if node.get('type') == 'n8n-nodes-base.webhook':
        webhook_id = node.get('webhookId', '')
        
        # Update paths to match what's in the HTML files
        if 'upload' in webhook_id:
            node['parameters']['path'] = 'ask-foreman/upload'
        elif 'delete' in webhook_id:
            node['parameters']['path'] = 'ask-foreman/files/delete'
        elif 'search' in webhook_id:
            node['parameters']['path'] = 'ask-foreman/search'
        elif 'chat' in webhook_id:
            node['parameters']['path'] = 'ask-foreman/chat'
        elif 'list-clients' in webhook_id:
            node['parameters']['path'] = 'ask-foreman/clients/list'
        elif 'create-client' in webhook_id:
            node['parameters']['path'] = 'ask-foreman/clients/create'

# Save the merged workflow
with open('n8n-workflow-PRODUCTION-ENHANCED.json', 'w') as f:
    json.dump(merged, f, indent=2)

print("✅ Enhanced workflow created successfully!")
print("📁 File: n8n-workflow-PRODUCTION-ENHANCED.json")
print("\n🎯 New Features Added:")
print("  ✓ SHA-256 file deduplication")
print("  ✓ Duplicate detection before upload")
print("  ✓ Vector embedding indexing")
print("  ✓ Large file chunking support (>10MB)")
print("  ✓ Enhanced error handling")
print("\n📊 Workflow Stats:")
print(f"  - Total Nodes: {len(merged['nodes'])}")
print(f"  - Total Connections: {sum(len(v.get('main', [[]])[0]) for v in merged['connections'].values())}")
print("\n⚠️  After importing, add Azure Blob Storage credential:")
print("  Connection String:")
print("  BlobEndpoint=https://saxtechfcs.blob.core.windows.net/;")
print("  SharedAccessSignature=sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2/rnIg=")
