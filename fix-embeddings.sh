#!/bin/bash

# Fix Embeddings Configuration Script
# This configures your Azure Function App with the correct OpenAI settings

echo "================================================"
echo "🔧 Fixing Embeddings Configuration"
echo "================================================"
echo ""

# Your Azure OpenAI Details from the screenshot
OPENAI_ENDPOINT="https://saxtechopenai.openai.azure.com/"
OPENAI_KEY="9NjdW7TV9gDnnd6qC4fZiD2Vxyfiuyjy8rMvb18DiXhPet5RvfcHHJQOJ59BHACHVfTw5XJ3w3AAAABACOGPfC5"
DEPLOYMENT_NAME="text-embedding-ada-002"
FUNCTION_APP_NAME="saxtech-functionapps"

echo "📋 Configuration Details:"
echo "  Endpoint: $OPENAI_ENDPOINT"
echo "  Deployment: $DEPLOYMENT_NAME"
echo "  Function App: $FUNCTION_APP_NAME"
echo ""

# Option 1: Using Azure CLI (if you have it configured)
echo "Option 1: Configuring via Azure CLI..."
echo "----------------------------------------"

# Check if Azure CLI is installed and logged in
if command -v az &> /dev/null; then
    echo "Azure CLI found. Attempting to configure..."
    
    # Get the resource group
    RG=$(az functionapp list --query "[?name=='$FUNCTION_APP_NAME'].resourceGroup" -o tsv 2>/dev/null)
    
    if [ -z "$RG" ]; then
        echo "⚠️  Could not find resource group automatically."
        echo "Please run this command manually with your resource group:"
        echo ""
        echo "az functionapp config appsettings set \\"
        echo "  --name $FUNCTION_APP_NAME \\"
        echo "  --resource-group <YOUR-RESOURCE-GROUP> \\"
        echo "  --settings \\"
        echo "    AZURE_OPENAI_ENDPOINT=\"$OPENAI_ENDPOINT\" \\"
        echo "    AZURE_OPENAI_KEY=\"$OPENAI_KEY\" \\"
        echo "    AZURE_OPENAI_DEPLOYMENT_NAME=\"$DEPLOYMENT_NAME\""
    else
        echo "Found resource group: $RG"
        echo "Updating Function App settings..."
        
        az functionapp config appsettings set \
          --name $FUNCTION_APP_NAME \
          --resource-group $RG \
          --settings \
            AZURE_OPENAI_ENDPOINT="$OPENAI_ENDPOINT" \
            AZURE_OPENAI_KEY="$OPENAI_KEY" \
            AZURE_OPENAI_DEPLOYMENT_NAME="$DEPLOYMENT_NAME" \
          2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Function App settings updated successfully!"
        else
            echo "❌ Failed to update settings. Please use the Azure Portal method below."
        fi
    fi
else
    echo "Azure CLI not found. Use the Azure Portal method below."
fi

echo ""
echo "Option 2: Manual Configuration via Azure Portal"
echo "-----------------------------------------------"
echo "1. Go to: https://portal.azure.com"
echo "2. Navigate to: Function Apps → $FUNCTION_APP_NAME"
echo "3. Go to: Settings → Configuration"
echo "4. Add/Update these Application Settings:"
echo ""
echo "   AZURE_OPENAI_ENDPOINT = $OPENAI_ENDPOINT"
echo "   AZURE_OPENAI_KEY = $OPENAI_KEY"
echo "   AZURE_OPENAI_DEPLOYMENT_NAME = $DEPLOYMENT_NAME"
echo ""
echo "5. Click 'Save' and restart the Function App"

echo ""
echo "================================================"
echo "🧪 Testing Embeddings After Configuration"
echo "================================================"
echo ""

# Create a test document
TEST_CONTENT="Testing embeddings generation with Azure OpenAI. This document contains information about construction and HVAC systems."
BASE64_CONTENT=$(echo "$TEST_CONTENT" | base64 | tr -d '\n')

echo "Testing document upload with embeddings..."
RESPONSE=$(curl -s -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$BASE64_CONTENT\",
    \"fileName\": \"embeddings-fix-test-$(date +%s).txt\",
    \"mimeType\": \"text/plain\",
    \"category\": \"test\",
    \"clientName\": \"EmbeddingFixTest\",
    \"client\": \"EmbeddingFixTest\"
  }" \
  --max-time 10 2>/dev/null)

if echo "$RESPONSE" | grep -q "success.*true"; then
    echo "✅ Document uploaded successfully"
    
    # Check for embeddings
    if echo "$RESPONSE" | grep -q "hasEmbeddings.*true"; then
        echo "✅ EMBEDDINGS ARE NOW WORKING!"
    else
        echo "⚠️  Embeddings not confirmed yet. The Function App may need a restart."
        echo "   Run: az functionapp restart --name $FUNCTION_APP_NAME --resource-group <YOUR-RG>"
    fi
else
    echo "⚠️  Upload test failed. Configuration may take a few minutes to propagate."
fi

echo ""
echo "================================================"
echo "📝 Next Steps"
echo "================================================"
echo ""
echo "1. If using Azure CLI method:"
echo "   - Wait 2-3 minutes for settings to propagate"
echo "   - Restart the Function App"
echo ""
echo "2. Test embeddings are working:"
echo "   - Upload a new document"
echo "   - Check admin.html → Vector Info column"
echo "   - Should show '1536D (Ada-002)'"
echo ""
echo "3. Re-index existing documents:"
echo "   - Use admin.html to trigger re-indexing"
echo "   - Or upload documents again to generate embeddings"
echo ""
echo "4. Verify semantic search:"
echo "   - Test searches with synonyms"
echo "   - Example: Search 'cooling' should find 'HVAC' documents"
echo ""
echo "Configuration complete!"
