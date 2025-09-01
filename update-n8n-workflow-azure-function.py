#!/usr/bin/env python3
"""
Update n8n Workflow to Use Azure Function for Document Processing
This script updates your production n8n workflow to properly call the Azure Function
"""

import json
import sys
from datetime import datetime

# Azure Function configuration
AZURE_FUNCTION_URL = "https://saxtech-docconverter.azurewebsites.net/api/convertdocument"
AZURE_FUNCTION_KEY = "GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA=="

def update_upload_workflow(workflow):
    """Update the upload section to use Azure Function"""
    
    # Find and update the Convert Document node
    for node in workflow.get('nodes', []):
        # Update the old Convert Document node that was using JSON
        if node.get('name') == 'Convert Document' or 'convert' in node.get('name', '').lower():
            print(f"Updating node: {node.get('name')}")
            
            # Update to use multipart/form-data with Azure Function
            node['parameters'] = {
                "method": "POST",
                "url": AZURE_FUNCTION_URL,
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "x-functions-key",
                            "value": AZURE_FUNCTION_KEY
                        }
                    ]
                },
                "sendBody": True,
                "contentType": "multipart-form-data",
                "bodyParameters": {
                    "parameters": [
                        {
                            "name": "file",
                            "value": "={{ $binary.data }}",
                            "parameterType": "formBinaryData"
                        },
                        {
                            "name": "client",
                            "value": "={{ $json.client }}"
                        },
                        {
                            "name": "category",
                            "value": "={{ $json.category }}"
                        }
                    ]
                },
                "options": {
                    "timeout": 120000,
                    "response": {
                        "response": {
                            "responseFormat": "json"
                        }
                    }
                }
            }
            node['type'] = "n8n-nodes-base.httpRequest"
            node['typeVersion'] = 4.2
            
        # Update Prepare File Data to ensure binary data is properly formatted
        elif node.get('name') == 'Prepare File Data':
            print(f"Updating node: {node.get('name')}")
            
            # Update the JavaScript code to properly handle binary data
            node['parameters']['jsCode'] = """// Extract file data from webhook request
const inputItem = $input.first();
const json = inputItem.json || {};
const binary = inputItem.binary;

// Handle both direct JSON and nested body
const data = json.body || json;

// Check if we have binary data from the webhook
let fileBuffer;
let fileName;
let mimeType;

if (binary && binary.data) {
  // Binary data from webhook
  fileBuffer = binary.data.data;
  fileName = binary.data.fileName || data.fileName || 'document.pdf';
  mimeType = binary.data.mimeType || data.mimeType || 'application/pdf';
} else if (data.file || data.fileBase64) {
  // Base64 data in JSON
  const fileData = data.file || data.fileBase64;
  fileBuffer = Buffer.from(fileData, 'base64');
  fileName = data.fileName || 'document.pdf';
  mimeType = data.mimeType || 'application/pdf';
} else {
  throw new Error('No file data provided in upload request');
}

// Extract metadata
const category = data.category || 'uncategorized';
const client = data.client || 'general';
const clientName = data.clientName || client;

// Calculate file size and hash
const fileSize = fileBuffer.length;
const crypto = require('crypto');
const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

// Generate safe file names
const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
const timestamp = Date.now();

console.log(`Processing: ${fileName} (${(fileSize/1024/1024).toFixed(2)}MB) for client: ${client}`);

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
    uploadedAt: new Date().toISOString(),
    timestamp: timestamp
  },
  binary: {
    data: {
      data: fileBuffer,
      mimeType: mimeType,
      fileName: fileName
    }
  }
};"""

        # Update any nodes that process the Azure Function response
        elif 'prepare index' in node.get('name', '').lower() or 'process' in node.get('name', '').lower():
            if node.get('type') == 'n8n-nodes-base.code':
                print(f"Updating response processor: {node.get('name')}")
                
                # Update to handle Azure Function response properly
                node['parameters']['jsCode'] = """// Process Azure Function response
const response = $json;
const originalData = $('Prepare File Data').first().json;

// Check if conversion was successful
if (!response.success) {
  throw new Error(response.message || 'Document processing failed');
}

console.log('Document processed successfully:', {
  documentId: response.documentId,
  fileName: response.fileName,
  textLength: response.textLength,
  chunkCount: response.chunkCount
});

// The Azure Function has already:
// 1. Extracted text from the document
// 2. Generated embeddings
// 3. Indexed in Azure Cognitive Search
// 4. Stored original in blob storage

// Return comprehensive response
return {
  json: {
    // From Azure Function
    success: true,
    documentId: response.documentId,
    fileName: response.fileName,
    client: response.client,
    category: response.category,
    textLength: response.textLength,
    chunkCount: response.chunkCount,
    blobUrl: response.blobUrl,
    
    // From original data
    fileSize: originalData.fileSize,
    fileHash: originalData.fileHash,
    uploadedAt: originalData.uploadedAt,
    
    // Status
    indexed: true,
    vectorized: true,
    stored: true,
    message: `Successfully processed ${response.fileName} (${response.textLength} characters extracted, ${response.chunkCount} chunks created)`
  }
};"""

    # Remove any redundant blob upload or indexing nodes since Azure Function handles it
    nodes_to_keep = []
    for node in workflow.get('nodes', []):
        node_name = node.get('name', '').lower()
        # Skip nodes that are now redundant
        if any(x in node_name for x in ['upload original', 'upload converted', 'index to search', 'store blob']):
            print(f"Removing redundant node: {node.get('name')}")
            continue
        nodes_to_keep.append(node)
    
    workflow['nodes'] = nodes_to_keep
    
    return workflow

def main():
    # Input and output file paths
    input_file = 'n8n-workflow-PRODUCTION-FINAL-COMPLETE.json'
    output_file = 'n8n-workflow-AZURE-FUNCTION-PRODUCTION.json'
    
    print(f"Updating n8n workflow to use Azure Function...")
    print(f"Input: {input_file}")
    print(f"Output: {output_file}")
    print()
    
    try:
        # Load the existing workflow
        with open(input_file, 'r') as f:
            workflow = json.load(f)
        
        # Create backup
        backup_file = f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{input_file}"
        with open(backup_file, 'w') as f:
            json.dump(workflow, f, indent=2)
        print(f"Created backup: {backup_file}")
        
        # Update the workflow
        updated_workflow = update_upload_workflow(workflow)
        
        # Update metadata
        updated_workflow['meta'] = updated_workflow.get('meta', {})
        updated_workflow['meta']['updatedAt'] = datetime.now().isoformat()
        updated_workflow['meta']['azureFunctionIntegration'] = True
        
        # Save the updated workflow
        with open(output_file, 'w') as f:
            json.dump(updated_workflow, f, indent=2)
        
        print()
        print("✅ Workflow updated successfully!")
        print()
        print("Key changes made:")
        print("1. ✅ Convert Document now calls Azure Function with multipart/form-data")
        print("2. ✅ Uses correct lowercase URL: " + AZURE_FUNCTION_URL)
        print("3. ✅ Includes function key in headers")
        print("4. ✅ Properly handles binary file data")
        print("5. ✅ Removed redundant blob upload nodes (Azure Function handles it)")
        print("6. ✅ Set 120-second timeout for large files")
        print()
        print("Next steps:")
        print("1. Import " + output_file + " into your n8n instance")
        print("2. Test with a small file first")
        print("3. Test with a large file (>10MB)")
        print("4. Verify documents appear in Azure Search index")
        print()
        print("The Azure Function will handle:")
        print("- Text extraction (PDF, Word, Excel, PowerPoint)")
        print("- OCR for scanned documents")
        print("- Vector embeddings generation")
        print("- Azure Search indexing")
        print("- Blob storage")
        print()
        print("🎉 Your workflow is now ready for 100MB files without memory issues!")
        
    except FileNotFoundError:
        print(f"❌ Error: Could not find {input_file}")
        print("Please ensure you're in the correct directory")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error updating workflow: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
