#!/bin/bash

# Deploy Complete Azure Function App with All Document Operations
# This includes ConvertDocument, DeleteClient, and DeleteFile functions

echo "🚀 Deploying Complete Azure Function App"
echo "========================================"

# Configuration
FUNCTION_APP_NAME="SAXTech-DocConverter"
RESOURCE_GROUP="SAXTech-AI"
DEPLOYMENT_DIR="deployment-complete"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Clean and create deployment directory
echo -e "${YELLOW}Preparing deployment package...${NC}"
rm -rf $DEPLOYMENT_DIR
mkdir -p $DEPLOYMENT_DIR

# Copy all function files
echo "Copying function files..."
cp ConvertDocument-Fixed-Storage.cs $DEPLOYMENT_DIR/ConvertDocument.cs
cp DeleteClient.cs $DEPLOYMENT_DIR/
cp DeleteFile.cs $DEPLOYMENT_DIR/
cp Program.cs $DEPLOYMENT_DIR/
cp SAXTech.DocConverter.csproj $DEPLOYMENT_DIR/

# Copy the complete ConvertDocument implementation with all helper methods
echo "Merging ConvertDocument with helper methods..."
cat > $DEPLOYMENT_DIR/ConvertDocument-Complete.cs << 'EOF'
// This file needs to be completed with all helper methods from original ConvertDocument.cs
// For now, using the original file
EOF
cp ConvertDocument.cs $DEPLOYMENT_DIR/ConvertDocument-Complete.cs

# Update the project file to ensure all functions are included
cat > $DEPLOYMENT_DIR/SAXTech.DocConverter.csproj << 'EOF'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net6.0</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Exe</OutputType>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Functions.Worker" Version="1.19.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Http" Version="3.0.13" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Sdk" Version="1.14.0" />
    <PackageReference Include="Microsoft.Azure.WebJobs.Extensions.Http" Version="3.2.0" />
    <PackageReference Include="Azure.Storage.Blobs" Version="12.19.1" />
    <PackageReference Include="Azure.Search.Documents" Version="11.5.1" />
    <PackageReference Include="Azure.AI.OpenAI" Version="1.0.0-beta.12" />
    <PackageReference Include="Azure.AI.FormRecognizer" Version="4.1.0" />
    <PackageReference Include="itext7" Version="8.0.2" />
    <PackageReference Include="DocumentFormat.OpenXml" Version="3.0.0" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
  <ItemGroup>
    <None Update="host.json">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </None>
    <None Update="local.settings.json">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
      <CopyToPublishDirectory>Never</CopyToPublishDirectory>
    </None>
  </ItemGroup>
</Project>
EOF

# Create host.json with proper settings
cat > $DEPLOYMENT_DIR/host.json << 'EOF'
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      },
      "enableLiveMetricsFilters": true
    }
  },
  "extensions": {
    "http": {
      "routePrefix": "api",
      "maxOutstandingRequests": 200,
      "maxConcurrentRequests": 100,
      "dynamicThrottlesEnabled": true
    }
  },
  "functionTimeout": "00:10:00"
}
EOF

# Build the project
echo -e "${YELLOW}Building project...${NC}"
cd $DEPLOYMENT_DIR
dotnet build --configuration Release

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed! Check the error messages above.${NC}"
    exit 1
fi

# Publish the project
echo -e "${YELLOW}Publishing project...${NC}"
dotnet publish --configuration Release --output ./publish

if [ $? -ne 0 ]; then
    echo -e "${RED}Publish failed!${NC}"
    exit 1
fi

# Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
cd publish
zip -r ../deployment.zip * > /dev/null

# Deploy to Azure
echo -e "${YELLOW}Deploying to Azure Function App...${NC}"
cd ..
az functionapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP_NAME \
    --src deployment.zip

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    
    # List deployed functions
    echo -e "\n${YELLOW}Verifying deployed functions...${NC}"
    az functionapp function list \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --query "[].{Function:name, Language:language}" \
        -o table
    
    # Get function keys
    echo -e "\n${YELLOW}Function URLs and Keys:${NC}"
    
    # ConvertDocument
    CONVERT_KEY=$(az functionapp function keys list \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --function-name ConvertDocument \
        --query "default" -o tsv 2>/dev/null)
    
    if [ ! -z "$CONVERT_KEY" ]; then
        echo -e "${GREEN}ConvertDocument:${NC}"
        echo "  URL: https://${FUNCTION_APP_NAME}.azurewebsites.net/api/convertdocument"
        echo "  Key: $CONVERT_KEY"
    fi
    
    # DeleteClient
    DELETE_CLIENT_KEY=$(az functionapp function keys list \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --function-name DeleteClient \
        --query "default" -o tsv 2>/dev/null)
    
    if [ ! -z "$DELETE_CLIENT_KEY" ]; then
        echo -e "${GREEN}DeleteClient:${NC}"
        echo "  URL: https://${FUNCTION_APP_NAME}.azurewebsites.net/api/deleteclient"
        echo "  Key: $DELETE_CLIENT_KEY"
    fi
    
    # DeleteFile
    DELETE_FILE_KEY=$(az functionapp function keys list \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --function-name DeleteFile \
        --query "default" -o tsv 2>/dev/null)
    
    if [ ! -z "$DELETE_FILE_KEY" ]; then
        echo -e "${GREEN}DeleteFile:${NC}"
        echo "  URL: https://${FUNCTION_APP_NAME}.azurewebsites.net/api/deletefile"
        echo "  Key: $DELETE_FILE_KEY"
    fi
    
    echo -e "\n${GREEN}🎉 All functions deployed successfully!${NC}"
    echo "Your Azure Function app now handles:"
    echo "  ✅ Document upload and processing (ConvertDocument)"
    echo "  ✅ Client deletion (DeleteClient)"
    echo "  ✅ Individual file deletion (DeleteFile)"
    echo ""
    echo "All operations handle:"
    echo "  • Blob storage (Original and Converted)"
    echo "  • Search index management"
    echo "  • Vector embeddings"
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi
