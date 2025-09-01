# n8n Azure Upload Configuration Instructions

## Problem
The HTTP Request node expects binary data but receives base64 strings, causing the error:
"This operation expects the node's input data to contain a binary file 'data', but none was found"

## Solution

### 1. Update the "Check File Size" Code Node
Replace the code in your "Check File Size" node with the content from `check-file-size-with-binary.js`. This code:
- Extracts base64 data from the webhook JSON payload
- Converts base64 to a binary buffer
- Returns BOTH JSON metadata AND binary data

### 2. Configure the "Upload to Azure" HTTP Request Node

#### Settings for the HTTP Request node:
1. **Method**: `PUT`
2. **URL**: Your Azure Blob URL (e.g., `https://{{storageAccount}}.blob.core.windows.net/{{container}}/{{path}}`)
3. **Authentication**: Set your Azure authentication (SAS token or headers)
4. **Body Content Type**: Select `Binary Data` (this is crucial!)
5. **Input Data Field Name**: Set to `data` (must match the binary field name from the Code node)

#### Required Headers:
- `x-ms-blob-type`: `BlockBlob`
- `Content-Type`: Use expression `{{ $binary.data.mimeType }}` to get from binary data

### 3. If Using Multiple Binary Fields
If you need to use a different field name than 'data', update both:
- In the Code node, change the binary field name:
  ```javascript
  binary: {
      file: {  // Change 'data' to 'file' or your preferred name
          data: buffer,
          mimeType: mimeType,
          fileName: fileName,
          fileExtension: fileExtension
      }
  }
  ```
- In the HTTP Request node, set "Input Data Field Name" to match (e.g., `file`)

### 4. For the Router Node (File Size Check)
If you have a router that checks file size, it should use the JSON data:
- Expression: `{{ $json.isLargeFile }}`
- Or: `{{ $json.fileSize > 10485760 }}` (for 10MB)

### 5. Troubleshooting
If you still get binary data errors:
1. Check the execution data of the Code node - confirm it has a `binary` property
2. Verify the HTTP Request node's "Input Data Field Name" matches exactly
3. Ensure "Body Content Type" is set to "Binary Data", not "JSON" or "Form-Data"
4. Check that the binary buffer is properly created from base64

### Example Test
You can test the conversion locally:
```javascript
// Test if base64 converts properly
const testBase64 = "JVBERi0xLjQK..."; // Your base64 string
const buffer = Buffer.from(testBase64, 'base64');
console.log('Buffer size:', buffer.length);
console.log('Is Buffer:', Buffer.isBuffer(buffer));
```

## Alternative Approach: Direct Binary in HTTP Node
If you prefer not to convert in the Code node, you can use the HTTP Request node's built-in base64 handling:
1. Keep base64 as string in JSON
2. In HTTP Request node:
   - Body Content Type: `Raw`
   - Body: Use expression to convert: `{{ Buffer.from($json.fileBase64, 'base64') }}`
   - Content-Type header: Set manually to the file's MIME type

## Summary
The key is ensuring the Code node outputs binary data and the HTTP Request node is configured to read from the correct binary field. The field name must match exactly between the Code node's output and the HTTP node's input configuration.
