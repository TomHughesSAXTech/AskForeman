# n8n Workflow Duplicate Detection Solution

## Overview
This solution adds duplicate file detection to your n8n workflow without interfering with the indexing process. It checks if files already exist in Azure Blob Storage before uploading.

## Step 1: Add "Check for Duplicates" Code Node
Add this Code node AFTER "Prepare File Data" but BEFORE any upload operations:

### Node Name: `Check for Duplicates`

```javascript
// Check if file already exists in Azure Blob Storage
// This node checks for existing files and prompts for action

const uploadData = $json;
const fileName = uploadData.fileName || '';
const client = uploadData.client || uploadData.clientName || '';
const category = uploadData.category || uploadData.categoryFolder || '';

// Extract base filename without timestamp
// Assumes timestamp format: _YYYYMMDD_HHMMSS or similar patterns
function getBaseFileName(filename) {
  // Remove timestamp patterns like _20240830_143022
  let baseName = filename.replace(/_\d{8}_\d{6}/g, '');
  // Remove timestamp patterns like _2024-08-30_14-30-22
  baseName = baseName.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/g, '');
  // Remove timestamp patterns like _1693412345678 (unix timestamp)
  baseName = baseName.replace(/_\d{13}/g, '');
  // Remove other common timestamp patterns
  baseName = baseName.replace(/_\d{10,}/g, ''); // Unix timestamps
  
  return baseName;
}

const baseFileName = getBaseFileName(fileName);

// Prepare check data
const checkData = {
  ...uploadData,
  baseFileName: baseFileName,
  originalFileName: fileName,
  shouldCheckDuplicate: true,
  duplicateCheckPath: `FCS-OriginalClients/${client}/${category}/${baseFileName}`,
  // Flag to determine if we should proceed with upload
  proceedWithUpload: true,
  duplicateExists: false,
  overwriteExisting: false
};

console.log('Checking for duplicate:', checkData.duplicateCheckPath);
console.log('Base filename:', baseFileName);
console.log('Original filename:', fileName);

return checkData;
```

## Step 2: Add "Check Blob Existence" HTTP Request Node
Add this HTTP Request node AFTER "Check for Duplicates":

### Node Name: `Check Blob Existence`

**Configuration:**
- **Method:** HEAD
- **URL:** 
```
https://saxtechfcs.blob.core.windows.net/saxtechclients/{{ $json.duplicateCheckPath }}{{ $json.sasToken || '?sp=racwdli&st=2024-09-27T16:06:47Z&se=2025-09-28T00:06:47Z&sv=2022-11-02&sr=c&sig=YOUR_SAS_SIGNATURE' }}
```
- **Ignore Response Code:** Enable (check the box)
- **Always Output Data:** Enable (check the box)

## Step 3: Add "Process Duplicate Check" Code Node
Add this Code node AFTER "Check Blob Existence":

### Node Name: `Process Duplicate Check`

```javascript
// Process the duplicate check result
const checkData = $json;
const httpResponse = $node["Check Blob Existence"].json;
const httpStatusCode = $node["Check Blob Existence"].responseCode;

// Check if file exists (status 200 means it exists)
const fileExists = httpStatusCode === 200;

// Prepare result with duplicate status
const result = {
  ...checkData,
  duplicateExists: fileExists,
  httpStatusCode: httpStatusCode,
  // Default behavior: overwrite if exists
  proceedWithUpload: true,
  overwriteExisting: fileExists,
  duplicateMessage: fileExists 
    ? `File already exists: ${checkData.baseFileName}. Will be overwritten.`
    : `New file: ${checkData.baseFileName}. Proceeding with upload.`,
  // Keep the timestamped filename for the actual upload
  fileName: checkData.originalFileName,
  // But store the base name for reference
  baseFileName: checkData.baseFileName
};

console.log('Duplicate check result:', {
  fileExists: fileExists,
  statusCode: httpStatusCode,
  message: result.duplicateMessage
});

// Optional: If you want to skip duplicates instead of overwriting
// Uncomment the following lines:
/*
if (fileExists) {
  result.proceedWithUpload = false;
  result.duplicateMessage = `Skipping duplicate file: ${checkData.baseFileName}`;
}
*/

return result;
```

## Step 4: Add "Route Based on Duplicate" IF Node
Add an IF node AFTER "Process Duplicate Check":

### Node Name: `Route Based on Duplicate`

**Conditions:**
- **Value 1:** `{{ $json.proceedWithUpload }}`
- **Operation:** Equal
- **Value 2:** `true`

**True Branch:** → Continue to "Upload Original File" 
**False Branch:** → Skip to next item or end workflow

## Step 5: Optional - Add "Log Duplicate Action" Code Node
Add this optional logging node on both branches:

### Node Name: `Log Duplicate Action`

```javascript
// Log the action taken for duplicate handling
const action = $json;

const logEntry = {
  timestamp: new Date().toISOString(),
  fileName: action.baseFileName,
  originalFileName: action.originalFileName,
  client: action.client,
  category: action.category,
  duplicateFound: action.duplicateExists,
  action: action.proceedWithUpload ? 
    (action.overwriteExisting ? 'OVERWRITE' : 'UPLOAD_NEW') : 
    'SKIPPED',
  message: action.duplicateMessage
};

console.log('Duplicate handling log:', logEntry);

// Pass through all data plus log
return {
  ...action,
  duplicateLog: logEntry
};
```

## Step 6: Modify "Prepare File Data" Node
Update your existing "Prepare File Data" node to support duplicate checking:

```javascript
// Your existing code...
const uploadData = $json;

// Add SAS token for duplicate checking
const sasToken = '?sp=racwdli&st=2024-09-27T16:06:47Z&se=2025-09-28T00:06:47Z&sv=2022-11-02&sr=c&sig=YOUR_SAS_SIGNATURE';

// Keep your existing timestamp logic but also store base name
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const originalFileName = uploadData.fileName || 'file';

// Extract extension
const lastDot = originalFileName.lastIndexOf('.');
const extension = lastDot > -1 ? originalFileName.slice(lastDot) : '';
const nameWithoutExt = lastDot > -1 ? originalFileName.slice(0, lastDot) : originalFileName;

// Create timestamped filename (your existing logic)
const uniqueFileName = `${nameWithoutExt}_${timestamp}${extension}`;

// Also store the base filename for duplicate checking
const baseFileName = originalFileName;

return {
  ...uploadData,
  fileName: uniqueFileName,  // Timestamped for upload
  baseFileName: baseFileName,  // Original for duplicate check
  originalFileName: originalFileName,  // Store original
  sasToken: sasToken,
  // ... rest of your existing fields
};
```

## Workflow Integration Diagram

```
[Trigger/File Input]
        ↓
[Prepare File Data] (Modified to include baseFileName)
        ↓
[Check for Duplicates] (New Code node)
        ↓
[Check Blob Existence] (New HTTP Request node)
        ↓
[Process Duplicate Check] (New Code node)
        ↓
[Route Based on Duplicate] (New IF node)
     ↙     ↘
[Proceed]  [Skip]
    ↓
[Upload Original File] (Your existing upload)
    ↓
[Upload Converted JSONL] (Your existing upload)
    ↓
[Prepare Search Index1] (Your existing indexing)
    ↓
[Index Document] (Your existing indexing)
```

## Configuration Options

### Option 1: Always Overwrite (Default)
Files with the same base name will be overwritten with the new timestamped version.

### Option 2: Skip Duplicates
Uncomment the skip logic in "Process Duplicate Check" node to skip files that already exist.

### Option 3: Prompt User (Advanced)
For manual workflows, you could add a Wait node to prompt for user input when duplicates are found.

## Benefits of This Approach

1. **Non-Invasive**: Doesn't change your existing indexing logic
2. **Flexible**: Can choose to overwrite or skip duplicates
3. **Maintains Timestamps**: Keeps your timestamp system intact
4. **Logging**: Tracks what happens with duplicates
5. **Performance**: HEAD request is fast and efficient

## Testing

1. Upload a file once - should upload normally
2. Upload the same file again - should detect as duplicate
3. Check logs to verify duplicate detection is working
4. Verify indexing still works correctly

## Troubleshooting

### Issue: Duplicate check always returns false
- Check SAS token permissions (needs read access)
- Verify the blob path format matches your storage structure
- Check if baseFileName extraction is working correctly

### Issue: Indexing fails after adding duplicate detection
- Ensure all data is passed through each node
- Verify the "Process Duplicate Check" node returns all original fields
- Check that fileName field is preserved for indexing

### Issue: Wrong files detected as duplicates
- Review the timestamp removal patterns in `getBaseFileName()`
- Adjust regex patterns to match your timestamp format
