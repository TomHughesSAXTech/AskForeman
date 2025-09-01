#!/usr/bin/env node

const https = require('https');
const FormData = require('form-data');
const fs = require('fs');

async function testFormDataUpload() {
  console.log('Testing FormData upload to n8n webhook...\n');
  
  const webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload';
  
  // Create a test file
  const testContent = 'This is a test PDF file content';
  const testFileName = 'test-document.pdf';
  fs.writeFileSync(testFileName, testContent);
  
  // Create FormData
  const form = new FormData();
  form.append('file', fs.createReadStream(testFileName), {
    filename: testFileName,
    contentType: 'application/pdf'
  });
  form.append('category', 'specs');
  form.append('client', 'test-client');
  form.append('clientName', 'Test Client');
  form.append('fileName', testFileName);
  
  const options = {
    method: 'POST',
    headers: form.getHeaders()
  };
  
  console.log('Sending FormData with file...');
  console.log('Headers:', options.headers);
  
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const req = https.request(url, options, (res) => {
      let data = '';
      
      console.log('\nResponse Status:', res.statusCode);
      console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('\nResponse Body:');
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
          
          // Check if it's an error response
          if (parsed.errorMessage) {
            console.log('\n❌ Error from n8n:', parsed.errorMessage);
            if (parsed.errorDetails) {
              console.log('Error details:', parsed.errorDetails);
            }
          }
        } catch (e) {
          console.log(data || '(empty response)');
        }
        
        // Clean up test file
        fs.unlinkSync(testFileName);
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request Error:', error.message);
      fs.unlinkSync(testFileName);
      reject(error);
    });
    
    // Send the form
    form.pipe(req);
  });
}

// Also test with just form fields (no file) to see what happens
async function testFormDataWithoutFile() {
  console.log('\n\n=== Testing FormData without file (just fields) ===\n');
  
  const FormData = require('form-data');
  const form = new FormData();
  
  // Just send the metadata without a file
  form.append('category', 'specs');
  form.append('client', 'test-client');
  form.append('clientName', 'Test Client');
  form.append('fileName', 'test.pdf');
  
  const webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload';
  
  const options = {
    method: 'POST',
    headers: form.getHeaders()
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
        console.log('\nResponse Body:');
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
          
          if (parsed.errorMessage) {
            console.log('\n❌ Error:', parsed.errorMessage);
            console.log('This confirms n8n expects a file in the FormData');
          }
        } catch (e) {
          console.log(data);
        }
        resolve();
      });
    });
    
    req.on('error', reject);
    form.pipe(req);
  });
}

// Check if form-data module is installed
try {
  require.resolve('form-data');
  // Run tests
  testFormDataUpload()
    .then(() => testFormDataWithoutFile())
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
} catch(e) {
  console.log('Installing form-data module...');
  const { execSync } = require('child_process');
  execSync('npm install form-data', { stdio: 'inherit' });
  console.log('Please run the script again.');
}
