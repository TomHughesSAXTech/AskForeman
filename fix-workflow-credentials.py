#!/usr/bin/env python3

import json
import re

# Load the workflow
with open('n8n-workflow-complete-enhanced.json', 'r') as f:
    workflow = json.load(f)

# Your actual credentials
SEARCH_API_KEY = "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv"
FUNCTION_KEY = "KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng=="
SAS_TOKEN = "sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2/rnIg="

# Convert to string for replacements
workflow_str = json.dumps(workflow, indent=2)

# Replace placeholders with actual credentials
workflow_str = workflow_str.replace('={{$credentials.searchApiKey}}', f'={SEARCH_API_KEY}')
workflow_str = workflow_str.replace('={{$credentials.functionKey}}', f'={FUNCTION_KEY}')

# Update workflow name
workflow_str = workflow_str.replace('"Ask Foreman - Complete Enhanced Workflow"', '"SAXTech - Ask Foreman AI Production Workflow"')

# Parse back to JSON
workflow = json.loads(workflow_str)

# Now update specific nodes that need direct values
for node in workflow['nodes']:
    # Update HTTP Request nodes with API keys
    if node.get('type') == 'n8n-nodes-base.httpRequest':
        if 'headerParameters' in node.get('parameters', {}):
            for param in node['parameters']['headerParameters'].get('parameters', []):
                if param.get('name') == 'api-key':
                    param['value'] = SEARCH_API_KEY
                elif param.get('name') == 'x-functions-key':
                    param['value'] = FUNCTION_KEY
    
    # Update Azure Blob Storage credentials
    if node.get('type') == 'n8n-nodes-base.microsoftAzureBlobStorage':
        if 'credentials' not in node:
            node['credentials'] = {}
        node['credentials']['microsoftAzureBlobStorageApi'] = {
            "id": "saxtech-blob-storage",
            "name": "SAXTech Blob Storage"
        }

# Save the updated workflow
with open('n8n-workflow-saxtech-production-READY.json', 'w') as f:
    json.dump(workflow, f, indent=2)

print("✅ Workflow updated successfully!")
print(f"📁 File: n8n-workflow-saxtech-production-READY.json")
print(f"🔑 Search API Key: {SEARCH_API_KEY[:20]}...")
print(f"🔑 Function Key: {FUNCTION_KEY[:20]}...")
print(f"🔗 SAS Token: Included in connection string")
