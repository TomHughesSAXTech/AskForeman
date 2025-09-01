#!/usr/bin/env node

/**
 * Ask Foreman AI - N8N Workflow Deployment Configuration Script
 * 
 * This script helps configure the n8n workflow for different client deployments
 * by replacing placeholders with actual credentials and endpoints.
 * 
 * Usage:
 * 1. Edit the clientConfig object below with your client's specific settings
 * 2. Run: node deploy-config.js
 * 3. Import the generated workflow JSON into n8n
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CLIENT CONFIGURATION - EDIT THIS SECTION FOR EACH DEPLOYMENT
// ============================================================================

const clientConfig = {
  // Client Information
  clientName: "SAXTech",
  clientId: "saxtech",
  environment: "production", // 'development', 'staging', 'production'
  
  // Azure Storage Configuration
  azure: {
    storageAccount: "saxtechfcs",
    storageUrl: "https://saxtechfcs.blob.core.windows.net",
    containerName: "fcs-clients",
    sasToken: "sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2/rnIg="
  },
  
  // Azure Cognitive Search Configuration
  search: {
    serviceName: "fcssearchservice",
    serviceUrl: "https://fcssearchservice.search.windows.net",
    primaryIndex: "fcs-construction-docs-index-v2",
    vectorIndex: "fcs-vector-index",
    apiKey: "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv",
    apiVersion: "2021-04-30-Preview",
    vectorApiVersion: "2023-11-01"
  },
  
  // Azure Functions Configuration
  functions: {
    appName: "saxtech-docconverter",
    appUrl: "https://saxtech-docconverter.azurewebsites.net",
    convertEndpoint: "/api/ConvertDocument",
    functionKey: "KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng==",
    openAiKey: "" // Not needed - using Azure OpenAI instead
  },
  
  // N8N Webhook Configuration
  webhooks: {
    baseUrl: "https://n8n.saxtechnology.com/webhook",
    uploadPath: "/ask-foreman/upload",
    searchPath: "/ask-foreman/search",
    deletePath: "/ask-foreman/files/delete",
    reindexPath: "/ask-foreman/reindex"
  },
  
  // File Processing Configuration
  processing: {
    maxFileSize: 50 * 1024 * 1024, // 50MB max file size
    chunkThreshold: 10 * 1024 * 1024, // Files over 10MB will be chunked
    chunkSize: 5 * 1024 * 1024, // 5MB chunks
    supportedFormats: ['.pdf', '.docx', '.txt', '.md', '.csv', '.xlsx'],
    embeddingModel: "text-embedding-ada-002",
    tokensPerChunk: 1000
  },
  
  // Search Configuration
  search_settings: {
    maxResults: 10,
    hybridVectorWeight: 0.6,
    hybridKeywordWeight: 0.4,
    enableSemanticSearch: true,
    enableFacets: true
  },
  
  // Security & Rate Limiting
  security: {
    enableApiKeyAuth: true,
    enableRateLimiting: true,
    maxRequestsPerMinute: 60,
    allowedOrigins: ["https://askforeman.ai", "http://localhost:3000"]
  }
};

// ============================================================================
// WORKFLOW TEMPLATE PROCESSING - DO NOT EDIT BELOW THIS LINE
// ============================================================================

function loadWorkflowTemplate() {
  const templatePath = path.join(__dirname, 'n8n-workflow-template.json');
  
  // Check if template exists, if not create it from the enhanced workflow
  if (!fs.existsSync(templatePath)) {
    console.log('Creating workflow template...');
    createWorkflowTemplate();
  }
  
  return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
}

function createWorkflowTemplate() {
  // This creates a template from the enhanced workflow with placeholders
  const enhancedWorkflowPath = path.join(__dirname, 'n8n-workflow-complete-enhanced.json');
  
  if (!fs.existsSync(enhancedWorkflowPath)) {
    console.error('Enhanced workflow file not found!');
    process.exit(1);
  }
  
  let workflow = JSON.parse(fs.readFileSync(enhancedWorkflowPath, 'utf8'));
  
  // Convert to template by replacing specific values with placeholders
  const workflowString = JSON.stringify(workflow, null, 2);
  const template = workflowString
    .replace(/fcsstorage/g, '{{STORAGE_ACCOUNT}}')
    .replace(/fcs-clients/g, '{{CONTAINER_NAME}}')
    .replace(/fcssearchservice/g, '{{SEARCH_SERVICE}}')
    .replace(/fcs-construction-docs-index-v2/g, '{{PRIMARY_INDEX}}')
    .replace(/fcs-vector-index/g, '{{VECTOR_INDEX}}')
    .replace(/saxtech-docconverter/g, '{{FUNCTION_APP}}')
    .replace(/UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv/g, '{{SEARCH_API_KEY}}')
    .replace(/KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng==/g, '{{FUNCTION_KEY}}');
  
  fs.writeFileSync(path.join(__dirname, 'n8n-workflow-template.json'), template);
  console.log('Workflow template created successfully!');
}

function applyConfiguration(workflow, config) {
  let workflowString = JSON.stringify(workflow, null, 2);
  
  // Replace storage placeholders
  workflowString = workflowString
    .replace(/{{STORAGE_ACCOUNT}}/g, config.azure.storageAccount)
    .replace(/{{STORAGE_URL}}/g, config.azure.storageUrl)
    .replace(/{{CONTAINER_NAME}}/g, config.azure.containerName)
    .replace(/{{SAS_TOKEN}}/g, config.azure.sasToken);
  
  // Replace search placeholders
  workflowString = workflowString
    .replace(/{{SEARCH_SERVICE}}/g, config.search.serviceName)
    .replace(/{{SEARCH_URL}}/g, config.search.serviceUrl)
    .replace(/{{PRIMARY_INDEX}}/g, config.search.primaryIndex)
    .replace(/{{VECTOR_INDEX}}/g, config.search.vectorIndex)
    .replace(/{{SEARCH_API_KEY}}/g, config.search.apiKey)
    .replace(/{{SEARCH_API_VERSION}}/g, config.search.apiVersion)
    .replace(/{{VECTOR_API_VERSION}}/g, config.search.vectorApiVersion);
  
  // Replace function placeholders
  workflowString = workflowString
    .replace(/{{FUNCTION_APP}}/g, config.functions.appName)
    .replace(/{{FUNCTION_URL}}/g, config.functions.appUrl)
    .replace(/{{FUNCTION_KEY}}/g, config.functions.functionKey)
    .replace(/{{OPENAI_KEY}}/g, config.functions.openAiKey);
  
  // Replace webhook placeholders
  workflowString = workflowString
    .replace(/{{WEBHOOK_BASE}}/g, config.webhooks.baseUrl)
    .replace(/{{UPLOAD_PATH}}/g, config.webhooks.uploadPath)
    .replace(/{{SEARCH_PATH}}/g, config.webhooks.searchPath)
    .replace(/{{DELETE_PATH}}/g, config.webhooks.deletePath);
  
  // Replace processing configuration
  workflowString = workflowString
    .replace(/{{MAX_FILE_SIZE}}/g, config.processing.maxFileSize)
    .replace(/{{CHUNK_THRESHOLD}}/g, config.processing.chunkThreshold)
    .replace(/{{CHUNK_SIZE}}/g, config.processing.chunkSize);
  
  // Update workflow name with client info
  const updatedWorkflow = JSON.parse(workflowString);
  updatedWorkflow.name = `${config.clientName} - Ask Foreman AI Workflow (${config.environment})`;
  
  return updatedWorkflow;
}

function generateDeploymentFiles() {
  console.log('🚀 Ask Foreman AI - Workflow Deployment Configuration');
  console.log('======================================================');
  console.log(`Client: ${clientConfig.clientName}`);
  console.log(`Environment: ${clientConfig.environment}`);
  console.log('');
  
  // Load or create template
  const template = loadWorkflowTemplate();
  
  // Apply configuration
  const configuredWorkflow = applyConfiguration(template, clientConfig);
  
  // Generate output filename
  const outputFilename = `n8n-workflow-${clientConfig.clientId}-${clientConfig.environment}.json`;
  const outputPath = path.join(__dirname, outputFilename);
  
  // Write configured workflow
  fs.writeFileSync(outputPath, JSON.stringify(configuredWorkflow, null, 2));
  
  console.log(`✅ Workflow generated: ${outputFilename}`);
  
  // Generate environment variables file for n8n
  generateEnvFile();
  
  // Generate deployment documentation
  generateDeploymentDocs();
  
  console.log('');
  console.log('📋 Next Steps:');
  console.log('1. Review the generated workflow file');
  console.log('2. Import into n8n using the UI');
  console.log('3. Configure credentials in n8n');
  console.log('4. Test with a sample file');
  console.log('5. Update your application webhook URLs');
}

function generateEnvFile() {
  const envContent = `# N8N Environment Variables for ${clientConfig.clientName}
# Generated: ${new Date().toISOString()}

# Azure Storage
AZURE_STORAGE_ACCOUNT=${clientConfig.azure.storageAccount}
AZURE_STORAGE_URL=${clientConfig.azure.storageUrl}
AZURE_CONTAINER_NAME=${clientConfig.azure.containerName}
AZURE_SAS_TOKEN=${clientConfig.azure.sasToken}

# Azure Search
AZURE_SEARCH_SERVICE=${clientConfig.search.serviceName}
AZURE_SEARCH_URL=${clientConfig.search.serviceUrl}
AZURE_SEARCH_API_KEY=${clientConfig.search.apiKey}
AZURE_SEARCH_PRIMARY_INDEX=${clientConfig.search.primaryIndex}
AZURE_SEARCH_VECTOR_INDEX=${clientConfig.search.vectorIndex}

# Azure Functions
AZURE_FUNCTION_APP=${clientConfig.functions.appName}
AZURE_FUNCTION_URL=${clientConfig.functions.appUrl}
AZURE_FUNCTION_KEY=${clientConfig.functions.functionKey}

# OpenAI (for embeddings)
OPENAI_API_KEY=${clientConfig.functions.openAiKey}

# Webhook Configuration
N8N_WEBHOOK_BASE_URL=${clientConfig.webhooks.baseUrl}
`;
  
  const envPath = path.join(__dirname, `.env.${clientConfig.clientId}`);
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Environment file generated: .env.${clientConfig.clientId}`);
}

function generateDeploymentDocs() {
  const docsContent = `# ${clientConfig.clientName} - Ask Foreman AI Deployment Documentation

## Generated: ${new Date().toISOString()}

## Environment: ${clientConfig.environment}

## Configuration Summary

### Azure Resources
- **Storage Account**: ${clientConfig.azure.storageAccount}
- **Container**: ${clientConfig.azure.containerName}
- **Search Service**: ${clientConfig.search.serviceName}
- **Function App**: ${clientConfig.functions.appName}

### Indexes
- **Primary Index**: ${clientConfig.search.primaryIndex}
- **Vector Index**: ${clientConfig.search.vectorIndex}

### Endpoints
- **Upload**: ${clientConfig.webhooks.baseUrl}${clientConfig.webhooks.uploadPath}
- **Search**: ${clientConfig.webhooks.baseUrl}${clientConfig.webhooks.searchPath}
- **Delete**: ${clientConfig.webhooks.baseUrl}${clientConfig.webhooks.deletePath}

### Processing Limits
- **Max File Size**: ${clientConfig.processing.maxFileSize / (1024 * 1024)}MB
- **Chunk Threshold**: ${clientConfig.processing.chunkThreshold / (1024 * 1024)}MB
- **Chunk Size**: ${clientConfig.processing.chunkSize / (1024 * 1024)}MB

## Deployment Steps

1. **Import Workflow**
   - Open n8n interface
   - Go to Workflows > Import
   - Select \`n8n-workflow-${clientConfig.clientId}-${clientConfig.environment}.json\`

2. **Configure Credentials in n8n**
   - Azure Blob Storage: Add connection string or SAS token
   - HTTP Request nodes: Credentials are embedded

3. **Test Endpoints**
   \`\`\`bash
   # Test upload
   curl -X POST ${clientConfig.webhooks.baseUrl}${clientConfig.webhooks.uploadPath} \\
     -H "Content-Type: application/json" \\
     -d '{"file": "base64_content", "fileName": "test.pdf", "client": "test"}'
   
   # Test search
   curl -X POST ${clientConfig.webhooks.baseUrl}${clientConfig.webhooks.searchPath} \\
     -H "Content-Type: application/json" \\
     -d '{"query": "test query", "client": "test"}'
   \`\`\`

4. **Update Application Configuration**
   - Update webhook URLs in your application
   - Configure CORS if needed
   - Set up monitoring

## Security Checklist
- [ ] API keys are securely stored
- [ ] SAS tokens have appropriate permissions
- [ ] Function keys are not exposed
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] SSL/TLS is enforced

## Monitoring
- Check n8n execution logs
- Monitor Azure Storage metrics
- Review Search Service query analytics
- Track Function App performance

## Support
For issues or questions, refer to the main documentation or contact support.
`;
  
  const docsPath = path.join(__dirname, `DEPLOYMENT-${clientConfig.clientId}.md`);
  fs.writeFileSync(docsPath, docsContent);
  console.log(`✅ Deployment docs generated: DEPLOYMENT-${clientConfig.clientId}.md`);
}

// Run the configuration
generateDeploymentFiles();
