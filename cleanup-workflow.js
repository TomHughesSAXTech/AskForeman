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

async function cleanupWorkflow() {
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
    
    const nodes = workflow.data.nodes;
    const connections = workflow.data.connections;
    
    console.log('🗑️ Removing broken and unnecessary nodes...');
    
    // Keep only the essential working nodes
    const keepNodes = [
      // Core chat functionality
      'Chat Webhook1',
      'Prepare Chat Input', 
      'Construction AI Agent',
      'Format Agent Response',
      'Chat Success Response',
      
      // AI Components
      'Azure OpenAI Model',
      'Construction Calculator Tool',
      'Google Search API',
      'Simple Memory',
      'Client Search',
      'Client Summary',
      
      // Working client management
      'List Clients Webhook',
      'List Blob Client Folders',
      'Parse Client List',
      'List Clients Success',
      
      'Create Client Webhook',
      'Prepare Client Data',
      'Create Folder Structure', 
      'Create Blob Folders',
      'Create Client Success',
      
      // Document upload (working)
      'Webhook - Document Upload',
      'Prepare File Data',
      'Upload Original to Azure',
      'Pass Through Data',
      'Convert Document',
      'Upload JSONL',
      'Upload Converted JSONL',
      'Prepare Metadata',
      'Upload Metadata',
      'Prepare Response',
      'Respond to Webhook1',
      
      // Error handling
      'Error Response'
    ];
    
    // Filter to keep only working nodes
    const cleanedNodes = nodes.filter(node => keepNodes.includes(node.name));
    
    console.log(`📊 Removed ${nodes.length - cleanedNodes.length} broken nodes, keeping ${cleanedNodes.length} working nodes`);
    
    // Clean up connections to only include connections between kept nodes
    const keptNodeIds = new Set(cleanedNodes.map(node => node.id));
    const cleanedConnections = {};
    
    Object.keys(connections).forEach(sourceNode => {
      const sourceNodeId = cleanedNodes.find(n => n.name === sourceNode)?.id;
      if (sourceNodeId && keptNodeIds.has(sourceNodeId)) {
        const nodeConnections = connections[sourceNode];
        if (nodeConnections.main) {
          const filteredConnections = nodeConnections.main.map(outputConnections => 
            outputConnections ? outputConnections.filter(conn => {
              const targetNodeId = cleanedNodes.find(n => n.name === conn.node)?.id;
              return targetNodeId && keptNodeIds.has(targetNodeId);
            }) : []
          );
          
          if (filteredConnections.some(conns => conns && conns.length > 0)) {
            cleanedConnections[sourceNode] = { main: filteredConnections };
          }
        }
        
        // Also handle AI connections
        if (nodeConnections.ai_languageModel) {
          cleanedConnections[sourceNode] = cleanedConnections[sourceNode] || {};
          cleanedConnections[sourceNode].ai_languageModel = nodeConnections.ai_languageModel;
        }
        if (nodeConnections.ai_tool) {
          cleanedConnections[sourceNode] = cleanedConnections[sourceNode] || {};
          cleanedConnections[sourceNode].ai_tool = nodeConnections.ai_tool;
        }
        if (nodeConnections.ai_memory) {
          cleanedConnections[sourceNode] = cleanedConnections[sourceNode] || {};
          cleanedConnections[sourceNode].ai_memory = nodeConnections.ai_memory;
        }
      }
    });
    
    console.log('🔧 Cleaned up connections between remaining nodes');
    
    // Create the cleaned workflow
    const cleanedWorkflow = {
      name: 'SAXTech Foreman AI - Cleaned',
      nodes: cleanedNodes,
      connections: cleanedConnections,
      settings: workflow.data.settings || {}
    };
    
    console.log('💾 Updating workflow...');
    
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
    
    console.log('✅ Workflow cleaned successfully!');
    
    // Activate the cleaned workflow
    console.log('🚀 Activating cleaned workflow...');
    
    const activateOptions = {
      hostname: 'workflows.saxtechnology.com',
      port: 443,
      path: `/api/v1/workflows/${WORKFLOW_ID}/activate`,
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    await httpsRequest(activateOptions);
    
    console.log('✅ Workflow activated!');
    console.log('🎉 CLEANUP COMPLETE!');
    console.log('');
    console.log('📍 Working endpoints:');
    console.log('- GET  /webhook/ask-foreman/clients/list (List clients)');
    console.log('- POST /webhook/ask-foreman/clients/create (Create client)');
    console.log('- POST /webhook/ask-foreman/chat (AI chat)');
    console.log('- POST /webhook/ask-foreman/upload (Document upload)');
    
  } catch (error) {
    console.error('❌ Error cleaning workflow:', error.message);
    process.exit(1);
  }
}

cleanupWorkflow();
