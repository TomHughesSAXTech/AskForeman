// Simplified Check File Size node for n8n
// This version directly accesses the webhook data

// Get the first input item
const item = $input.first();

// Log the entire input structure to understand what we're receiving
console.log('Full input item keys:', Object.keys(item));
console.log('Full json object:', JSON.stringify(item.json).substring(0, 500));

// When a webhook receives JSON, n8n puts it directly in item.json
// No need for complex nesting checks
const data = item.json;

// Extract our fields directly - they should be at the top level
const fileData = data.file || '';
const fileName = data.fileName || 'document.pdf';
const mimeType = data.mimeType || 'application/pdf';
const category = data.category || 'uncategorized';
const client = data.client || 'general';
const clientName = data.clientName || client;

// Validate we have file data
if (!fileData) {
    console.error('No file data found. Available keys:', Object.keys(data));
    console.error('First 200 chars of data:', JSON.stringify(data).substring(0, 200));
    throw new Error('No file data found in upload request');
}

// Calculate file size from base64
const base64Length = fileData.length;
const padding = (fileData.match(/=/g) || []).length;
const fileSize = Math.floor((base64Length * 3) / 4) - padding;

// Determine if file is large (> 10MB)
const isLargeFile = fileSize > 10 * 1024 * 1024;

console.log(`✅ Processing: ${fileName}, Size: ${(fileSize / 1024).toFixed(2)} KB, Client: ${client}, Category: ${category}`);

// Return the data for next nodes
return {
    file: fileData,
    fileName: fileName,
    mimeType: mimeType,
    category: category,
    client: client,
    clientName: clientName,
    fileSize: fileSize,
    isLargeFile: isLargeFile,
    uploadedAt: new Date().toISOString()
};
