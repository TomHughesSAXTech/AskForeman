# Deploy Azure Functions to SAXTech-DocConverter

## The Problem
Your Azure Functions are created locally but NOT deployed to Azure. That's why you're getting 404 errors.

## Quick Deploy Options

### Option 1: Using Azure Functions Core Tools (Recommended)
```bash
# Install Azure Functions Core Tools if not installed
brew tap azure/functions
brew install azure-functions-core-tools@4

# Navigate to your function app directory
cd /Users/tom/Desktop/WARP/SAXTech-AskForeman-Site/azure-functions

# Deploy to Azure
func azure functionapp publish SAXTech-DocConverter
```

### Option 2: Using Azure CLI
```bash
# Install Azure CLI if not installed
brew install azure-cli

# Login to Azure
az login

# Deploy the functions
az functionapp deployment source config-zip \
  --resource-group <your-resource-group> \
  --name SAXTech-DocConverter \
  --src azure-functions.zip
```

### Option 3: Deploy via VS Code
1. Install the Azure Functions extension in VS Code
2. Open the azure-functions folder
3. Click the Azure icon in the sidebar
4. Right-click on your function app and select "Deploy to Function App"

## Pre-Deployment Checklist

1. **Check your local.settings.json** (create if doesn't exist):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "your-storage-connection-string",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "STORAGE_CONNECTION_STRING": "your-storage-connection-string",
    "SEARCH_SERVICE_NAME": "fcssearchservice",
    "SEARCH_ADMIN_KEY": "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv",
    "SEARCH_INDEX_NAME": "fcs-construction-docs-index-v2",
    "OPENAI_API_KEY": "your-openai-key",
    "OPENAI_ENDPOINT": "your-openai-endpoint"
  }
}
```

2. **Ensure requirements.txt exists** in azure-functions folder:
```txt
azure-functions
azure-storage-blob
azure-search-documents
azure-ai-textanalytics
azure-ai-formrecognizer
PyPDF2
python-docx
openai
numpy
```

3. **Verify function structure**:
```
azure-functions/
├── ConvertDocument/
│   ├── __init__.py
│   └── function.json
├── DeleteClient/
│   ├── __init__.py
│   └── function.json
├── DeleteFile/
│   ├── __init__.py
│   └── function.json
├── host.json
├── requirements.txt
└── local.settings.json
```

## After Deployment

Once deployed, your functions will be available at:
- `https://saxtech-docconverter.azurewebsites.net/api/ConvertDocument`
- `https://saxtech-docconverter.azurewebsites.net/api/DeleteClient`
- `https://saxtech-docconverter.azurewebsites.net/api/DeleteFile`

## Test After Deployment
```bash
# Test if ConvertDocument is accessible
curl -X POST "https://saxtech-docconverter.azurewebsites.net/api/ConvertDocument" \
  -H "x-functions-key: GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA==" \
  -H "Content-Type: application/json" \
  -d '{"test":"hello"}'
```

## Important Notes
- The function app is running (we confirmed this)
- The functions just need to be deployed
- Your n8n workflow URLs are correct (once deployed)
- The API key is already configured

## If You Need to Create/Update Functions First

Since you have multiple versions, use the enhanced version:
```bash
cd /Users/tom/Desktop/WARP/SAXTech-AskForeman-Site
cp -r azure-functions azure-functions-deploy
cd azure-functions-deploy

# Make sure all functions are using the enhanced code
# Then deploy
func azure functionapp publish SAXTech-DocConverter
```
