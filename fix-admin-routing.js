#!/usr/bin/env node

const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNGM1ZDRmMy0wODlkLTQ3MDQtOWMxNy01MDY3Njc4ZjIxYzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU2MTcyNjAwfQ.hB9qJWoV-aFJCcYR791HALl9iBiP8lgdDM8lmG--3sI';
const WORKFLOW_ID = 'nC5gkystSoLrrKkN';
const ROUTE_BY_ACTION_NODE_ID = 'f0cafd4e-0b04-4154-bbb8-6ecedd7d5574';

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

async function fixAdminRouting() {
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
    
    // Find the Route by Action switch node
    const nodes = workflow.data.nodes;
    const routeNodeIndex = nodes.findIndex(node => node.id === ROUTE_BY_ACTION_NODE_ID);
    
    if (routeNodeIndex === -1) {
      throw new Error('Route by Action node not found');
    }
    
    console.log('🔄 Updating routing configuration...');
    
    // Update the Route by Action switch node with proper routing
    nodes[routeNodeIndex].parameters = {
      mode: 'expression',
      rules: {
        values: [
          {
            conditions: {
              "and": [
                {
                  "leftValue": "={{ $json.params.action }}",
                  "rightValue": "clients",
                  "operator": {
                    "type": "string",
                    "operation": "equals",
                    "singleValue": true
                  }
                },
                {
                  "leftValue": "={{ $json.params.subaction }}",
                  "rightValue": "list",
                  "operator": {
                    "type": "string",
                    "operation": "equals",
                    "singleValue": true
                  }
                }
              ]
            },
            "renameOutput": false
          },
          {
            conditions: {
              "and": [
                {
                  "leftValue": "={{ $json.params.action }}",
                  "rightValue": "clients",
                  "operator": {
                    "type": "string",
                    "operation": "equals",
                    "singleValue": true
                  }
                },
                {
                  "leftValue": "={{ $json.params.subaction }}",
                  "rightValue": "update",
                  "operator": {
                    "type": "string",
                    "operation": "equals",
                    "singleValue": true
                  }
                }
              ]
            },
            "renameOutput": false

          },
          {
            conditions: {
              "and": [
                {
                  "leftValue": "={{ $json.params.action }}",
                  "rightValue": "clients",
                  "operator": {
                    "type": "string",
                    "operation": "equals",
                    "singleValue": true
                  }
                },
                {
                  "leftValue": "={{ $json.params.subaction }}",
                  "rightValue": "delete",
                  "operator": {
                    "type": "string",
                    "operation": "equals",
                    "singleValue": true
                  }
                }
              ]
            },
            "renameOutput": false
          },
          {
            conditions: {
              "and": [
                {
                  "leftValue": "={{ $json.params.action }}",
                  "rightValue": "reindex",
                  "operator": {
                    "type": "string",
                    "operation": "equals",
                    "singleValue": true
                  }
                }
              ]
            },
            "renameOutput": false
          }
        ]
      },
      fallbackOutput: 4
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
    
    console.log('✅ Admin routing fixed successfully!');
    console.log('🎉 The admin endpoints should now work properly');
    console.log('');
    console.log('Available endpoints:');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/clients/list');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/clients/update');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/clients/delete');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/reindex/documents');
    
  } catch (error) {
    console.error('❌ Error fixing admin routing:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixAdminRouting();
