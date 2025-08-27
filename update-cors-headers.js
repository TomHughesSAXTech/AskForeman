#!/usr/bin/env node

const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNGM1ZDRmMy0wODlkLTQ3MDQtOWMxNy01MDY3Njc4ZjIxYzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU2MTcyNjAwfQ.hB9qJWoV-aFJCcYR791HALl9iBiP8lgdDM8lmG--3sI';
const WORKFLOW_ID = 'nC5gkystSoLrrKkN';
const RESPOND_TO_WEBHOOK_NODE_ID = '01128a0b-f4e4-4e3e-acb2-49f25cd5102c';

function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ 
            statusCode: res.statusCode, 
            data: JSON.parse(body),
            headers: res.headers 
          });
        } catch (e) {
          resolve({ 
            statusCode: res.statusCode, 
            data: body,
            headers: res.headers 
          });
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

async function updateCORSHeaders() {
  try {
    console.log('🔄 Fetching current workflow...');
    
    // Get current workflow
    const getOptions = {
      hostname: 'workflows.saxtechnology.com',
      port: 443,
      path: `/api/v1/workflows/${WORKFLOW_ID}`,
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    const workflow = await httpsRequest(getOptions);
    
    if (workflow.statusCode !== 200) {
      throw new Error(`Failed to fetch workflow: ${workflow.statusCode}`);
    }
    
    console.log('✅ Workflow fetched successfully');
    
    // Find and update the Respond to Webhook node
    const nodes = workflow.data.nodes;
    const nodeIndex = nodes.findIndex(node => node.id === RESPOND_TO_WEBHOOK_NODE_ID);
    
    if (nodeIndex === -1) {
      throw new Error('Respond to Webhook node not found');
    }
    
    console.log('🔄 Updating CORS headers...');
    
    // Update the node with permissive CORS headers
    nodes[nodeIndex].parameters.options = {
      ...nodes[nodeIndex].parameters.options,
      responseHeaders: {
        entries: [
          {
            name: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            name: 'Access-Control-Allow-Methods',
            value: 'POST, GET, OPTIONS, PUT, DELETE'
          },
          {
            name: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With'
          },
          {
            name: 'Access-Control-Max-Age',
            value: '86400'
          }
        ]
      }
    };
    
    // Clean the workflow data - only send essential fields
    const cleanedWorkflow = {
      name: workflow.data.name,
      nodes: workflow.data.nodes,
      connections: workflow.data.connections,
      settings: workflow.data.settings || {}
    };
    
    // Update the workflow
    const updateOptions = {
      hostname: 'workflows.saxtechnology.com',
      port: 443,
      path: `/api/v1/workflows/${WORKFLOW_ID}`,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    const updateResult = await httpsRequest(updateOptions, cleanedWorkflow);
    
    if (updateResult.statusCode !== 200) {
      throw new Error(`Failed to update workflow: ${updateResult.statusCode} - ${JSON.stringify(updateResult.data)}`);
    }
    
    console.log('✅ CORS headers updated successfully!');
    console.log('🎉 The admin panel should now work without CORS issues');
    
  } catch (error) {
    console.error('❌ Error updating CORS headers:', error.message);
    process.exit(1);
  }
}

// Run the update
updateCORSHeaders();
