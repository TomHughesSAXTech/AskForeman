#!/usr/bin/env python3

import json

# Load the workflow
with open('n8n-workflow-FINAL-PRODUCTION.json', 'r') as f:
    workflow = json.load(f)

# Update workflow name
workflow['name'] = 'SAXTech Foreman AI - PRODUCTION'

# Update all webhook IDs to match the actual URLs being used in HTML files
webhook_mappings = {
    'ask-foreman-upload': 'ask-foreman/upload',
    'upload-files': 'ask-foreman/upload',
    'ask-foreman-chat': 'ask-foreman/chat',
    'ask-foreman-list-clients': 'ask-foreman/clients/list',
    'ask-foreman-create-client': 'ask-foreman/clients/create',
    'ask-foreman-delete': 'ask-foreman/files/delete',
    'delete-file': 'ask-foreman/files/delete',
    'search-documents': 'ask-foreman/search',
    'ask-foreman-search': 'ask-foreman/search'
}

# Fix webhook paths and add proper Azure credentials
for node in workflow.get('nodes', []):
    # Fix webhook nodes
    if node.get('type') == 'n8n-nodes-base.webhook':
        webhook_id = node.get('webhookId', '')
        
        # Update the path based on the webhook ID
        if webhook_id in webhook_mappings:
            correct_path = webhook_mappings[webhook_id]
            node['parameters']['path'] = correct_path
            # Keep the webhookId but update it to match the path
            node['webhookId'] = correct_path.replace('/', '-')
    
    # Fix HTTP Request nodes to use proper URLs and credentials
    if node.get('type') == 'n8n-nodes-base.httpRequest':
        params = node.get('parameters', {})
        
        # Fix Azure Search URLs
        if 'url' in params:
            url = params['url']
            # Ensure search API key is properly set
            if 'fcssearchservice.search.windows.net' in url:
                if 'headerParameters' in params:
                    for header in params['headerParameters'].get('parameters', []):
                        if header.get('name') == 'api-key':
                            # Use the actual API key directly
                            header['value'] = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv'
                        elif header.get('name') == 'x-functions-key':
                            header['value'] = 'KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng=='
            
            # Fix Azure Function URLs
            if 'saxtech-docconverter' in url:
                # Ensure function key is in URL if not in headers
                if '?code=' in url and 'code=KRitpiKC4' not in url:
                    base_url = url.split('?')[0]
                    params['url'] = f"{base_url}?code=KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng=="
            
            # Fix blob storage URLs - ensure using saxtechfcs
            if 'blob.core.windows.net' in url:
                url = url.replace('fcsstorage.blob.core.windows.net', 'saxtechfcs.blob.core.windows.net')
                url = url.replace('scstoreprd.blob.core.windows.net', 'saxtechfcs.blob.core.windows.net')
                
                # Ensure SAS token is properly encoded
                if 'sp=racwdl' in url and 'sig=' in url:
                    # The SAS token is already in the URL, ensure it's properly formatted
                    if 'sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D' not in url:
                        # Replace any incorrect signature
                        import re
                        url = re.sub(r'sig=[^&]*', 'sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D', url)
                
                params['url'] = url

# Ensure all connections are preserved (they should already be in the original)
# The connections should already be correct in the source file

# Save the fixed workflow
with open('n8n-workflow-FINAL-PRODUCTION.json', 'w') as f:
    json.dump(workflow, f, indent=2)

print("✅ Workflow fixed successfully!")
print("📁 File: n8n-workflow-FINAL-PRODUCTION.json")
print("\nWebhook URLs configured for:")
print("  - Base: https://workflows.saxtechnology.com/webhook/")
print("  - Upload: ask-foreman/upload")
print("  - Delete: ask-foreman/files/delete")
print("  - Search: ask-foreman/search")
print("  - Chat: ask-foreman/chat")
print("  - Clients: ask-foreman/clients/*")
print("\nCredentials embedded:")
print("  - Azure Search API Key: UsSBLISH...") 
print("  - Azure Function Key: KRitpiKC4...")
print("  - Blob Storage: saxtechfcs.blob.core.windows.net")
print("\n⚠️  IMPORTANT: After importing, you need to:")
print("  1. Create 'Azure Blob Storage' credential in n8n")
print("  2. Use connection string:")
print("     BlobEndpoint=https://saxtechfcs.blob.core.windows.net/;")
print("     SharedAccessSignature=sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2/rnIg=")
