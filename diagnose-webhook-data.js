// Diagnostic code to understand what the webhook is receiving
// Use this temporarily in the "Prepare File Data" node to see the data structure

const inputItem = $input.first();

console.log('=== WEBHOOK DATA DIAGNOSTIC ===');

// Check the top-level structure
console.log('\n1. Input item type:', typeof inputItem);
console.log('2. Input item keys:', Object.keys(inputItem));

// Check json property
if (inputItem.json) {
    console.log('\n3. inputItem.json exists');
    console.log('   Type:', typeof inputItem.json);
    console.log('   Keys:', Object.keys(inputItem.json));
    console.log('   First 1000 chars:', JSON.stringify(inputItem.json).substring(0, 1000));
    
    // Check for body
    if (inputItem.json.body) {
        console.log('\n4. inputItem.json.body exists');
        console.log('   Type:', typeof inputItem.json.body);
        if (typeof inputItem.json.body === 'object') {
            console.log('   Keys:', Object.keys(inputItem.json.body));
            console.log('   First 500 chars:', JSON.stringify(inputItem.json.body).substring(0, 500));
        } else {
            console.log('   First 500 chars:', inputItem.json.body.substring(0, 500));
        }
    }
    
    // Check for direct file property
    if (inputItem.json.file) {
        console.log('\n5. inputItem.json.file exists');
        console.log('   Length:', inputItem.json.file.length);
        console.log('   First 100 chars:', inputItem.json.file.substring(0, 100));
    }
    
    // Check for fileBase64
    if (inputItem.json.fileBase64) {
        console.log('\n6. inputItem.json.fileBase64 exists');
        console.log('   Length:', inputItem.json.fileBase64.length);
        console.log('   First 100 chars:', inputItem.json.fileBase64.substring(0, 100));
    }
}

// Check binary property
if (inputItem.binary) {
    console.log('\n7. inputItem.binary exists');
    console.log('   Type:', typeof inputItem.binary);
    console.log('   Keys:', Object.keys(inputItem.binary));
    
    // Check each binary field
    for (const key of Object.keys(inputItem.binary)) {
        const binaryItem = inputItem.binary[key];
        console.log(`\n   Binary field "${key}":`);
        console.log(`   - Has data:`, !!binaryItem.data);
        console.log(`   - MIME type:`, binaryItem.mimeType);
        console.log(`   - File name:`, binaryItem.fileName);
        if (binaryItem.data) {
            console.log(`   - Data type:`, typeof binaryItem.data);
            console.log(`   - Is Buffer:`, Buffer.isBuffer(binaryItem.data));
            if (Buffer.isBuffer(binaryItem.data)) {
                console.log(`   - Buffer size:`, binaryItem.data.length);
            }
        }
    }
}

// Check for headers
if (inputItem.json && inputItem.json.headers) {
    console.log('\n8. Headers found:');
    console.log('   Content-Type:', inputItem.json.headers['content-type']);
    console.log('   Content-Length:', inputItem.json.headers['content-length']);
}

// Check for query parameters
if (inputItem.json && inputItem.json.query) {
    console.log('\n9. Query parameters:', inputItem.json.query);
}

console.log('\n=== END DIAGNOSTIC ===\n');

// Return the full structure for inspection
return {
    json: {
        diagnostic: 'Complete structure logged to console',
        timestamp: new Date().toISOString(),
        hasJson: !!inputItem.json,
        hasBinary: !!inputItem.binary,
        jsonKeys: inputItem.json ? Object.keys(inputItem.json) : [],
        binaryKeys: inputItem.binary ? Object.keys(inputItem.binary) : []
    }
};
