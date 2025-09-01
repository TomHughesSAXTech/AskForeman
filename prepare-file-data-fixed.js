// Fixed "Prepare File Data" node code for n8n
// This handles the webhook data structure properly

// Get the first input item - this comes from the webhook
const inputItem = $input.first();

// Debug the structure
console.log('=== Prepare File Data Debug ===');
console.log('Input item type:', typeof inputItem);
console.log('Input item keys:', Object.keys(inputItem));

// The webhook data is typically in inputItem.json
let webhookData = inputItem.json || {};

// Log what we have
console.log('Webhook data keys:', Object.keys(webhookData));

// Handle nested body structure if present
// The webhook might wrap data in a 'body' property
let data = webhookData;
if (webhookData.body && typeof webhookData.body === 'object') {
    console.log('Found body object, using body data');
    data = webhookData.body;
} else if (webhookData.body && typeof webhookData.body === 'string') {
    console.log('Found body string, parsing as JSON');
    try {
        data = JSON.parse(webhookData.body);
    } catch (e) {
        console.error('Failed to parse body string:', e);
        data = webhookData;
    }
}

// Extract file data and metadata
const fileData = data.file || '';
const fileName = data.fileName || 'document.pdf';
const mimeType = data.mimeType || 'application/pdf';
const category = data.category || 'uncategorized';
const client = data.client || 'general';
const clientName = data.clientName || client;

// Log what we extracted
console.log('Extracted data:');
console.log('- File data length:', fileData ? fileData.length : 0);
console.log('- File name:', fileName);
console.log('- MIME type:', mimeType);
console.log('- Category:', category);
console.log('- Client:', client);
console.log('- Client name:', clientName);

// Validate we have file data
if (!fileData) {
    console.error('ERROR: No file data found!');
    console.error('Available data keys:', Object.keys(data));
    console.error('First 500 chars of data:', JSON.stringify(data).substring(0, 500));
    
    // Check if file might be in a different location
    if (data.fileBase64) {
        console.log('Found fileBase64 field, using that instead');
        // Use fileBase64 if available
        const fixedData = {
            file: data.fileBase64,
            fileName: fileName,
            mimeType: mimeType,
            category: category,
            client: client,
            clientName: clientName,
            fileSize: 0,
            uploadedAt: new Date().toISOString()
        };
        
        // Calculate size
        const base64Length = data.fileBase64.length;
        const padding = (data.fileBase64.match(/=/g) || []).length;
        fixedData.fileSize = Math.floor((base64Length * 3) / 4) - padding;
        
        // Convert to binary
        const buffer = Buffer.from(data.fileBase64, 'base64');
        const fileExtension = fileName.split('.').pop() || 'pdf';
        
        return {
            json: fixedData,
            binary: {
                data: {
                    data: buffer,
                    mimeType: mimeType,
                    fileName: fileName,
                    fileExtension: fileExtension
                }
            }
        };
    }
    
    throw new Error('No file data found in webhook request');
}

// Calculate file size from base64
const base64Length = fileData.length;
const padding = (fileData.match(/=/g) || []).length;
const fileSize = Math.floor((base64Length * 3) / 4) - padding;

// Convert base64 to binary buffer
const buffer = Buffer.from(fileData, 'base64');

// Get file extension
const fileExtension = fileName.split('.').pop() || 'pdf';

console.log(`✅ File prepared: ${fileName}, Size: ${(fileSize / 1024).toFixed(2)} KB`);

// Return both JSON metadata and binary data
return {
    json: {
        // Metadata for downstream nodes
        fileName: fileName,
        mimeType: mimeType,
        category: category,
        client: client,
        clientName: clientName,
        fileSize: fileSize,
        uploadedAt: new Date().toISOString(),
        // Keep base64 for nodes that might need it
        fileBase64: fileData
    },
    binary: {
        // Binary data for Azure upload
        data: {
            data: buffer,
            mimeType: mimeType,
            fileName: fileName,
            fileExtension: fileExtension
        }
    }
};
