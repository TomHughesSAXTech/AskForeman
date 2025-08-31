# Fix for Ask Foreman Index Issues

## Problem Identified
Documents in the Azure Search index have `null` values for the `client` field, which prevents:
1. Client deletion from removing documents from the index
2. Proper client-based searching and filtering

## Immediate Fix: Clean Up Existing Bad Index Entries

Run this script to remove all documents with null client values:

```bash
# Clean up orphaned documents with null client values
curl -X POST "https://workflows.saxtechnology.com/webhook/ask-foreman/index/search" \
  -H "Content-Type: application/json" \
  -d '{
    "search": "*",
    "top": 1000,
    "select": "id",
    "filter": "client eq null or client eq '\'''\''",
    "count": true
  }' | python3 -c "
import sys, json
data = json.load(sys.stdin)
docs = data.get('value', [])
if docs:
    print(f'Found {len(docs)} documents with null/empty client')
    doc_ids = [d['id'] for d in docs]
    # Now delete them
    import subprocess
    result = subprocess.run([
        'curl', '-X', 'POST',
        'https://workflows.saxtechnology.com/webhook/ask-foreman/index/delete',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps({'documentIds': doc_ids})
    ], capture_output=True, text=True)
    print('Deletion result:', result.stdout)
else:
    print('No orphaned documents found')
"
```

## Long-term Fix: Update n8n Workflow

### Manual Steps in n8n UI:

1. **Login to n8n** at https://workflows.saxtechnology.com
2. **Open the workflow** "SAXTech Foreman AI" (ID: nC5gkystSoLrrKkN)
3. **Find the node** "Prepare Search Index1" (it should be at position [2096, 816])
4. **Double-click** to open the node editor
5. **Replace the entire JavaScript code** with the fixed version below:

```javascript
// Prepare Search Index1 - Properly handle categories and file paths
const uploadData = $json;
console.log('=== PREPARE SEARCH INDEX ===');
console.log('Upload data keys:', Object.keys(uploadData));
console.log('Client from uploadData:', uploadData.client || uploadData.clientName);

// Get the actual converted content
const conversionNode = $node["Process Conversion"]?.json || 
                      $node["Upload JSONL"]?.json || 
                      $node["Upload Converted JSONL"]?.json || {};
const convertedContent = conversionNode.jsonlContent || conversionNode.convertedContent || '';

// Skip indexing if this is the original file
if (uploadData.originalFilePath && !uploadData.convertedFilePath) {
  console.log('Skipping original file indexing');
  return []; // Don't index original files
}

// Extract client and category from file path first
let clientValue = null;
let category = null;

if (uploadData.originalFilePath) {
  const pathParts = uploadData.originalFilePath.split('/');
  console.log('Path parts:', pathParts);
  
  if (pathParts[0] === 'FCS-OriginalClients' && pathParts.length >= 3) {
    clientValue = pathParts[1];
    category = pathParts[2];
    console.log('Extracted from path:', { client: clientValue, category });
  }
}

// Fallback to other sources if not found in path
if (!clientValue) {
  clientValue = uploadData.client || 
                uploadData.clientName || 
                conversionNode.client || 
                conversionNode.clientName ||
                $node["Prepare File Data"]?.json?.client ||
                $node["Prepare File Data"]?.json?.clientName ||
                $node["Prepare Metadata"]?.json?.client ||
                $node["Prepare Metadata"]?.json?.clientName ||
                'unknown-client';
}

if (!category) {
  category = uploadData.category || 
             uploadData.categoryFolder || 
             $node["Prepare File Data"]?.json?.category ||
             'documents';
}

// Clean up values - IMPORTANT: Never allow empty string for client
clientValue = (clientValue || '').replace(/^[_-]+/, '').trim();
if (!clientValue || clientValue === '' || clientValue === 'noclient') {
  clientValue = 'unknown-client';
}
category = category.replace(/^[_-]+/, '').trim();

console.log('Final client value:', clientValue);
console.log('Final category:', category);

// Get filename with proper checks
let fileName = uploadData.fileName || 
               uploadData.uniqueFileName || 
               uploadData.originalFileName ||
               $node["Prepare File Data"]?.json?.fileName ||
               'unknown_file';

// Remove timestamps but keep main filename
const fileNameForDisplay = fileName
  .replace(/_\d{13}/, '')
  .replace(/_\d{8}_\d{6}/, '')
  .replace(/\.(docx|pdf|xlsx|doc|xls|ppt|pptx|txt|csv|json|jsonl)$/i, '');

console.log('File processing:', {
  original: fileName,
  display: fileNameForDisplay,
  fromUploadData: uploadData.fileName,
  fromUniqueFileName: uploadData.uniqueFileName
});

// Generate document ID
const baseId = `${clientValue}_${category}_${fileNameForDisplay}`
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .replace(/^[_-]+/, '')
  .replace(/_{2,}/g, '_')
  .toLowerCase()
  .substring(0, 100);

// Create hash from full path
const pathString = `${clientValue}/${category}/${fileNameForDisplay}`;
let hash = 0;
for (let i = 0; i < pathString.length; i++) {
  const char = pathString.charCodeAt(i);
  hash = ((hash << 5) - hash) + char;
  hash = hash & hash;
}
const pathHash = Math.abs(hash).toString(36).substring(0, 8);

let documentId = `${baseId}_${pathHash}`;

console.log('Document ID components:', {
  clientValue,
  category,
  fileNameForDisplay,
  baseId,
  pathHash,
  documentId
});

// CRITICAL FIX: Ensure client is never null or empty string
const searchDocument = {
  "@search.action": "mergeOrUpload",
  "id": documentId,
  "client": clientValue,  // Always use the validated clientValue
  "category": category,
  "fileName": fileNameForDisplay + '.jsonl',
  "blobPath": uploadData.convertedFilePath || '',
  "content": convertedContent,
  "uploadedAt": uploadData.uploadedAt || new Date().toISOString(),
  "mimeType": 'application/jsonl',
  "convertedPath": uploadData.convertedFilePath || ''
};

// Add optional fields if available
if (uploadData.metadata) {
  searchDocument.metadata = typeof uploadData.metadata === 'string' 
    ? uploadData.metadata 
    : JSON.stringify(uploadData.metadata);
}

if (uploadData.contentVector || uploadData.embeddings) {
  searchDocument.contentVector = uploadData.contentVector || uploadData.embeddings;
}

// Remove empty fields but keep critical ones (especially client)
Object.keys(searchDocument).forEach(key => {
  if (key !== 'content' && 
      key !== '@search.action' && 
      key !== 'id' && 
      key !== 'fileName' &&
      key !== 'client' &&  // Never remove client
      key !== 'category') {
    if (searchDocument[key] === null || 
        searchDocument[key] === undefined || 
        searchDocument[key] === '') {
      delete searchDocument[key];
    }
  }
});

// Final validation - ensure client is set
if (!searchDocument.client || searchDocument.client === '') {
  console.error('WARNING: Client field is empty, setting to unknown-client');
  searchDocument.client = 'unknown-client';
}

console.log('Search document:', {
  id: searchDocument.id,
  client: searchDocument.client,
  category: searchDocument.category,
  fileName: searchDocument.fileName,
  contentLength: searchDocument.content?.length || 0
});

return [{
  json: {
    searchDocument: searchDocument,
    indexPayload: {
      "value": [searchDocument]
    },
    // Pass through critical data
    client: clientValue,
    clientName: clientValue,
    category: category,
    fileName: fileName,
    documentId: documentId,
    originalFilePath: uploadData.originalFilePath,
    convertedFilePath: uploadData.convertedFilePath
  }
}];
```

6. **Save the node** by clicking "Save" or the checkmark
7. **Save the workflow** 
8. **Test** by uploading a new document and verifying the client field is properly set

## Verification

After applying the fix:

1. **Check new uploads** have proper client values:
```bash
curl -X POST "https://workflows.saxtechnology.com/webhook/ask-foreman/index/search" \
  -H "Content-Type: application/json" \
  -d '{"search": "*", "top": 5, "select": "client,fileName", "count": true}' | python3 -m json.tool
```

2. **Test client deletion** now properly removes index entries:
```bash
# Delete a test client
curl -X POST "https://workflows.saxtechnology.com/webhook/ask-foreman/clients/delete" \
  -H "Content-Type: application/json" \
  -d '{"clientName": "test-client", "source": "admin-panel"}'
```

## Key Changes Made

1. **Never allow empty/null client values** - Always defaults to 'unknown-client' if no client is found
2. **Multiple fallback sources** for client name including:
   - uploadData.client
   - uploadData.clientName  
   - Path extraction from originalFilePath
   - Previous node data
3. **Final validation** to ensure client field is always set before indexing
4. **Pass through client data** to subsequent nodes for consistency

## Admin Panel Changes Already Applied

The admin panel (admin.html) has been updated to:
- Include both `client` and `clientName` fields in upload requests
- Remove unused 'documents' category option
- Use GET method for stats endpoint to avoid 500 errors
