// Alternative: Send as JSON instead of multipart/form-data
// This approach sends the file as base64 in JSON body

const input = $input.first();
const data = input.json.body || input.json;

// Extract file data
const fileData = data.file || data.data || '';
const fileName = data.fileName || data.name || 'document.pdf';
const mimeType = data.mimeType || data.type || 'application/pdf';
const category = data.category || 'uncategorized';
const client = data.client || 'general';

if (!fileData) {
  throw new Error('No file data provided in upload request');
}

// Return as JSON data (no binary conversion)
return {
  json: {
    file: fileData,  // Keep as base64 string
    fileName: fileName,
    mimeType: mimeType,
    category: category,
    client: client
  }
};
