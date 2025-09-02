# AskForeman Deployment Instructions

## 🚀 Production Deployment Complete!

Your Azure Functions and services have been successfully deployed. Here's what was created:

### Azure Resources Created:
- **Resource Group**: askforeman-rg
- **Function App**: askforeman-functions.azurewebsites.net
- **Storage Account**: askforemanstorage24
- **Computer Vision**: askforeman-vision
- **Form Recognizer**: askforeman-formrecognizer
- **Cosmos DB**: askforeman-cosmos (with Gremlin API)
- **Cognitive Search**: askforeman-search
- **Application Insights**: askforeman-functions

### Storage Containers Created:
- documents
- document-chunks
- images

## 🔑 Important: Configure Function Key

The Azure Function key needs to be configured securely. **DO NOT** commit the key to GitHub.

### Option 1: Configure in Azure Static Web Apps (Recommended for Production)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App
3. Go to Configuration → Application Settings
4. Add a new application setting:
   - **Name**: `AZURE_FUNCTION_KEY`
   - **Value**: `[Get your key from Azure Portal → Function App → App Keys]`
5. Save the configuration

### Option 2: Use a Config File (For Local Development Only)

1. Copy the config template:
   ```bash
   cp js/config.js.example js/config.js
   ```

2. Edit `js/config.js` and add your function key:
   ```javascript
   window.AZURE_FUNCTION_KEY = 'YOUR_FUNCTION_KEY_HERE';
   ```

3. To get your function key:
   ```bash
   az functionapp keys list --name askforeman-functions --resource-group askforeman-rg --query masterKey -o tsv
   ```

3. Add script tag to index.html before chat-image-handler.js:
   ```html
   <script src="js/config.js"></script>
   <script src="js/chat-image-handler.js"></script>
   ```

4. **Important**: Add `js/config.js` to `.gitignore` to prevent committing the key

## 📋 Function URLs

Your Azure Functions are available at:

- **Base URL**: https://askforeman-functions.azurewebsites.net
- **Analyze Image**: https://askforeman-functions.azurewebsites.net/api/analyze-image
- **PDF Chunker**: https://askforeman-functions.azurewebsites.net/api/pdf-chunker
- **Knowledge Graph**: https://askforeman-functions.azurewebsites.net/api/knowledge-graph
- **Enhanced Search**: https://askforeman-functions.azurewebsites.net/api/enhanced-search

## ✨ Features Now Available

### Frontend Features:
- **Image Paste**: Paste images directly from clipboard
- **Drag & Drop**: Drag files onto the page to attach
- **File Attachment**: Click the 📎 button to select files
- **Enhanced Search**: Press `Ctrl+K` (or `Cmd+K` on Mac) to open advanced search
- **Auto-Analysis**: Pasted drawings are automatically analyzed

### Backend Capabilities:
- **Computer Vision**: Analyzes pasted drawings and images
- **PDF Chunking**: Automatically splits large PDFs (80-100MB)
- **Knowledge Graph**: Extracts entities and creates cross-client connections
- **Enhanced Search**: Search across all clients with AI insights

## 🔧 Testing the Integration

1. **Test Image Analysis**:
   - Copy any image to clipboard
   - Paste in the chat area
   - Should see analysis results

2. **Test PDF Processing**:
   - Click the 📎 button
   - Select a PDF file
   - Should see processing status

3. **Test Enhanced Search**:
   - Press `Ctrl+K`
   - Enter a search query
   - Should see cross-client results

## 📊 Monitoring

View your function logs and metrics:
- **Application Insights**: [Azure Portal](https://portal.azure.com) → askforeman-functions (Application Insights)
- **Function Logs**: [Azure Portal](https://portal.azure.com) → askforeman-functions → Functions → Monitor

## 🛠️ Troubleshooting

If functions are not working:

1. **Check CORS Settings**:
   ```bash
   az functionapp cors show --name askforeman-functions --resource-group askforeman-rg
   ```

2. **View Function Logs**:
   ```bash
   func azure functionapp logstream askforeman-functions
   ```

3. **Test Function Directly**:
   ```bash
   curl https://askforeman-functions.azurewebsites.net/api/enhanced-search?code=YOUR_KEY
   ```

## 📝 Next Steps

1. **Configure OpenAI API** (if not already done):
   - Add your OpenAI API key to Function App settings
   - Required for knowledge graph and enhanced insights

2. **Create Search Indexes**:
   - Set up indexes in Azure Cognitive Search
   - Required for full search functionality

3. **Monitor Usage**:
   - Set up alerts in Application Insights
   - Monitor costs in Azure Cost Management

## 🔐 Security Notes

- Function keys are automatically rotated by Azure
- All services use managed identities where possible
- Storage accounts have public access disabled
- CORS is configured for your specific domains

## 📞 Support

For issues or questions:
- Check Application Insights for errors
- Review function logs in Azure Portal
- Contact SAXTech support team

---

**Deployment Date**: September 2, 2025
**Deployed By**: SAXTech Azure Subscription
**Environment**: Production
