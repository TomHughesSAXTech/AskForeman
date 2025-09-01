# Fix for Azure Upload Document Node

## The Issue
The error `source.on is not a function` occurs when n8n tries to send binary data but the binary object structure isn't correct.

## Solution

### 1. Update "Prepare Upload" Node
Replace the code in your "Prepare Upload" node with the code from `fixed-prepare-upload.js`

Key changes:
- Binary key changed from `data` to `file`
- Proper Buffer creation from base64

### 2. Update "Azure Upload Document" Node

In the HTTP Request node parameters, update the body parameters:

**Current (broken):**
```
Body Parameters:
- name: "file"
- value: "={{ $binary.data }}"
```

**Fixed:**
```
Body Parameters:
- name: "file"  
- value: "={{ $binary.file }}"
```

### 3. Alternative Approach (if still having issues)

If the multipart/form-data still gives issues, you can try sending as raw binary:

**In "Prepare Upload" node:**
```javascript
// Return just the binary without json
return {
  json: {
    client: client,
    category: category
  },
  binary: {
    file: {
      data: buffer,
      mimeType: mimeType,
      fileName: fileName
    }
  }
};
```

**In "Azure Upload Document" node:**
- Method: POST
- URL: (same)
- Send Headers: Yes
  - x-functions-key: (same)
  - Content-Type: multipart/form-data
- Send Body: Yes
- Body Content Type: n8n Binary Data
- Input Data Field Name: file

### 4. Test with Small File First
Try uploading a small text file first to ensure the pipeline works before trying large PDFs.

### 5. Check n8n Binary Data Mode
Ensure your n8n instance is configured correctly:
- Binary Data Mode should be set to "filesystem" (which it is based on your error)
- Check that n8n has write permissions to its data folder

## If Still Having Issues

The problem might be that we need to send the file differently to Azure Functions. Try this approach:

**Option A: Send as Base64 JSON (simpler but larger)**
```javascript
// In Prepare Upload
return {
  json: {
    file: fileData, // Keep as base64
    fileName: fileName,
    mimeType: mimeType,
    category: category,
    client: client
  }
};
```

Then in Azure Upload Document, send as JSON body instead of multipart.

**Option B: Use n8n's built-in file handling**
Instead of manual Buffer conversion, let n8n handle it:
```javascript
// In Prepare Upload
return {
  json: {
    client: client,
    category: category,
    fileData: fileData, // base64 string
    fileName: fileName,
    mimeType: mimeType
  }
};
```

Then use n8n's "Move Binary Data" node between Prepare Upload and Azure Upload Document to properly convert the base64 to binary.
