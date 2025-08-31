# n8n Node Fixes - Copy & Paste Instructions

## Quick Fix Instructions

Follow these steps in your n8n workflow editor:

### Step 1: Fix "Pass Through Data" Node

1. Open the workflow: https://workflows.saxtechnology.com/workflow/nC5gkystSoLrrKkN
2. Find the "Pass Through Data" node (it's between "Upload Original to Azure" and "Convert Document")
3. Double-click to edit it
4. Replace ALL the code with this:

```javascript
// Pass through data with access to Prepare File Data node
const currentData = $json || {};

// Get data from the Prepare File Data node (the source of truth)
let prepareFileData = {};
try {
  // Direct reference to Prepare File Data node
  const allNodes = $('Prepare File Data').all();
  if (allNodes && allNodes.length > 0) {
    prepareFileData = allNodes[0].json;
    console.log('Got data from Prepare File Data node');
  }
} catch (e) {
  console.log('Error accessing Prepare File Data:', e.message);
}

// If we couldn't get Prepare File Data, try to reconstruct from current data
if (!prepareFileData.originalBlobUrl) {
  console.log('WARNING: Could not get originalBlobUrl from Prepare File Data');
  // Try to reconstruct the URL if needed
  if (currentData.client && currentData.fileName) {
    const storageAccount = 'saxtechfcs';
    const container = 'fcs-clients';
    const sasToken = 'sp=racwdl&st=2025-08-07T21:44:55Z&se=2030-08-08T05:59:55Z&spr=https&sv=2024-11-04&sr=c&sig=AeQA3cyePZQqGGmb6QPu5G4y1b0qB8Z5FIFZBdi6Cdo%3D';
    const category = currentData.categoryFolder || currentData.category || 'documents';
    const originalFilePath = `FCS-OriginalClients/${currentData.client}/${category}/${currentData.fileName}`;
    prepareFileData.originalBlobUrl = `https://${storageAccount}.blob.core.windows.net/${container}/${originalFilePath}?${sasToken}`;
    console.log('Reconstructed originalBlobUrl:', prepareFileData.originalBlobUrl);
  }
}

// Merge all data sources
const output = {
  ...prepareFileData,  // Primary source
  ...currentData,      // Current node data
  // Ensure critical fields
  client: prepareFileData.client || currentData.client || 'unknown',
  clientName: prepareFileData.clientName || currentData.clientName || prepareFileData.client || currentData.client || 'unknown',
  fileName: prepareFileData.fileName || currentData.fileName || 'unknown',
  uniqueFileName: prepareFileData.uniqueFileName || prepareFileData.fileName || currentData.fileName || 'unknown',
  category: prepareFileData.category || currentData.category || 'documents',
  categoryFolder: prepareFileData.categoryFolder || currentData.categoryFolder || 'documents',
  originalBlobUrl: prepareFileData.originalBlobUrl || prepareFileData.uploadUrl || currentData.originalBlobUrl,
  convertedBlobUrl: prepareFileData.convertedBlobUrl || prepareFileData.convertedUrl || currentData.convertedBlobUrl,
  mimeType: prepareFileData.mimeType || currentData.mimeType || 'application/octet-stream',
  binaryFieldName: prepareFileData.binaryFieldName || currentData.binaryFieldName || 'data'
};

// Validate critical fields
if (!output.originalBlobUrl) {
  throw new Error('originalBlobUrl is missing - check Prepare File Data node');
}
if (!output.fileName && !output.uniqueFileName) {
  throw new Error('fileName is missing - check Prepare File Data node');
}

console.log('Pass Through Data output:', {
  client: output.client,
  fileName: output.fileName || output.uniqueFileName,
  hasOriginalBlobUrl: !!output.originalBlobUrl,
  blobUrlStart: output.originalBlobUrl ? output.originalBlobUrl.substring(0, 60) : 'MISSING'
});

return output;
```

5. Click "Execute Node" to test
6. Save the node

### Step 2: Fix "Prepare File Data" Node

1. Find the "Prepare File Data" node (it's right after the Upload Webhook)
2. Double-click to edit it
3. Make sure the code includes these critical lines (around line 80-95):

```javascript
// URLs and paths - CRITICAL: These must be present for conversion
uploadUrl: uploadUrl,
originalBlobUrl: uploadUrl,  // This is what Convert Document needs
convertedUrl: convertedUrl,
convertedBlobUrl: convertedUrl,
```

If these lines are missing, add them to the output object.

### Step 3: Alternative Fix for "Convert Document" Node

If the above doesn't work, try this simpler approach:

1. Find the "Convert Document" node
2. Change the JSON Body from expression mode to fixed JSON
3. Click on the JSON tab
4. Replace with this simpler version:

```json
{
  "BlobUrl": "{{ $node['Prepare File Data'].json.originalBlobUrl }}",
  "FileName": "{{ $node['Prepare File Data'].json.fileName }}",
  "MimeType": "{{ $node['Prepare File Data'].json.mimeType }}",
  "client": "{{ $node['Prepare File Data'].json.client }}",
  "category": "{{ $node['Prepare File Data'].json.categoryFolder }}"
}
```

### Step 4: Test the Workflow

1. Save all changes
2. Test by uploading a small file
3. Check the execution to see if the conversion succeeds
4. Look for these in the execution:
   - "Pass Through Data" node should show `hasOriginalBlobUrl: true`
   - "Convert Document" should receive all parameters
   - No "BlobUrl and FileName are required" errors

## If Still Not Working

Try this diagnostic code in a new Code node between "Pass Through Data" and "Convert Document":

```javascript
// Diagnostic node - shows what data is available
const current = $json;
const prepareFile = $('Prepare File Data').all()[0]?.json || {};
const passThrough = $('Pass Through Data').all()[0]?.json || {};

console.log('=== DATA DIAGNOSTIC ===');
console.log('Current $json has:', Object.keys(current));
console.log('Prepare File Data has:', Object.keys(prepareFile));
console.log('Pass Through has:', Object.keys(passThrough));

console.log('\n=== CRITICAL FIELDS ===');
console.log('originalBlobUrl from current:', current.originalBlobUrl ? 'YES' : 'NO');
console.log('originalBlobUrl from prepareFile:', prepareFile.originalBlobUrl ? 'YES' : 'NO');
console.log('originalBlobUrl from passThrough:', passThrough.originalBlobUrl ? 'YES' : 'NO');

console.log('\n=== VALUES ===');
console.log('Client:', current.client || prepareFile.client || 'MISSING');
console.log('FileName:', current.fileName || prepareFile.fileName || 'MISSING');
console.log('BlobUrl start:', (current.originalBlobUrl || prepareFile.originalBlobUrl || 'MISSING').substring(0, 60));

// Pass through the best data we have
return {
  ...prepareFile,
  ...passThrough,
  ...current,
  originalBlobUrl: current.originalBlobUrl || passThrough.originalBlobUrl || prepareFile.originalBlobUrl || prepareFile.uploadUrl,
  fileName: current.fileName || passThrough.fileName || prepareFile.fileName,
  client: current.client || passThrough.client || prepareFile.client
};
```

This will help identify where the data is being lost.
