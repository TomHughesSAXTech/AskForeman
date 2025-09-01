// This is the fixed "Check File Size" node code for n8n
// It properly handles base64 JSON uploads from the frontend

const inputData = $input.all()[0];

// Initialize variables
let fileData = '';
let fileName = '';
let mimeType = '';
let category = '';
let client = '';
let clientName = '';

// When a webhook receives JSON with Content-Type: application/json,
// n8n typically puts the data in inputData.json
const json = inputData.json || {};

// Debug logging to see structure
console.log('Input structure keys:', Object.keys(inputData));
console.log('JSON keys:', Object.keys(json));

// The webhook likely wraps our data in a 'body' property
// Try to extract from most likely location first
if (json.body) {
    // Parse body if it's a string
    const body = typeof json.body === 'string' ? JSON.parse(json.body) : json.body;
    
    fileData = body.file || '';
    fileName = body.fileName || 'document.pdf';
    mimeType = body.mimeType || 'application/pdf';
    category = body.category || 'uncategorized';
    client = body.client || 'general';
    clientName = body.clientName || client;
    
    console.log('Extracted from json.body - Client:', client, 'Category:', category);
} else {
    // Direct properties on json (fallback)
    fileData = json.file || '';
    fileName = json.fileName || 'document.pdf';
    mimeType = json.mimeType || 'application/pdf';
    category = json.category || 'uncategorized';
    client = json.client || 'general';
    clientName = json.clientName || client;
    
    console.log('Extracted from direct json - Client:', client, 'Category:', category);
}

// Validate we have file data
if (!fileData) {
    console.error('No file data found in:', JSON.stringify(json).substring(0, 500));
    throw new Error('No file data found in upload request');
}

// Calculate file size from base64
const base64Length = fileData.length;
const padding = (fileData.match(/=/g) || []).length;
const fileSize = Math.floor((base64Length * 3) / 4) - padding;

// Determine if file is large (> 10MB)
const isLargeFile = fileSize > 10 * 1024 * 1024;

console.log(`✅ Processing: ${fileName}, Size: ${(fileSize / 1024).toFixed(2)} KB, Client: ${client}, Category: ${category}`);

// Return properly structured data for next nodes
return {
    json: {
        file: fileData,
        fileName: fileName,
        mimeType: mimeType,
        category: category,
        client: client,
        clientName: clientName,
        fileSize: fileSize,
        isLargeFile: isLargeFile,
        uploadedAt: new Date().toISOString()
    }
};
