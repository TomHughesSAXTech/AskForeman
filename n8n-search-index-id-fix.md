# Final Fix - Prepare Search Index1 Node with Safe Document IDs

Replace the entire code in the "Prepare Search Index1" node with this:

```javascript
// Prepare document for Azure Search indexing - WITH SAFE DOCUMENT IDs
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

// Function to create Azure Search safe document ID
function createSafeDocumentId(client, category, fileName, timestamp) {
  // Remove file extension
  const fileNameNoExt = fileName.replace(/\.[^/.]+$/, '');
  
  // Create base ID from components
  const baseId = `${client}_${category}_${fileNameNoExt}_${timestamp}`;
  
  // Azure Search allows: letters, digits, underscore (_), dash (-), equal (=)
  // Replace spaces and other characters with dashes
  const safeId = baseId
    .replace(/\s+/g, '-')           // Replace spaces with dashes
    .replace(/[^a-zA-Z0-9_\-=]/g, '') // Remove any other invalid characters
    .replace(/--+/g, '-')           // Replace multiple dashes with single dash
    .replace(/^-|-$/g, '');         // Remove leading/trailing dashes
  
  return safeId;
}

// Generate a safe document ID
const timestamp = Date.now();
const documentId = createSafeDocumentId(client, category, fileName, timestamp);

// Create Azure Search document with ONLY the fields that exist in the index
const searchDocument = {
  id: documentId,
  client: client,
  fileName: fileName,
  category: category,
  content: convertedContent,
  blobPath: blobPath,
  uploadedAt: new Date().toISOString()
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

1. **Added `createSafeDocumentId` function** that:
   - Replaces spaces with dashes
   - Removes any characters that Azure Search doesn't allow
   - Ensures the ID only contains: letters, digits, underscore (_), dash (-), or equal (=)

2. **Example transformations**:
   - `DEF Construction` → `DEF-Construction`
   - `file.name.pdf` → `filename`
   - `My File (2).pdf` → `My-File-2`

## After Applying This Fix:

1. Copy the code above
2. Go to your "Prepare Search Index1" node
3. Replace ALL the code with this version
4. Save and test

The document IDs will now be safe for Azure Search. For example:
- Before: `DEF Construction_specs_Metals_pdf_1756617413659` (with space issue)
- After: `DEF-Construction_specs_Metals_pdf_1756617413659` (safe for Azure)

This should resolve the "Invalid document key" error!
