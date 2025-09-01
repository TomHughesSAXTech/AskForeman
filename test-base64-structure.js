#!/usr/bin/env node

const https = require('https');

async function testBase64Upload() {
  console.log('Testing base64 JSON upload to see exact structure n8n receives...\n');
  
  const webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload';
  
  // Create test data matching what our HTML sends
  const testData = {
    file: Buffer.from('This is a test PDF content').toString('base64'),
    fileName: 'test-document.pdf',
    mimeType: 'application/pdf',
    category: 'specs',
    client: 'test-client',
    clientName: 'Test Client'
  };
  
  console.log('Sending base64 JSON structure:');
  console.log(JSON.stringify(testData, null, 2).substring(0, 200) + '...\n');
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(testData))
    }
  };
  
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const req = https.request(url, options, (res) => {
      let data = '';
      
      console.log('Response Status:', res.statusCode);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('\nResponse:');
        try {
          const parsed = JSON.parse(data);
          
          // Check if it's an error
          if (parsed.errorMessage) {
            console.log('❌ ERROR:', parsed.errorMessage);
            
            // Check which line the error is on
            if (parsed.n8nDetails && parsed.n8nDetails.nodeName) {
              console.log('Failed in node:', parsed.n8nDetails.nodeName);
            }
            
            // This tells us where in the code it failed
            if (parsed.errorMessage.includes('[line')) {
              const lineMatch = parsed.errorMessage.match(/\[line (\d+)\]/);
              if (lineMatch) {
                console.log('Error at line:', lineMatch[1]);
                console.log('\nThis means the "Check File Size" node is failing to find the file data.');
                console.log('The JSON structure might be nested differently than expected.');
              }
            }
          } else {
            console.log('✅ SUCCESS - Upload processed');
            console.log('Response shows client:', parsed.client || 'not found');
            console.log('Response shows category:', parsed.category || 'not found');
            
            // Check if client/category are being extracted properly
            if (parsed.client === 'general' || parsed.category === 'uncategorized') {
              console.log('\n⚠️  WARNING: Client or category defaulted to fallback values');
              console.log('This suggests the JSON extraction is not working correctly');
            }
          }
        } catch (e) {
          console.log('Raw response:', data);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request Error:', error.message);
      reject(error);
    });
    
    req.write(JSON.stringify(testData));
    req.end();
  });
}

// Run test
testBase64Upload().catch(console.error);
