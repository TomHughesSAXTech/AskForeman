// Universal "Prepare File Data" node code for n8n
// Handles multiple possible webhook data structures

const inputItem = $input.first();

// Initialize variables
let fileData = null;
let fileName = 'document.pdf';
let mimeType = 'application/pdf';
let category = 'uncategorized';
let client = 'general';
let clientName = 'general';

console.log('=== Prepare File Data - Universal Handler ===');

// Strategy 1: Check if data comes from a previous node (like Check File Size)
if (inputItem.json && inputItem.json.fileBase64) {
    console.log('Found fileBase64 from previous node');
    fileData = inputItem.json.fileBase64;
    fileName = inputItem.json.fileName || fileName;
    mimeType = inputItem.json.mimeType || mimeType;
    category = inputItem.json.category || category;
    client = inputItem.json.client || client;
    clientName = inputItem.json.clientName || clientName;
}
// Strategy 2: Check if data is directly in json
else if (inputItem.json && inputItem.json.file) {
    console.log('Found file in json root');
    fileData = inputItem.json.file;
    fileName = inputItem.json.fileName || fileName;
    mimeType = inputItem.json.mimeType || mimeType;
    category = inputItem.json.category || category;
    client = inputItem.json.client || client;
    clientName = inputItem.json.clientName || clientName;
}
// Strategy 3: Check if data is in json.body (webhook with body)
else if (inputItem.json && inputItem.json.body) {
    console.log('Found body in json, checking for file data');
    let body = inputItem.json.body;
    
    // Parse if body is a string
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            console.error('Failed to parse body string');
        }
    }
    
    if (body && typeof body === 'object') {
        fileData = body.file || body.fileBase64 || null;
        fileName = body.fileName || fileName;
        mimeType = body.mimeType || mimeType;
        category = body.category || category;
        client = body.client || client;
        clientName = body.clientName || clientName;
    }
}
// Strategy 4: Check if we already have binary data from webhook
else if (inputItem.binary && Object.keys(inputItem.binary).length > 0) {
    console.log('Found existing binary data from webhook');
    const binaryKey = Object.keys(inputItem.binary)[0];
    const binaryItem = inputItem.binary[binaryKey];
    
    // We already have binary, just pass it through with metadata
    return {
        json: {
            fileName: binaryItem.fileName || fileName,
            mimeType: binaryItem.mimeType || mimeType,
            category: inputItem.json?.category || category,
            client: inputItem.json?.client || client,
            clientName: inputItem.json?.clientName || client,
            fileSize: binaryItem.data ? binaryItem.data.length : 0,
            uploadedAt: new Date().toISOString()
        },
        binary: inputItem.binary
    };
}

// Validate we found file data
if (!fileData) {
    console.error('ERROR: No file data found in any expected location');
    console.error('Input structure:');
    console.error('- Has json:', !!inputItem.json);
    console.error('- Has binary:', !!inputItem.binary);
    if (inputItem.json) {
        console.error('- JSON keys:', Object.keys(inputItem.json));
        console.error('- JSON sample:', JSON.stringify(inputItem.json).substring(0, 500));
    }
    throw new Error('No file data found in webhook request - check webhook configuration');
}

// Calculate file size and convert to binary
let fileSize;
let buffer;

// Check if fileData is already a buffer
if (Buffer.isBuffer(fileData)) {
    console.log('File data is already a buffer');
    buffer = fileData;
    fileSize = buffer.length;
} else if (typeof fileData === 'string') {
    console.log('File data is base64 string, converting to buffer');
    // It's a base64 string
    buffer = Buffer.from(fileData, 'base64');
    fileSize = buffer.length;
} else {
    console.error('Unknown file data type:', typeof fileData);
    throw new Error('File data is neither a buffer nor a base64 string');
}

// Get file extension
const fileExtension = fileName.split('.').pop() || 'pdf';

console.log(`✅ File prepared successfully:`);
console.log(`   - Name: ${fileName}`);
console.log(`   - Size: ${(fileSize / 1024).toFixed(2)} KB`);
console.log(`   - Type: ${mimeType}`);
console.log(`   - Client: ${client}/${clientName}`);
console.log(`   - Category: ${category}`);

// Return both JSON metadata and binary data
return {
    json: {
        // Metadata for all downstream nodes
        fileName: fileName,
        mimeType: mimeType,
        category: category,
        client: client,
        clientName: clientName,
        fileSize: fileSize,
        isLargeFile: fileSize > 10 * 1024 * 1024,
        uploadedAt: new Date().toISOString(),
        // Keep base64 for nodes that need it
        fileBase64: typeof fileData === 'string' ? fileData : buffer.toString('base64')
    },
    binary: {
        // Binary data for Azure upload - using 'data' as the standard field name
        data: {
            data: buffer,
            mimeType: mimeType,
            fileName: fileName,
            fileExtension: fileExtension
        }
    }
};
