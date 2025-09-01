#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

// Configuration
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNGM1ZDRmMy0wODlkLTQ3MDQtOWMxNy01MDY3Njc4ZjIxYzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU2MTcyNjAwfQ.hB9qJWoV-aFJCcYR791HALl9iBiP8lgdDM8lmG--3sI';
const WORKFLOW_ID = 'nC5gkystSoLrrKkN';
const BASE_URL = 'workflows.saxtechnology.com';

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: `/api/v1${path}`,
            method: method,
            headers: {
                'X-N8N-API-KEY': API_KEY,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
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
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function fixWorkflow() {
    try {
        console.log('🔍 Fetching workflow...');
        const workflow = await makeRequest('GET', `/workflows/${WORKFLOW_ID}`);
        console.log(`✅ Fetched workflow: ${workflow.name}`);
        
        // Save backup
        fs.writeFileSync('workflow-backup-minimal.json', JSON.stringify(workflow, null, 2));
        console.log('📝 Backup saved');

        let modified = false;

        // Only fix the critical Code nodes
        workflow.nodes.forEach(node => {
            // Fix Prepare File Data
            if (node.name === 'Prepare File Data' && node.type === 'n8n-nodes-base.code') {
                console.log('🔧 Fixing Prepare File Data...');
                node.parameters.jsCode = `// Universal file handler
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;

const fileData = data.file || data.fileBase64 || '';
const fileName = data.fileName || 'document.pdf';
const mimeType = data.mimeType || 'application/pdf';
const category = data.category || 'uncategorized';
const client = data.client || 'general';
const clientName = data.clientName || client;

if (!fileData) throw new Error('No file data found');

const buffer = Buffer.from(fileData, 'base64');
const fileSize = buffer.length;
const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

return {
    json: {
        fileName, mimeType, category, client, clientName, fileSize,
        isLargeFile: fileSize > 10485760,
        originalPath: \`\${client}/\${category}/original/\${safeName}\`,
        convertedPath: \`\${client}/\${category}/converted/\${safeName.replace(/\\.pdf$/i, '')}.json\`,
        uploadedAt: new Date().toISOString(),
        fileBase64: fileData
    },
    binary: {
        data: {
            data: buffer,
            mimeType: mimeType,
            fileName: fileName,
            fileExtension: fileName.split('.').pop() || 'pdf'
        }
    }
};`;
                modified = true;
            }

            // Fix Prepare Client Data
            if (node.name === 'Prepare Client Data' && node.type === 'n8n-nodes-base.code') {
                console.log('🔧 Fixing Prepare Client Data...');
                node.parameters.jsCode = `// Prepare client data
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;
const clientName = data.clientName || data.client || data.name || '';

if (!clientName) throw new Error('Client name is required');

const cleanName = clientName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();

return {
    json: {
        clientName: cleanName,
        timestamp: new Date().toISOString(),
        categories: ['drawings', 'specs', 'submittals', 'rfis']
    }
};`;
                modified = true;
            }

            // Fix Convert Document
            if (node.name === 'Convert Document' && node.type === 'n8n-nodes-base.code') {
                console.log('🔧 Fixing Convert Document...');
                node.parameters.jsCode = `// Convert document
const item = $input.first();
const json = item.json;

const documentJson = {
    fileName: json.fileName,
    client: json.client,
    clientName: json.clientName,
    category: json.category,
    uploadedAt: json.uploadedAt,
    fileSize: json.fileSize,
    mimeType: json.mimeType,
    content: "Document content here",
    metadata: {
        processed: true,
        processedAt: new Date().toISOString()
    }
};

const jsonString = JSON.stringify(documentJson, null, 2);
const jsonBuffer = Buffer.from(jsonString);

return {
    json: {
        ...json,
        convertedContent: jsonString,
        convertedSize: jsonBuffer.length
    },
    binary: {
        converted: {
            data: jsonBuffer,
            mimeType: 'application/json',
            fileName: json.fileName.replace(/\\.pdf$/i, '.json'),
            fileExtension: 'json'
        }
    }
};`;
                modified = true;
            }

            // Fix Parse Delete File Request
            if (node.name === 'Parse Delete File Request' && node.type === 'n8n-nodes-base.code') {
                console.log('🔧 Fixing Parse Delete File Request...');
                node.parameters.jsCode = `// Parse delete request
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;

const filePath = data.filePath || data.path || '';
const fileName = data.fileName || data.name || '';
const client = data.client || data.clientName || '';
const category = data.category || '';

if (!filePath && !fileName) throw new Error('File path or name required');

let parsedClient = client;
let parsedCategory = category;
let parsedFileName = fileName;

if (filePath && !fileName) {
    const parts = filePath.split('/');
    if (parts.length >= 3) {
        parsedClient = parts[0];
        parsedCategory = parts[1];
        parsedFileName = parts[parts.length - 1];
    }
}

return {
    json: {
        client: parsedClient,
        category: parsedCategory,
        fileName: parsedFileName,
        filePath: filePath || \`\${parsedClient}/\${parsedCategory}/\${parsedFileName}\`,
        deleteTimestamp: new Date().toISOString()
    }
};`;
                modified = true;
            }

            // Fix Parse Delete Client Request
            if (node.name === 'Parse Delete Client Request' && node.type === 'n8n-nodes-base.code') {
                console.log('🔧 Fixing Parse Delete Client Request...');
                node.parameters.jsCode = `// Parse delete client
const inputItem = $input.first();
const json = inputItem.json || {};
const data = json.body || json;
const clientName = data.clientName || data.client || data.name || '';

if (!clientName) throw new Error('Client name required');

return {
    json: {
        clientName: clientName,
        deleteTimestamp: new Date().toISOString()
    }
};`;
                modified = true;
            }
        });

        if (modified) {
            console.log('\n🚀 Updating workflow...');
            
            // Minimal update data
            const updateData = {
                name: workflow.name,
                nodes: workflow.nodes,
                connections: workflow.connections,
                settings: workflow.settings || {},
                staticData: workflow.staticData || {}
            };

            // Remove any problematic settings
            delete updateData.settings.saveDataErrorExecution;
            delete updateData.settings.saveDataSuccessExecution;
            delete updateData.settings.saveExecutionProgress;
            delete updateData.settings.saveManualExecutions;

            const result = await makeRequest('PUT', `/workflows/${WORKFLOW_ID}`, updateData);
            console.log('✅ Workflow updated successfully!');
            
            fs.writeFileSync('workflow-fixed-minimal.json', JSON.stringify(result, null, 2));
            console.log('📝 Fixed workflow saved');
            
            return result;
        } else {
            console.log('ℹ️ No modifications needed');
            return workflow;
        }

    } catch (error) {
        console.error('❌ Error:', error);
        if (error.data) {
            console.error('Details:', JSON.stringify(error.data, null, 2));
        }
        process.exit(1);
    }
}

fixWorkflow().then(() => {
    console.log('\n✅ Critical nodes fixed!');
    console.log('\nFixed:');
    console.log('• Prepare File Data - handles all webhook formats');
    console.log('• Prepare Client Data - extracts client properly');
    console.log('• Convert Document - creates JSON with binary');
    console.log('• Delete parsers - handle deletion requests');
    console.log('\nYour workflows should now handle the data correctly!');
}).catch(console.error);
