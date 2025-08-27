#!/usr/bin/env node

const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNGM1ZDRmMy0wODlkLTQ3MDQtOWMxNy01MDY3Njc4ZjIxYzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU2MTcyNjAwfQ.hB9qJWoV-aFJCcYR791HALl9iBiP8lgdDM8lmG--3sI';
const WORKFLOW_ID = 'nC5gkystSoLrrKkN';

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

async function fixRouting() {
  try {
    console.log('🔄 Fetching current workflow...');
    
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
    const routeNode = nodes.find(node => node.name === 'Route by Action' && node.type === 'n8n-nodes-base.switch');
    
    if (!routeNode) {
      throw new Error('Route by Action switch node not found');
    }
    
    console.log('🔄 Fixing parameter references in routing...');
    
    // The issue is that the webhook uses path parameters like {{$parameter["action"]}}
    // but the switch node is looking for $json.params.action
    // We need to update the switch to use $parameter["action"] instead
    
    routeNode.parameters = {
      mode: "rules",
      rules: {
        values: [
          {
            conditions: {
              and: [
                {
                  leftValue: "={{ $parameter['action'] }}",
                  rightValue: "clients",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                },
                {
                  leftValue: "={{ $parameter['subaction'] }}",
                  rightValue: "list",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                }
              ]
            }
          },
          {
            conditions: {
              and: [
                {
                  leftValue: "={{ $parameter['action'] }}",
                  rightValue: "clients",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                },
                {
                  leftValue: "={{ $parameter['subaction'] }}",
                  rightValue: "update",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                }
              ]
            }
          },
          {
            conditions: {
              and: [
                {
                  leftValue: "={{ $parameter['action'] }}",
                  rightValue: "clients",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                },
                {
                  leftValue: "={{ $parameter['subaction'] }}",
                  rightValue: "delete",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                }
              ]
            }
          },
          {
            conditions: {
              and: [
                {
                  leftValue: "={{ $parameter['action'] }}",
                  rightValue: "reindex",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                }
              ]
            }
          }
        ]
      }
    };
    
    // Clean the workflow data
    const cleanedWorkflow = {
      name: workflow.data.name,
      nodes: workflow.data.nodes,
      connections: workflow.data.connections,
      settings: workflow.data.settings || {}
    };
    
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
    
    console.log('✅ Admin routing FIXED! Path parameters now properly referenced.');
    console.log('🎉 Test the admin endpoints now:');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/clients/list');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/clients/update');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/clients/delete');
    console.log('- POST https://workflows.saxtechnology.com/webhook/ask-foreman/admin/reindex/documents');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixRouting();
