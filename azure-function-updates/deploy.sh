#!/bin/bash

# Deploy Enhanced Document Converter to Azure Function
# This script uploads the new ConvertDocument function with Office support

echo "🚀 Deploying Enhanced Document Converter with Office Support..."
echo "============================================================"

# Configuration
FUNCTION_APP="SAXTech-DocConverter"
RESOURCE_GROUP="SAXTech-AI"
KUDU_URL="https://saxtech-docconverter.scm.azurewebsites.net"
KUDU_USER='$SAXTech-DocConverter'
KUDU_PASS='DiB5peNwREDyqm0zkfR1xznqrXGK7YYW1xcno52K26SkhL1EowMMiKs8mYku'

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Checking Azure CLI login...${NC}"
if ! az account show &>/dev/null; then
    echo -e "${RED}Not logged in. Please run: az login${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Logged in${NC}"

echo -e "${YELLOW}Step 2: Creating deployment package...${NC}"
mkdir -p deployment_package
cp ConvertDocument.cs deployment_package/
cp SAXTech.DocConverter.csproj deployment_package/
cp host.json deployment_package/

echo -e "${YELLOW}Step 3: Building the function locally...${NC}"
cd deployment_package
dotnet restore
dotnet build --configuration Release
cd ..
echo -e "${GREEN}✓ Build complete${NC}"

echo -e "${YELLOW}Step 4: Creating ZIP package...${NC}"
cd deployment_package
zip -r ../function_deploy.zip . -x "*.git*" -x "obj/*" -x "bin/Debug/*"
cd ..
echo -e "${GREEN}✓ Package created${NC}"

echo -e "${YELLOW}Step 5: Deploying to Azure...${NC}"
az functionapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP \
    --src function_deploy.zip \
    --build-remote true

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment successful!${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 6: Restarting Function App...${NC}"
az functionapp restart --name $FUNCTION_APP --resource-group $RESOURCE_GROUP
echo -e "${GREEN}✓ Function app restarted${NC}"

echo -e "${YELLOW}Step 7: Verifying deployment...${NC}"
sleep 10
FUNCTION_STATUS=$(az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP --query state -o tsv)
echo -e "Function App Status: ${GREEN}$FUNCTION_STATUS${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}What's New:${NC}"
echo "  ✅ PDF support (existing)"
echo "  ✅ Word document support (.docx, .doc)"
echo "  ✅ Excel spreadsheet support (.xlsx, .xls)"
echo "  ✅ PowerPoint support (.pptx, .ppt)"
echo "  ✅ Text file support (.txt, .md, .csv)"
echo "  ✅ Automatic text extraction"
echo "  ✅ Vector embeddings generation"
echo "  ✅ Azure Cognitive Search indexing"
echo "  ✅ Document chunking for large files"
echo ""
echo -e "${YELLOW}Test the function:${NC}"
echo "  URL: https://$FUNCTION_APP.azurewebsites.net/api/ConvertDocument"
echo ""
echo -e "${YELLOW}Required Headers:${NC}"
echo "  x-functions-key: [Your function key]"
echo ""

# Clean up
rm -f function_deploy.zip

echo -e "${GREEN}Done! Your function now supports Office files with full vectorization and search indexing.${NC}"
