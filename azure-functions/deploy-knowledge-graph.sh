#!/bin/bash

# Deploy Knowledge Graph Function to SAXTech-FunctionApps

set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Deploying Knowledge Graph Function ===${NC}"
echo ""

# Configuration
RESOURCE_GROUP="SAXTech-AI"
FUNCTION_APP_NAME="SAXTech-FunctionApps"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Azure Functions Core Tools is installed
if ! command -v func &> /dev/null; then
    echo -e "${RED}Azure Functions Core Tools is not installed. Please install it first.${NC}"
    echo "Run: npm install -g azure-functions-core-tools@4"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create a temporary deployment package with just the knowledge-graph function
echo -e "${YELLOW}Creating deployment package...${NC}"
mkdir -p temp-deploy
cp -r knowledge-graph temp-deploy/
cp host.json temp-deploy/
cp package.json temp-deploy/
cp package-lock.json temp-deploy/
cp -r node_modules temp-deploy/

cd temp-deploy

# Deploy to Azure
echo -e "${YELLOW}Deploying to Azure Function App...${NC}"
func azure functionapp publish $FUNCTION_APP_NAME --javascript --nozip

cd ..
rm -rf temp-deploy

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "${GREEN}Knowledge Graph Function URL:${NC}"
echo "  https://${FUNCTION_APP_NAME}.azurewebsites.net/api/knowledge-graph"
echo ""
echo -e "${YELLOW}The function requires a function key for access.${NC}"
echo "Get the key from Azure Portal or run:"
echo "  az functionapp function keys list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --function-name knowledge-graph"
echo ""
echo -e "${GREEN}✓ Knowledge Graph function deployed successfully!${NC}"
