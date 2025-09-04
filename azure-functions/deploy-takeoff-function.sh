#!/bin/bash

# Azure Function App deployment script for ConvertDocumentJsonTakeoff
# This adds the 9th function to your existing saxtech-functionapps

echo "🚀 Starting deployment of ConvertDocumentJsonTakeoff to Azure Function App"

# Configuration
RESOURCE_GROUP="SAXTech-AI"
FUNCTION_APP_NAME="SAXTech-FunctionApps"
FUNCTION_NAME="ConvertDocumentJsonTakeoff"

# Azure AI Services Configuration (from estimator.html)
DOCUMENT_INTELLIGENCE_ENDPOINT="https://saxtechfcs-docintell.cognitiveservices.azure.com/"
DOCUMENT_INTELLIGENCE_KEY="4bb39c8e89144f9c808f2cfaa887e3d6"
COMPUTER_VISION_ENDPOINT="https://askforeman-vision.cognitiveservices.azure.com/"
COMPUTER_VISION_KEY="3afa37e3f6ec4cf891e0f5f6e5cf896c"

# Check if logged in to Azure
echo "📝 Checking Azure login status..."
az account show &>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

echo "✅ Logged in to Azure"

# Set the subscription (optional - remove if using default)
# az account set --subscription "your-subscription-id"

# Create a temporary directory for deployment
TEMP_DIR=$(mktemp -d)
echo "📁 Created temporary directory: $TEMP_DIR"

# Copy function files to temp directory
echo "📋 Copying function files..."
mkdir -p "$TEMP_DIR/ConvertDocumentJsonTakeoff"
cp "ConvertDocumentJsonTakeoff/index.js" "$TEMP_DIR/ConvertDocumentJsonTakeoff/"
cp "ConvertDocumentJsonTakeoff/function.json" "$TEMP_DIR/ConvertDocumentJsonTakeoff/"

# Create package.json for the function app if it doesn't exist
echo "📦 Creating package.json..."
cat > "$TEMP_DIR/package.json" <<EOF
{
  "name": "saxtech-functionapps",
  "version": "1.0.0",
  "description": "Azure Functions for ForemanAI",
  "scripts": {
    "start": "func start",
    "test": "echo \"No tests yet\""
  },
  "dependencies": {
    "@azure/storage-blob": "^12.17.0",
    "@azure/ai-form-recognizer": "^5.0.0",
    "@azure/cognitiveservices-computervision": "^8.2.0",
    "@azure/ms-rest-js": "^2.7.0"
  },
  "devDependencies": {}
}
EOF

# Create host.json if it doesn't exist
echo "📝 Creating host.json..."
cat > "$TEMP_DIR/host.json" <<EOF
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "functionTimeout": "00:10:00"
}
EOF

# Get existing app settings
echo "⚙️ Fetching existing app settings..."
EXISTING_SETTINGS=$(az functionapp config appsettings list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output json)

# Check if Computer Vision settings already exist
if echo "$EXISTING_SETTINGS" | grep -q "COMPUTER_VISION_ENDPOINT"; then
    echo "✅ Computer Vision settings already configured"
else
    echo "➕ Adding Computer Vision settings..."
    az functionapp config appsettings set \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
        "COMPUTER_VISION_ENDPOINT=$COMPUTER_VISION_ENDPOINT" \
        "COMPUTER_VISION_KEY=$COMPUTER_VISION_KEY" \
        --output none
fi

# Check if Document Intelligence settings already exist
if echo "$EXISTING_SETTINGS" | grep -q "DOCUMENT_INTELLIGENCE_ENDPOINT"; then
    echo "✅ Document Intelligence settings already configured"
else
    echo "➕ Adding Document Intelligence settings..."
    az functionapp config appsettings set \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
        "DOCUMENT_INTELLIGENCE_ENDPOINT=$DOCUMENT_INTELLIGENCE_ENDPOINT" \
        "DOCUMENT_INTELLIGENCE_KEY=$DOCUMENT_INTELLIGENCE_KEY" \
        --output none
fi

# Deploy the function
echo "🚀 Deploying function to Azure..."
cd "$TEMP_DIR"

# Install dependencies locally
echo "📦 Installing dependencies..."
npm install

# Create a zip file for deployment
echo "🗜️ Creating deployment package..."
zip -r deployment.zip . -x "*.git*" -x "node_modules/*" -x "local.settings.json"

# Deploy using zip deployment
echo "⬆️ Uploading to Azure Function App..."
az functionapp deployment source config-zip \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --src deployment.zip \
    --output table

# Clean up
echo "🧹 Cleaning up temporary files..."
cd -
rm -rf "$TEMP_DIR"

# Get the function URL
echo "🔗 Getting function URL..."
FUNCTION_KEY=$(az functionapp function keys list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --function-name "$FUNCTION_NAME" \
    --query "default" -o tsv 2>/dev/null)

if [ -z "$FUNCTION_KEY" ]; then
    echo "⏳ Function key not available yet. The function may still be initializing."
    echo "📌 Function URL will be: https://$FUNCTION_APP_NAME.azurewebsites.net/api/$FUNCTION_NAME"
else
    echo "✅ Function deployed successfully!"
    echo "📌 Function URL: https://$FUNCTION_APP_NAME.azurewebsites.net/api/$FUNCTION_NAME"
    echo "🔑 Function Key: $FUNCTION_KEY"
    echo ""
    echo "📝 Full URL with key:"
    echo "https://$FUNCTION_APP_NAME.azurewebsites.net/api/$FUNCTION_NAME?code=$FUNCTION_KEY"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Update your n8n workflow HTTP node to use the new function URL"
echo "2. Add 'takeoffParameters' to your request body for construction-specific analysis"
echo "3. The response will include calculations, materials, and line items ready for estimates"
echo ""
echo "✅ Deployment complete! Your Azure Function App now has 9 functions."
