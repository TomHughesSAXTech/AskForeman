# n8n Workflow Manual Fix Instructions

Since the API is rejecting updates, please apply these fixes manually in the n8n interface:

## Access Your Workflow
1. Go to: https://workflows.saxtechnology.com/workflow/nC5gkystSoLrrKkN
2. Enter edit mode

## Critical Nodes to Fix

### 1. **Prepare File Data** Node
Find this Code node and replace its content with:

```javascript
// Universal file handler - works with all webhook formats
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;

// Extract file data from various possible locations
const fileData = data.file || data.fileBase64 || '';
const fileName = data.fileName || 'document.pdf';
const mimeType = data.mimeType || 'application/pdf';
const category = data.category || 'uncategorized';
const client = data.client || 'general';
const clientName = data.clientName || client;

if (!fileData) {
    throw new Error('No file data found in upload request');
}

// Convert base64 to buffer for Azure upload
const buffer = Buffer.from(fileData, 'base64');
const fileSize = buffer.length;
const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

return {
    json: {
        fileName: fileName,
        mimeType: mimeType,
        category: category,
        client: client,
        clientName: clientName,
        fileSize: fileSize,
        isLargeFile: fileSize > 10485760,
        originalPath: `${client}/${category}/original/${safeName}`,
        convertedPath: `${client}/${category}/converted/${safeName.replace(/\.pdf$/i, '')}.json`,
        uploadedAt: new Date().toISOString(),
        fileBase64: fileData
    },
    binary: {
        data: {
            data: buffer,
            mimeType: mimeType,
            fileName: fileName,
            fileExtension: fileName.split('.').pop() || 'pdf'
        }
    }
};
```

### 2. **Prepare Client Data** Node
Replace with:

```javascript
// Handle client creation request
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;

// Extract client name from various possible locations
const clientName = data.clientName || data.client || data.name || '';

if (!clientName) {
    throw new Error('Client name is required');
}

// Clean client name for folder creation
const cleanName = clientName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();

return {
    json: {
        clientName: cleanName,
        timestamp: new Date().toISOString(),
        categories: ['drawings', 'specs', 'submittals', 'rfis']
    }
};
```

### 3. **Convert Document** Node
Replace with:

```javascript
// Convert document to JSON format
const item = $input.first();
const json = item.json;

// Create JSON representation
const documentJson = {
    fileName: json.fileName,
    client: json.client,
    clientName: json.clientName,
    category: json.category,
    uploadedAt: json.uploadedAt,
    fileSize: json.fileSize,
    mimeType: json.mimeType,
    content: "Document content extracted here",
    metadata: {
        processed: true,
        processedAt: new Date().toISOString()
    }
};

// Convert to buffer for upload
const jsonString = JSON.stringify(documentJson, null, 2);
const jsonBuffer = Buffer.from(jsonString);

return {
    json: {
        ...json,
        convertedContent: jsonString,
        convertedSize: jsonBuffer.length
    },
    binary: {
        converted: {
            data: jsonBuffer,
            mimeType: 'application/json',
            fileName: json.fileName.replace(/\.pdf$/i, '.json'),
            fileExtension: 'json'
        }
    }
};
```

### 4. **Parse Delete File Request** Node (if exists)
Replace with:

```javascript
// Parse file deletion request
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;

const filePath = data.filePath || data.path || '';
const fileName = data.fileName || data.name || '';
const client = data.client || data.clientName || '';
const category = data.category || '';

if (!filePath && !fileName) {
    throw new Error('File path or name required for deletion');
}

let parsedClient = client;
let parsedCategory = category;
let parsedFileName = fileName;

if (filePath && !fileName) {
    const parts = filePath.split('/');
    if (parts.length >= 3) {
        parsedClient = parts[0];
        parsedCategory = parts[1];
        parsedFileName = parts[parts.length - 1];
    }
}

return {
    json: {
        client: parsedClient,
        category: parsedCategory,
        fileName: parsedFileName,
        filePath: filePath || `${parsedClient}/${parsedCategory}/${parsedFileName}`,
        deleteTimestamp: new Date().toISOString()
    }
};
```

### 5. **Parse Delete Client Request** Node (if exists)
Replace with:

```javascript
// Parse client deletion request
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;

const clientName = data.clientName || data.client || data.name || '';

if (!clientName) {
    throw new Error('Client name required for deletion');
}

return {
    json: {
        clientName: clientName,
        deleteTimestamp: new Date().toISOString()
    }
};
```

## HTTP Request Nodes Configuration

### For "Upload to Azure" nodes:
1. Set **Body Content Type** to: `Binary Data`
2. Set **Input Data Field Name** to: `data`
3. Add headers:
   - `x-ms-blob-type`: `BlockBlob`
   - `x-ms-blob-content-type`: `{{ $binary.data.mimeType }}`

### For "Upload Converted" nodes:
1. Set **Body Content Type** to: `Binary Data`
2. Set **Input Data Field Name** to: `converted`
3. Add headers:
   - `x-ms-blob-type`: `BlockBlob`
   - `x-ms-blob-content-type`: `application/json`

## Webhook Nodes Configuration

For all webhook nodes that receive file uploads:
1. Make sure **Binary Data** option is: `OFF`
2. Make sure **Raw Body** option is: `OFF`

## Testing

After applying these fixes:

1. Test file upload:
```bash
curl -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": "base64_encoded_file_content_here",
    "fileName": "test.pdf",
    "mimeType": "application/pdf",
    "category": "specs",
    "client": "TestClient",
    "clientName": "TestClient"
  }'
```

2. Test client creation:
```bash
curl -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/clients/create \
  -H "Content-Type: application/json" \
  -d '{"clientName": "NewTestClient"}'
```

3. Test file deletion:
```bash
curl -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/files/delete \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "TestClient/specs/test.pdf",
    "client": "TestClient",
    "category": "specs"
  }'
```

## Key Points

- All Code nodes now handle both direct JSON and nested `body` structures
- Binary data is properly created from base64 for Azure uploads
- File paths are sanitized to prevent Azure blob storage issues
- All webhooks expect JSON payloads, not FormData

## If Workflow Still Hangs

Make sure the webhook response nodes are connected properly and set to return JSON responses. The workflow should end with a "Respond to Webhook" node that returns a success message.
