# Fixed Prepare Search Index1 Node - No Metadata Object

Replace the entire code in the "Prepare Search Index1" node with this:

```javascript
// Prepare document for Azure Search indexing with proper data access
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

try {
  // Try to get metadata
  const metadataNodes = $('Prepare Metadata').all();
  if (metadataNodes && metadataNodes.length > 0) {
    metadataData = metadataNodes[0].json;
  }
} catch (e) {
  console.log('Could not access Prepare Metadata node');
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
               metadataData.client || 
               currentData.client || 
               currentData.clientName || 
               'unknown';

const fileName = uploadData.fileName || 
                 uploadData.uniqueFileName || 
                 metadataData.fileName || 
                 currentData.fileName || 
                 currentData.uniqueFileName || 
                 'unknown-file';

const category = uploadData.category || 
                 uploadData.categoryFolder || 
                 metadataData.category || 
                 currentData.category || 
                 'documents';

const blobPath = uploadData.originalFilePath || 
                 currentData.originalFilePath || 
                 metadataData.originalPath || 
                 '';

// Generate a proper document ID
const timestamp = Date.now();
const documentId = `${client}_${category}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;

// Create Azure Search document - NO NESTED OBJECTS, only flat fields
const searchDocument = {
  id: documentId,
  client: client,
  fileName: fileName,
  category: category,
  content: convertedContent,
  blobPath: blobPath,
  uploadedAt: new Date().toISOString(),
  mimeType: uploadData.mimeType || currentData.mimeType || 'application/octet-stream',
  fileSize: uploadData.fileSize || currentData.fileSize || 0,
  originalFileName: fileName,
  searchableContent: convertedContent
  // REMOVED metadata object - Azure Search doesn't support nested objects
};

// Validate critical fields
if (client === 'unknown' || client.includes('unknown-client')) {
  console.error('WARNING: Client is unknown - check data flow');
  console.log('Available uploadData:', Object.keys(uploadData));
  console.log('uploadData.client:', uploadData.client);
  console.log('uploadData.clientName:', uploadData.clientName);
}

if (fileName === 'unknown-file') {
  console.error('WARNING: FileName is unknown - check data flow');
  console.log('uploadData.fileName:', uploadData.fileName);
  console.log('currentData.fileName:', currentData.fileName);
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

1. **Removed the `metadata` object** from the searchDocument - Azure Search only accepts flat fields
2. All the important metadata fields are now at the root level of the document
3. The document structure matches what Azure Search expects

## After Applying This Fix:

1. Copy the code above
2. Go to your "Prepare Search Index1" node
3. Replace ALL the code with the fixed version
4. Save and test with a new upload

The document will be indexed with:
- Proper client name
- Proper file name
- No nested metadata object
- All fields at the root level

This should resolve the "unexpected 'StartObject' node" error!
