# n8n Indexing Fix - Stop "unknown" Values in Search Index

## The Problem
Files are being indexed with:
- `fileName: "unknown-file"`
- `client: "unknown-client-[timestamp]"`
- `category: "documents"`

This happens because the indexing nodes aren't receiving the proper data from earlier nodes.

## Quick Fix - Copy & Paste Instructions

### Step 1: Fix "Prepare Search Index1" Node

1. Find the "Prepare Search Index1" node in your workflow
2. Double-click to edit it
3. Replace ALL the code with this:

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

// Create Azure Search document with CORRECT data
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
  searchableContent: convertedContent,
  metadata: {
    client: client,
    category: category,
    fileName: fileName,
    indexed: true
  }
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

4. Save the node

### Step 2: Fix "Index Document" Node

1. Find the "Index Document" node
2. Make sure it's using the payload from Prepare Search Index1
3. The JSON Body should be:

```
={{ $json.indexPayload }}
```

Or if that doesn't work:

```
={{ $node['Prepare Search Index1'].json.indexPayload }}
```

### Step 3: Add Validation Node (Optional but Recommended)

Add a new Code node right BEFORE "Prepare Search Index1" to validate data:

```javascript
// Data Validation - Ensure we have proper client and file info
const currentData = $json || {};

// Get all available data
const prepareFileData = $('Prepare File Data').all()[0]?.json || {};
const passThroughData = $('Pass Through Data').all()[0]?.json || {};

// Extract critical fields with validation
const client = prepareFileData.client || 
               passThroughData.client || 
               currentData.client || 
               null;

const fileName = prepareFileData.fileName || 
                 passThroughData.fileName || 
                 currentData.fileName || 
                 null;

// Validate
if (!client || client === 'unknown' || client.includes('unknown-client')) {
  console.error('ERROR: Client is missing or unknown');
  console.error('Available data sources:');
  console.error('- prepareFileData.client:', prepareFileData.client);
  console.error('- passThroughData.client:', passThroughData.client);
  console.error('- currentData.client:', currentData.client);
  throw new Error('Client information is missing. Upload failed.');
}

if (!fileName || fileName === 'unknown-file') {
  console.error('ERROR: FileName is missing or unknown');
  throw new Error('File name information is missing. Upload failed.');
}

console.log('Validation passed:', {
  client: client,
  fileName: fileName
});

// Pass through all data with validated fields
return {
  ...currentData,
  client: client,
  clientName: client,
  fileName: fileName,
  validationPassed: true
};
```

### Step 4: Fix "Prepare Response" Node

This node also needs to get the correct data:

```javascript
// Prepare success response with correct client/file info
const uploadData = $('Prepare File Data').all()[0]?.json || {};
const indexData = $('Prepare Search Index1').all()[0]?.json || {};
const currentData = $json || {};

// Get the ACTUAL client and file names (not the unknown values)
const client = uploadData.client || indexData.client || currentData.client || 'unknown';
const fileName = uploadData.fileName || indexData.fileName || currentData.fileName || 'unknown';
const documentId = indexData.documentId || currentData.documentId || 'unknown';
const category = uploadData.category || indexData.category || currentData.category || 'documents';

// Build success response
const response = {
  status: "success",
  operation: "UPLOAD_FILE",
  client: {
    name: client,
    id: client
  },
  file: {
    name: fileName,
    originalName: fileName,
    size: uploadData.fileSize || 0,
    mimeType: uploadData.mimeType || 'application/octet-stream'
  },
  paths: {
    original: uploadData.originalFilePath || '',
    converted: uploadData.convertedFilePath || '',
    category: category
  },
  indexing: {
    documentId: documentId,
    indexed: true,
    client: client,
    fileName: fileName
  },
  message: `File "${fileName}" uploaded successfully to ${client}/${category} and indexed`,
  timestamp: new Date().toISOString()
};

console.log('Response prepared with correct data:', {
  client: client,
  fileName: fileName,
  documentId: documentId
});

return response;
```

## Testing

After applying these fixes:

1. Upload a test file
2. Check the execution logs - you should see:
   - "Validation passed: {client: 'ActualClientName', fileName: 'ActualFileName'}"
   - "Preparing search index with: {client: 'ActualClientName', fileName: 'ActualFileName'}"
3. Check the search index - documents should have proper client and fileName values

## Root Cause

The issue is that nodes later in the workflow can't access data from earlier nodes using `$node['nodeName']` syntax if the data has been transformed through multiple nodes. The fix explicitly retrieves data from the source nodes that have the correct information.

## Key Changes

1. **Direct node access**: Uses `$('Prepare File Data').all()` to get data directly from source nodes
2. **Multiple fallbacks**: Checks multiple nodes for the data
3. **Validation**: Adds checks to catch "unknown" values before indexing
4. **Proper document ID**: Creates meaningful IDs instead of timestamps
