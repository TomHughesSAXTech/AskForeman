# Deployment Instructions for analyze-image Azure Function

## IMPORTANT: This will ADD a new function without affecting existing functions

### Prerequisites
1. Azure Function App already exists (askforeman-functions)
2. Azure Cognitive Services Computer Vision API (optional, but recommended for full functionality)

### Environment Variables Needed
Add these to your Azure Function App Configuration:
- `COMPUTER_VISION_KEY` - Your Azure Computer Vision API key
- `COMPUTER_VISION_ENDPOINT` - Your Computer Vision endpoint (e.g., https://yourname.cognitiveservices.azure.com/)

### Deployment Steps

#### Option 1: Deploy via Azure Portal
1. Zip the contents of this folder (analyze-image)
2. Go to Azure Portal > Your Function App
3. Go to "Functions" > "+ Create"
4. Upload the zip file
5. The function will be added at: `https://askforeman-functions.azurewebsites.net/api/analyze-image`

#### Option 2: Deploy via Azure CLI
```bash
# From the azure-functions/analyze-image directory
cd /Users/tom/Desktop/WARP/SAXTech-AskForeman-Site/azure-functions/analyze-image

# Install dependencies
npm install

# Zip the function
zip -r analyze-image.zip . -x "*.md"

# Deploy to Azure (this ADDS the function, doesn't replace anything)
az functionapp deployment source config-zip \
  --resource-group YOUR_RESOURCE_GROUP \
  --name askforeman-functions \
  --src analyze-image.zip \
  --slot production
```

#### Option 3: Deploy via VS Code
1. Install Azure Functions extension
2. Open this folder in VS Code
3. Right-click the folder and select "Deploy to Function App"
4. Select your existing Function App
5. Confirm deployment (it will ADD this function)

### Testing
After deployment, test with:
```bash
curl -X POST https://askforeman-functions.azurewebsites.net/api/analyze-image \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### What This Function Does
- Accepts image uploads from the chat interface
- Analyzes construction drawings and images
- Extracts text, measurements, and construction elements
- Returns structured data for the chat to use

### Troubleshooting
If the function doesn't work after deployment:
1. Check the Function App logs in Azure Portal
2. Ensure environment variables are set
3. Verify CORS is enabled for your domain
4. Check that the function appears in the Functions list

### Rolling Back
If you need to remove this function:
1. Go to Azure Portal > Function App > Functions
2. Select "analyze-image"
3. Click Delete
4. This will ONLY remove this specific function, not affect others
