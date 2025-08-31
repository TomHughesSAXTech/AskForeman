# Final Fix - Prepare Search Index1 Node with Valid Fields Only

Replace the entire code in the "Prepare Search Index1" node with this:

```javascript
// Prepare document for Azure Search indexing - ONLY VALID FIELDS
const currentData = $json || {};

// Get data from earlier nodes with fallbacks
let uploadData = {};
let convertData = {};
let metadataData = {};

try {
  // Try to get data from Prepare File Data node (original upload data)
  const prepareFileNodes = $('Prepare File Data').all();
  if (prepareFileNodes && prepareFileNodes.length > 0) {
    uploadData = prepareFileNodes[0].json;
    console.log('Got upload data from Prepare File Data node');
  }
} catch (e) {
  console.log('Could not access Prepare File Data node');
}

try {
  // Try to get data from Pass Through Data node
  const passThroughNodes = $('Pass Through Data').all();
  if (passThroughNodes && passThroughNodes.length > 0) {
    const passData = passThroughNodes[0].json;
    if (!uploadData.client) uploadData = passData;
  }
} catch (e) {
  console.log('Could not access Pass Through Data node');
}

try {
  // Try to get data from Convert Document result
  const convertNodes = $('Convert Document').all();
  if (convertNodes && convertNodes.length > 0) {
    convertData = convertNodes[0].json;
  }
} catch (e) {
  console.log('Could not access Convert Document node');
}

// Get the converted content (JSONL)
const convertedContent = currentData.jsonlContent || 
                         currentData.convertedContent || 
                         convertData.convertedContent || 
                         convertData.content || 
                         '';

// Extract the actual client name and file name from the best sources
const client = uploadData.client || 
               uploadData.clientName || 
               currentData.client || 
               currentData.clientName || 
               'unknown';

const fileName = uploadData.fileName || 
                 uploadData.uniqueFileName || 
                 currentData.fileName || 
                 currentData.uniqueFileName || 
                 'unknown-file';

const category = uploadData.category || 
                 uploadData.categoryFolder || 
                 currentData.category || 
                 'documents';

const blobPath = uploadData.originalFilePath || 
                 currentData.originalFilePath || 
                 '';

// Generate a proper document ID
const timestamp = Date.now();
const documentId = `${client}_${category}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;

// Create Azure Search document with ONLY the fields that exist in the index
// Based on the existing index schema: id, client, fileName, category, content, blobPath, uploadedAt
const searchDocument = {
  id: documentId,
  client: client,
  fileName: fileName,
  category: category,
  content: convertedContent,
  blobPath: blobPath,
  uploadedAt: new Date().toISOString()
  // REMOVED: fileSize, mimeType, originalFileName, searchableContent - these don't exist in the index
};

// Validate critical fields
if (client === 'unknown' || client.includes('unknown-client')) {
  console.error('WARNING: Client is unknown - check data flow');
  console.log('Available uploadData:', Object.keys(uploadData));
  console.log('uploadData.client:', uploadData.client);
  console.log('uploadData.clientName:', uploadData.clientName);
  // Don't fail, but log the warning
}

if (fileName === 'unknown-file') {
  console.error('WARNING: FileName is unknown - check data flow');
  console.log('uploadData.fileName:', uploadData.fileName);
  console.log('currentData.fileName:', currentData.fileName);
  // Don't fail, but log the warning
}

console.log('Preparing search index with:', {
  id: documentId,
  client: client,
  fileName: fileName,
  category: category,
  hasContent: !!convertedContent,
  contentLength: convertedContent.length
});

// Prepare the Azure Search payload
const indexPayload = {
  value: [{
    "@search.action": "mergeOrUpload",
    ...searchDocument
  }]
};

return {
  ...currentData,
  searchDocument: searchDocument,
  indexPayload: JSON.stringify(indexPayload),
  documentId: documentId,
  client: client,
  fileName: fileName,
  category: category
};
```

## What Changed:

1. **Removed non-existent fields**: `fileSize`, `mimeType`, `originalFileName`, `searchableContent`
2. **Only includes fields that exist in your Azure Search index**:
   - `id` - Document identifier
   - `client` - Client name
   - `fileName` - File name
   - `category` - Document category
   - `content` - The searchable content
   - `blobPath` - Path to the blob
   - `uploadedAt` - Upload timestamp

## Your Azure Search Index Schema

Based on the errors, your index only has these fields:
- id (string)
- client (string)
- fileName (string)
- category (string)
- content (string)
- blobPath (string)
- uploadedAt (datetime)

## After Applying This Fix:

1. Copy the code above
2. Go to your "Prepare Search Index1" node
3. Replace ALL the code with this version
4. Save and test

This should finally work without any Azure Search errors!
