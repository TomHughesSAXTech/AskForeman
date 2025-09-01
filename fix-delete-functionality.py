#!/usr/bin/env python3

import json

# Load the workflow
with open('n8n-workflow-PRODUCTION-ENHANCED.json', 'r') as f:
    workflow = json.load(f)

# Find and fix the Extract Delete Parameters node
for node in workflow['nodes']:
    if node.get('name') == 'Extract Delete Parameters':
        # Replace with proper delete extraction code
        node['parameters']['jsCode'] = """// Extract delete parameters from webhook request
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;

console.log('Delete request received:', JSON.stringify(data, null, 2));

// Extract file information
const filePath = data.filePath || '';
const fileName = data.fileName || filePath.split('/').pop() || '';
const clientName = data.clientName || data.client || '';
const category = data.category || 'documents';

// Handle different path formats
let originalPath = filePath;
let convertedPath = '';
let metadataPath = '';

// If filePath starts with FCS-OriginalClients, it's already the full path
if (filePath.startsWith('FCS-OriginalClients/')) {
    originalPath = filePath;
    // Generate converted path from original
    convertedPath = filePath
        .replace('FCS-OriginalClients', 'FCS-ConvertedClients')
        .replace(/\\.pdf$/i, '.jsonl')
        .replace(/\\.docx?$/i, '.jsonl')
        .replace(/\\.txt$/i, '.jsonl');
    metadataPath = filePath
        .replace('FCS-OriginalClients', 'FCS-Metadata')
        .replace(/\\.[^/.]+$/, '.json');
} else if (filePath.includes('/')) {
    // It's a relative path, construct full paths
    originalPath = `FCS-OriginalClients/${filePath}`;
    convertedPath = `FCS-ConvertedClients/${filePath.replace(/\\.[^/.]+$/, '.jsonl')}`;
    metadataPath = `FCS-Metadata/${filePath.replace(/\\.[^/.]+$/, '.json')}`;
} else {
    // Just filename, construct paths with client and category
    originalPath = `FCS-OriginalClients/${clientName}/${category}/${fileName}`;
    convertedPath = `FCS-ConvertedClients/${clientName}/${category}/${fileName.replace(/\\.[^/.]+$/, '.jsonl')}`;
    metadataPath = `FCS-Metadata/${clientName}/${category}/${fileName.replace(/\\.[^/.]+$/, '.json')}`;
}

console.log('Delete paths:', {
    original: originalPath,
    converted: convertedPath,
    metadata: metadataPath
});

// Prepare search index deletion payload
const searchFilter = fileName && clientName 
    ? `fileName eq '${fileName}' and client eq '${clientName}'`
    : `blobPath eq '${originalPath}'`;

const deletePayload = {
    value: [
        {
            "@search.action": "delete",
            "fileName": fileName,
            "client": clientName,
            "blobPath": originalPath
        }
    ]
};

return {
    json: {
        // File info
        fileName: fileName,
        clientName: clientName,
        category: category,
        filePath: filePath,
        
        // Paths for deletion
        originalPath: originalPath,
        convertedPath: convertedPath,
        metadataPath: metadataPath,
        
        // For search index deletion
        searchFilter: searchFilter,
        deletePayload: deletePayload,
        
        // Metadata
        source: data.source || 'unknown',
        timestamp: data.timestamp || new Date().toISOString(),
        
        // Control flags
        indexDeleteSkipped: false
    }
};"""
        print(f"✅ Fixed: {node['name']}")

# Also ensure the Delete File Webhook has correct path
for node in workflow['nodes']:
    if node.get('name') == 'Delete File Webhook':
        node['parameters']['path'] = 'ask-foreman/files/delete'
        node['webhookId'] = 'ask-foreman-files-delete'
        print(f"✅ Fixed webhook path: {node['name']}")

# Fix connections for proper delete flow
# Ensure Extract Delete Parameters connects properly
if 'Extract Delete Parameters' in workflow.get('connections', {}):
    workflow['connections']['Extract Delete Parameters'] = {
        'main': [[
            {"node": "Prepare Index Delete", "type": "main", "index": 0}
        ]]
    }

# Ensure Delete File Webhook connects to Extract Delete Parameters
if 'Delete File Webhook' in workflow.get('connections', {}):
    workflow['connections']['Delete File Webhook'] = {
        'main': [[
            {"node": "Extract Delete Parameters", "type": "main", "index": 0}
        ]]
    }

# Ensure the delete flow continues properly
if 'Prepare Index Delete' in workflow.get('connections', {}):
    workflow['connections']['Prepare Index Delete'] = {
        'main': [[
            {"node": "Should Delete from Index?", "type": "main", "index": 0}
        ]]
    }

# The Should Delete from Index should connect to actual deletion or skip
if 'Should Delete from Index?' in workflow.get('connections', {}):
    workflow['connections']['Should Delete from Index?'] = {
        'main': [
            [{"node": "Delete from Search Index", "type": "main", "index": 0}],  # True - delete from index
            [{"node": "Delete Original File", "type": "main", "index": 0}]  # False - skip index, just delete files
        ]
    }

# Ensure all delete operations converge at Consolidate Delete Results
if 'Delete from Search Index' in workflow.get('connections', {}):
    workflow['connections']['Delete from Search Index'] = {
        'main': [[
            {"node": "Delete Original File", "type": "main", "index": 0}
        ]]
    }

if 'Delete Original File' in workflow.get('connections', {}):
    workflow['connections']['Delete Original File'] = {
        'main': [[
            {"node": "Delete Converted File", "type": "main", "index": 0}
        ]]
    }

if 'Delete Converted File' in workflow.get('connections', {}):
    workflow['connections']['Delete Converted File'] = {
        'main': [[
            {"node": "Delete Metadata File", "type": "main", "index": 0}
        ]]
    }

if 'Delete Metadata File' in workflow.get('connections', {}):
    workflow['connections']['Delete Metadata File'] = {
        'main': [[
            {"node": "Consolidate Delete Results", "type": "main", "index": 0}
        ]]
    }

if 'Consolidate Delete Results' in workflow.get('connections', {}):
    workflow['connections']['Consolidate Delete Results'] = {
        'main': [[
            {"node": "Delete Success Response", "type": "main", "index": 0}
        ]]
    }

# Save the fixed workflow
with open('n8n-workflow-PRODUCTION-ENHANCED-FIXED.json', 'w') as f:
    json.dump(workflow, f, indent=2)

print("\n✅ Delete functionality fixed!")
print("📁 File: n8n-workflow-PRODUCTION-ENHANCED-FIXED.json")
print("\n🔧 Fixes Applied:")
print("  ✓ Extract Delete Parameters - now properly extracts file paths")
print("  ✓ Delete webhook path - set to 'ask-foreman/files/delete'")
print("  ✓ Delete flow connections - properly connected")
print("  ✓ Search index cleanup - integrated with file deletion")
print("  ✓ Multiple path formats supported")
print("\n📝 Delete Flow:")
print("  1. Delete File Webhook receives request")
print("  2. Extract Delete Parameters (fixed)")
print("  3. Prepare Index Delete")
print("  4. Delete from Search Index")
print("  5. Delete Original File")
print("  6. Delete Converted File")  
print("  7. Delete Metadata File")
print("  8. Consolidate Results")
print("  9. Return Success Response")
