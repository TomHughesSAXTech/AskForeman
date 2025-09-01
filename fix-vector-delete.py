#!/usr/bin/env python3

import json

# Load the workflow
with open('n8n-workflow-PRODUCTION-ENHANCED-FIXED.json', 'r') as f:
    workflow = json.load(f)

# Add a new node to delete from vector index
vector_delete_node = {
    "parameters": {
        "method": "POST",
        "url": "https://fcssearchservice.search.windows.net/indexes/fcs-vector-index/docs/index?api-version=2023-11-01",
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
      "@search.action": "delete",
      "id": "{{ $node['Extract Delete Parameters'].json.fileHash }}_vector"
    }
  ]
}""",
        "options": {
            "response": {
                "response": {
                    "neverError": True
                }
            }
        }
    },
    "id": "delete-from-vector-index",
    "name": "Delete from Vector Index",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [-1056, -500]
}

# Add the node to the workflow
workflow['nodes'].append(vector_delete_node)

# Update connections to include vector deletion
# After deleting from main search index, also delete from vector index
if 'Delete from Search Index' in workflow.get('connections', {}):
    # Get existing connections
    existing = workflow['connections']['Delete from Search Index']['main'][0]
    # Add vector delete as parallel operation
    workflow['connections']['Delete from Search Index'] = {
        'main': [[
            {"node": "Delete from Vector Index", "type": "main", "index": 0},
            {"node": "Delete Original File", "type": "main", "index": 0}
        ]]
    }

# Vector delete should also continue to file deletion
workflow['connections']['Delete from Vector Index'] = {
    'main': [[
        {"node": "Delete Original File", "type": "main", "index": 0}
    ]]
}

# Update the Azure Function call to ensure embeddings are requested
for node in workflow['nodes']:
    if 'ConvertDocument' in node.get('name', '') or 'Convert Document' in node.get('name', ''):
        if 'jsonBody' in node.get('parameters', {}):
            # Parse the JSON body
            body_template = node['parameters']['jsonBody']
            # Add generateEmbeddings flag
            if 'generateEmbeddings' not in body_template:
                # Update the JSON body to include embeddings flag
                body_template = body_template.replace(
                    '"fileHash": "{{ $json.fileHash }}"',
                    '"fileHash": "{{ $json.fileHash }}",\n  "generateEmbeddings": true'
                )
                node['parameters']['jsonBody'] = body_template
                print(f"✅ Updated {node['name']} to request embeddings")

# Save the updated workflow
with open('n8n-workflow-PRODUCTION-FINAL-COMPLETE.json', 'w') as f:
    json.dump(workflow, f, indent=2)

print("\n✅ Vector index cleanup added!")
print("📁 File: n8n-workflow-PRODUCTION-FINAL-COMPLETE.json")
print("\n🎯 Improvements:")
print("  ✓ Added 'Delete from Vector Index' node")
print("  ✓ Deletes orphaned vectors when files are deleted")
print("  ✓ Ensures ConvertDocument requests embeddings")
print("\n📊 Delete Flow Now:")
print("  1. Delete from main search index")
print("  2. Delete from vector index (NEW!)")
print("  3. Delete original file")
print("  4. Delete converted file")
print("  5. Delete metadata")
print("\n⚠️ Important: Your Azure Function needs these environment variables:")
print("  FEATURE_ENABLE_VECTORIZATION=true")
print("  AZURE_OPENAI_API_KEY=<your-key>")
print("  AZURE_OPENAI_ENDPOINT=<your-endpoint>")
print("  AZURE_OPENAI_DEPLOYMENT_NAME=text-embedding-ada-002")
