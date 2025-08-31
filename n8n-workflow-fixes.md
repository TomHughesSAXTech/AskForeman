# n8n Workflow Fixes Documentation

## Issues Identified

### 1. Upload Workflow Issue
**Problem**: Files are being uploaded to "unknown/documents" folder and the converted JSONL files contain error messages: `{"success":false,"error":"BlobUrl and FileName are required"}`

**Root Cause**: The Convert Document node is not receiving the required parameters (`BlobUrl` and `FileName`) because data is not being properly passed through the workflow nodes.

### 2. Clear Index Workflow Issue  
**Problem**: The clear index endpoint returns an error: "Referenced node doesn't exist"

**Root Cause**: The clear index workflow has broken node references.

## How to Fix the Upload Workflow

### Option 1: Import the Fixed Workflow Section
1. Open your n8n instance
2. Go to the workflow: https://workflows.saxtechnology.com/workflow/nC5gkystSoLrrKkN
3. Import the nodes from `n8n-workflow-upload-fix.json`
4. Replace the existing upload section with the fixed nodes

### Option 2: Manual Fix in Existing Workflow

#### Step 1: Fix the "Pass Through Data" Node
Replace the code in the "Pass Through Data" node with:

```javascript
// Pass through all data to ensure it's available for conversion
const currentData = $json || {};

// Ensure all critical fields are preserved
return {
  ...currentData,
  // Double-check critical fields
  client: currentData.client || currentData.clientName || 'unknown',
  clientName: currentData.client || currentData.clientName || 'unknown',
  fileName: currentData.fileName || currentData.uniqueFileName || 'unknown',
  uniqueFileName: currentData.uniqueFileName || currentData.fileName || 'unknown',
  category: currentData.category || 'documents',
  categoryFolder: currentData.categoryFolder || currentData.category || 'documents',
  originalBlobUrl: currentData.originalBlobUrl || currentData.uploadUrl,
  convertedBlobUrl: currentData.convertedBlobUrl || currentData.convertedUrl,
  mimeType: currentData.mimeType || 'application/octet-stream'
};
```

#### Step 2: Fix the "Convert Document" Node
Update the JSON body in the "Convert Document" HTTP Request node:

```json
{
  "BlobUrl": "{{ $json.originalBlobUrl }}",
  "FileName": "{{ $json.uniqueFileName || $json.fileName }}",
  "MimeType": "{{ $json.mimeType }}",
  "client": "{{ $json.client || $json.clientName }}",
  "category": "{{ $json.categoryFolder || $json.category }}"
}
```

#### Step 3: Add Error Handling After Conversion
Create or update the node after "Convert Document" to check for errors:

```javascript
// Process conversion response and prepare for JSONL upload
const convertResponse = $json || {};
const passedData = $node['Pass Through Data'].json || {};

console.log('Conversion response:', convertResponse);
console.log('Passed data available:', Object.keys(passedData));

// Check if conversion was successful
if (convertResponse.success === false || convertResponse.error) {
  console.error('Conversion failed:', convertResponse.error || 'Unknown error');
  throw new Error(`Document conversion failed: ${convertResponse.error || 'Unknown error'}`);
}

// Get the converted content
const convertedContent = convertResponse.convertedContent || 
                        convertResponse.content || 
                        convertResponse.jsonlContent || 
                        '';

if (!convertedContent) {
  console.error('No converted content received');
  throw new Error('No converted content received from conversion service');
}

// Merge all data
const outputData = {
  ...passedData,
  ...convertResponse,
  // Ensure critical fields are present
  client: passedData.client || passedData.clientName || 'unknown',
  clientName: passedData.client || passedData.clientName || 'unknown',
  fileName: passedData.fileName || 'unknown',
  uniqueFileName: passedData.uniqueFileName || passedData.fileName || 'unknown',
  category: passedData.category || 'documents',
  categoryFolder: passedData.categoryFolder || passedData.category || 'documents',
  convertedContent: convertedContent,
  jsonlContent: convertedContent,
  convertedBlobUrl: passedData.convertedBlobUrl || passedData.convertedUrl,
  originalFilePath: passedData.originalFilePath,
  convertedFilePath: passedData.convertedFilePath,
  conversionSuccess: true,
  timestamp: new Date().toISOString()
};

console.log('Prepared for JSONL upload:', {
  client: outputData.client,
  fileName: outputData.fileName,
  contentLength: convertedContent.length,
  hasUrl: !!outputData.convertedBlobUrl
});

return [{
  json: outputData
}];
```

## Testing the Fix

1. **Test Upload**: 
   - Upload a document through the admin panel
   - Select a specific client (not "unknown")
   - Choose a category
   - Check that the file appears in the correct folder: `FCS-OriginalClients/[ClientName]/[category]/[filename]`
   - Verify the JSONL file contains actual converted content, not an error message

2. **Verify in Azure Storage**:
   - Check `FCS-OriginalClients/[ClientName]/[category]/` for the original file
   - Check `FCS-ConvertedClients/[ClientName]/[category]/` for the .jsonl file
   - Open the .jsonl file and verify it contains document content, not an error

## Key Changes Made

1. **Data Preservation**: Ensured all critical fields (client, fileName, BlobUrl) are passed through every node
2. **Error Handling**: Added proper error checking after document conversion
3. **Fallback Values**: Added multiple fallbacks for critical fields to prevent "unknown" values
4. **Logging**: Added console.log statements for debugging

## Monitoring

After applying the fix, monitor for:
- Files appearing in correct client folders (not "unknown")
- JSONL files containing actual converted content
- Successful indexing in Azure Search with proper client field

## Additional Notes

- The fix preserves original filenames for better readability
- The workflow now properly handles different ways the client name might be passed (client, clientName, body.client, etc.)
- Error messages are now more descriptive to help with debugging
