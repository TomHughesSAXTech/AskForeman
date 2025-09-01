# Fix n8n Multipart Upload to Azure Function

The .NET Azure Function expects multipart/form-data with:
- File as form file (not base64)
- `client` as form field
- `category` as form field

## Update "Prepare Upload" Node

Use this code:
```javascript
const input = $input.first();
const data = input.json.body || input.json;

// Extract data
const fileData = data.file || data.data || '';
const fileName = data.fileName || data.name || 'document.pdf';
const mimeType = data.mimeType || data.type || 'application/pdf';
const category = data.category || 'uncategorized';
const client = data.client || 'general';

if (!fileData) {
  throw new Error('No file data provided');
}

// Convert base64 to Buffer for binary
const buffer = Buffer.from(fileData, 'base64');

// Return both JSON and binary
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

## Update "Azure Upload Document" Node

Configure the HTTP Request node as follows:

**Basic Settings:**
- Method: `POST`
- URL: `https://saxtech-docconverter.azurewebsites.net/api/convertdocument`

**Headers:**
- Send Headers: `Yes`
- Header Parameters:
  - Name: `x-functions-key`
  - Value: `GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA==`

**Body:**
- Send Body: `Yes`
- Body Content Type: `Form-Data Multipart`
- Body Parameters:
  1. Parameter Type: `Form Data`
     - Name: `file`
     - Value: `={{ $binary.file }}`
     - Input Data Field Name: `file`
  2. Parameter Type: `String`
     - Name: `client`
     - Value: `={{ $json.client }}`
  3. Parameter Type: `String`
     - Name: `category`
     - Value: `={{ $json.category }}`

**Options:**
- Timeout: `120000`

## Alternative: If Form-Data Still Fails

Try using n8n's "HTTP Request" node with these exact settings:

1. Method: POST
2. URL: (same as above)
3. Authentication: None
4. Send Headers: Yes
   - x-functions-key: (your key)
5. Send Query Parameters: No
6. Send Body: Yes
7. Body Content Type: "n8n Binary Data"
8. Input Data Field Name: `file`
9. Options:
   - Add Option > Form Data:
     - client: {{ $json.client }}
     - category: {{ $json.category }}
