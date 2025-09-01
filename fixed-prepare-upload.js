// Fixed Prepare Upload node for n8n
// This should replace the code in your "Prepare Upload" node

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

// Convert base64 to Buffer
const buffer = Buffer.from(fileData, 'base64');

// Return with proper binary structure for n8n
return {
  json: {
    client: client,
    category: category,
    fileName: fileName,
    mimeType: mimeType
  },
  binary: {
    file: {  // Changed from 'data' to 'file'
      data: buffer,
      mimeType: mimeType,
      fileName: fileName
    }
  }
};
