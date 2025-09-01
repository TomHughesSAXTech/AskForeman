#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNGM1ZDRmMy0wODlkLTQ3MDQtOWMxNy01MDY3Njc4ZjIxYzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU2MTcyNjAwfQ.hB9qJWoV-aFJCcYR791HALl9iBiP8lgdDM8lmG--3sI';
const WORKFLOW_ID = 'nC5gkystSoLrrKkN';

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'workflows.saxtechnology.com',
            path: `/api/v1${path}`,
            method: method,
            headers: {
                'X-N8N-API-KEY': API_KEY,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
        }

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject({ status: res.statusCode, data: parsed });
                    }
                } catch (e) {
                    resolve(responseData);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function main() {
    try {
        console.log('🔍 Fetching workflow...');
        const workflow = await makeRequest('GET', `/workflows/${WORKFLOW_ID}`);
        console.log(`✅ Got: ${workflow.name}`);
        
        fs.writeFileSync('backup.json', JSON.stringify(workflow, null, 2));
        
        // Fix critical nodes
        workflow.nodes.forEach(node => {
            if (node.type === 'n8n-nodes-base.code' && node.parameters) {
                if (node.name === 'Prepare File Data') {
                    console.log('🔧 Fix: Prepare File Data');
                    node.parameters.jsCode = `const i = $input.first();
const j = i.json || {};
const d = j.body || j;
const file = d.file || d.fileBase64 || '';
const name = d.fileName || 'doc.pdf';
const type = d.mimeType || 'application/pdf';
const cat = d.category || 'uncategorized';
const cli = d.client || 'general';
if (!file) throw new Error('No file');
const buf = Buffer.from(file, 'base64');
const safe = name.replace(/[^a-zA-Z0-9.-]/g, '_');
return {
  json: {
    fileName: name,
    mimeType: type,
    category: cat,
    client: cli,
    clientName: d.clientName || cli,
    fileSize: buf.length,
    isLargeFile: buf.length > 10485760,
    originalPath: cli + '/' + cat + '/original/' + safe,
    convertedPath: cli + '/' + cat + '/converted/' + safe.replace(/\\.pdf$/i, '') + '.json',
    uploadedAt: new Date().toISOString(),
    fileBase64: file
  },
  binary: {
    data: {
      data: buf,
      mimeType: type,
      fileName: name,
      fileExtension: name.split('.').pop() || 'pdf'
    }
  }
};`;
                }
                if (node.name === 'Prepare Client Data') {
                    console.log('🔧 Fix: Prepare Client Data');
                    node.parameters.jsCode = `const i = $input.first();
const j = i.json || {};
const d = j.body || j;
const n = d.clientName || d.client || d.name || '';
if (!n) throw new Error('No client');
return {
  json: {
    clientName: n.replace(/[^a-zA-Z0-9-_ ]/g, '').trim(),
    timestamp: new Date().toISOString(),
    categories: ['drawings', 'specs', 'submittals', 'rfis']
  }
};`;
                }
                if (node.name === 'Convert Document') {
                    console.log('🔧 Fix: Convert Document');
                    node.parameters.jsCode = `const i = $input.first();
const j = i.json;
const doc = {
  fileName: j.fileName,
  client: j.client,
  clientName: j.clientName,
  category: j.category,
  uploadedAt: j.uploadedAt,
  fileSize: j.fileSize,
  mimeType: j.mimeType,
  content: "Document content",
  metadata: { processed: true, processedAt: new Date().toISOString() }
};
const str = JSON.stringify(doc, null, 2);
const buf = Buffer.from(str);
return {
  json: Object.assign({}, j, { convertedContent: str, convertedSize: buf.length }),
  binary: {
    converted: {
      data: buf,
      mimeType: 'application/json',
      fileName: j.fileName.replace(/\\.pdf$/i, '.json'),
      fileExtension: 'json'
    }
  }
};`;
                }
            }
        });

        console.log('🚀 Updating...');
        
        // Send only required fields
        const update = {
            name: workflow.name,
            nodes: workflow.nodes,
            connections: workflow.connections,
            settings: {},
            staticData: workflow.staticData || {}
        };
        
        const result = await makeRequest('PUT', `/workflows/${WORKFLOW_ID}`, update);
        console.log('✅ Success!');
        fs.writeFileSync('fixed.json', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
        if (error.data) console.error(JSON.stringify(error.data, null, 2));
    }
}

main();
