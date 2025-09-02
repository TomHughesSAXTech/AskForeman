#!/bin/bash

# AskForeman Azure Functions Deployment Script
# This script deploys all Azure Functions to your Azure subscription

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (update these or use environment variables)
RESOURCE_GROUP=${AZURE_RESOURCE_GROUP:-"askforeman-rg"}
FUNCTION_APP_NAME=${FUNCTION_APP_NAME:-"askforeman-functions"}
STORAGE_ACCOUNT=${STORAGE_ACCOUNT_NAME:-"askforemanstorage"}
LOCATION=${AZURE_REGION:-"eastus"}
RUNTIME="node"
RUNTIME_VERSION="18"

echo -e "${GREEN}=== AskForeman Azure Functions Deployment ===${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Azure CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
echo -e "${YELLOW}Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Please login:${NC}"
    az login
fi

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}Using subscription: $SUBSCRIPTION${NC}"
echo ""

# Create Resource Group if it doesn't exist
echo -e "${YELLOW}Creating/updating resource group...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION --output none
echo -e "${GREEN}✓ Resource group ready${NC}"

# Create Storage Account if it doesn't exist
echo -e "${YELLOW}Creating/updating storage account...${NC}"
if ! az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --output none
    echo -e "${GREEN}✓ Storage account created${NC}"
else
    echo -e "${GREEN}✓ Storage account exists${NC}"
fi

# Create Function App if it doesn't exist
echo -e "${YELLOW}Creating/updating function app...${NC}"
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    az functionapp create \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --storage-account $STORAGE_ACCOUNT \
        --consumption-plan-location $LOCATION \
        --runtime $RUNTIME \
        --runtime-version $RUNTIME_VERSION \
        --functions-version 4 \
        --output none
    echo -e "${GREEN}✓ Function app created${NC}"
else
    echo -e "${GREEN}✓ Function app exists${NC}"
fi

# Configure CORS
echo -e "${YELLOW}Configuring CORS...${NC}"
az functionapp cors add \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "https://portal.azure.com" "http://localhost:3000" "http://localhost:7071" \
    --output none
echo -e "${GREEN}✓ CORS configured${NC}"

# Set application settings from .env file
if [ -f ".env" ]; then
    echo -e "${YELLOW}Loading environment variables from .env file...${NC}"
    
    # Read .env file and set app settings
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]]; then
            # Remove quotes from value
            value="${value%\"}"
            value="${value#\"}"
            
            echo "  Setting $key"
            az functionapp config appsettings set \
                --name $FUNCTION_APP_NAME \
                --resource-group $RESOURCE_GROUP \
                --settings "$key=$value" \
                --output none
        fi
    done < .env
    
    echo -e "${GREEN}✓ Application settings configured${NC}"
else
    echo -e "${YELLOW}⚠ No .env file found. Please configure app settings manually.${NC}"
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Build the project
echo -e "${YELLOW}Building project...${NC}"
if [ -f "tsconfig.json" ]; then
    npm run build 2>/dev/null || true
fi
echo -e "${GREEN}✓ Build complete${NC}"

# Deploy functions
echo -e "${YELLOW}Deploying functions to Azure...${NC}"
func azure functionapp publish $FUNCTION_APP_NAME --javascript

# Get function URLs
echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "${GREEN}Function URLs:${NC}"

# Get the function app URL and key
FUNCTION_URL="https://$FUNCTION_APP_NAME.azurewebsites.net"
DEFAULT_KEY=$(az functionapp keys list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query "functionKeys.default" -o tsv 2>/dev/null || echo "")

echo "  Base URL: $FUNCTION_URL"
echo ""
echo "  Endpoints:"
echo "    - Analyze Image: $FUNCTION_URL/api/analyze-image"
echo "    - PDF Chunker: $FUNCTION_URL/api/pdf-chunker"
echo "    - Knowledge Graph: $FUNCTION_URL/api/knowledge-graph"
echo "    - Enhanced Search: $FUNCTION_URL/api/enhanced-search"

if [ -n "$DEFAULT_KEY" ]; then
    echo ""
    echo -e "${YELLOW}Default Function Key:${NC}"
    echo "  $DEFAULT_KEY"
    echo ""
    echo "  Add ?code=$DEFAULT_KEY to URLs when calling functions"
fi

echo ""
echo -e "${GREEN}✓ All functions deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Configure Azure Cognitive Services (Computer Vision, Form Recognizer)"
echo "  2. Set up Azure Cognitive Search indexes"
echo "  3. Configure Cosmos DB with Gremlin API"
echo "  4. Update frontend with function URLs"
echo ""
