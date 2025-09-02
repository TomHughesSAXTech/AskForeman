# AskForeman Azure Functions Deployment Script (PowerShell)
# This script deploys all Azure Functions to your Azure subscription

$ErrorActionPreference = "Stop"

# Configuration (update these or use environment variables)
$ResourceGroup = if ($env:AZURE_RESOURCE_GROUP) { $env:AZURE_RESOURCE_GROUP } else { "askforeman-rg" }
$FunctionAppName = if ($env:FUNCTION_APP_NAME) { $env:FUNCTION_APP_NAME } else { "askforeman-functions" }
$StorageAccount = if ($env:STORAGE_ACCOUNT_NAME) { $env:STORAGE_ACCOUNT_NAME } else { "askforemanstorage" }
$Location = if ($env:AZURE_REGION) { $env:AZURE_REGION } else { "eastus" }
$Runtime = "node"
$RuntimeVersion = "18"

Write-Host "=== AskForeman Azure Functions Deployment ===" -ForegroundColor Green
Write-Host ""

# Check if Azure CLI is installed
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "Azure CLI version: $($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Host "Azure CLI is not installed. Please install it first." -ForegroundColor Red
    Write-Host "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
}

# Check if logged in to Azure
Write-Host "Checking Azure login status..." -ForegroundColor Yellow
$account = az account show 2>$null
if (-not $account) {
    Write-Host "Not logged in to Azure. Please login:" -ForegroundColor Yellow
    az login
}

# Get current subscription
$subscription = az account show --query name -o tsv
Write-Host "Using subscription: $subscription" -ForegroundColor Green
Write-Host ""

# Create Resource Group if it doesn't exist
Write-Host "Creating/updating resource group..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --output none
Write-Host "✓ Resource group ready" -ForegroundColor Green

# Create Storage Account if it doesn't exist
Write-Host "Creating/updating storage account..." -ForegroundColor Yellow
$storageExists = az storage account show --name $StorageAccount --resource-group $ResourceGroup 2>$null
if (-not $storageExists) {
    az storage account create `
        --name $StorageAccount `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --output none
    Write-Host "✓ Storage account created" -ForegroundColor Green
} else {
    Write-Host "✓ Storage account exists" -ForegroundColor Green
}

# Create Function App if it doesn't exist
Write-Host "Creating/updating function app..." -ForegroundColor Yellow
$funcAppExists = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup 2>$null
if (-not $funcAppExists) {
    az functionapp create `
        --name $FunctionAppName `
        --resource-group $ResourceGroup `
        --storage-account $StorageAccount `
        --consumption-plan-location $Location `
        --runtime $Runtime `
        --runtime-version $RuntimeVersion `
        --functions-version 4 `
        --output none
    Write-Host "✓ Function app created" -ForegroundColor Green
} else {
    Write-Host "✓ Function app exists" -ForegroundColor Green
}

# Configure CORS
Write-Host "Configuring CORS..." -ForegroundColor Yellow
az functionapp cors add `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --allowed-origins "https://portal.azure.com" "http://localhost:3000" "http://localhost:7071" `
    --output none
Write-Host "✓ CORS configured" -ForegroundColor Green

# Set application settings from .env file
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env file..." -ForegroundColor Yellow
    
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Count -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim().Trim('"')
                
                Write-Host "  Setting $key"
                az functionapp config appsettings set `
                    --name $FunctionAppName `
                    --resource-group $ResourceGroup `
                    --settings "$key=$value" `
                    --output none
            }
        }
    }
    
    Write-Host "✓ Application settings configured" -ForegroundColor Green
} else {
    Write-Host "⚠ No .env file found. Please configure app settings manually." -ForegroundColor Yellow
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Build the project
Write-Host "Building project..." -ForegroundColor Yellow
if (Test-Path "tsconfig.json") {
    npm run build 2>$null
}
Write-Host "✓ Build complete" -ForegroundColor Green

# Deploy functions
Write-Host "Deploying functions to Azure..." -ForegroundColor Yellow
func azure functionapp publish $FunctionAppName --javascript

# Get function URLs
Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Function URLs:" -ForegroundColor Green

# Get the function app URL and key
$FunctionUrl = "https://$FunctionAppName.azurewebsites.net"
$DefaultKey = az functionapp keys list --name $FunctionAppName --resource-group $ResourceGroup --query "functionKeys.default" -o tsv 2>$null

Write-Host "  Base URL: $FunctionUrl"
Write-Host ""
Write-Host "  Endpoints:"
Write-Host "    - Analyze Image: $FunctionUrl/api/analyze-image"
Write-Host "    - PDF Chunker: $FunctionUrl/api/pdf-chunker"
Write-Host "    - Knowledge Graph: $FunctionUrl/api/knowledge-graph"
Write-Host "    - Enhanced Search: $FunctionUrl/api/enhanced-search"

if ($DefaultKey) {
    Write-Host ""
    Write-Host "Default Function Key:" -ForegroundColor Yellow
    Write-Host "  $DefaultKey"
    Write-Host ""
    Write-Host "  Add ?code=$DefaultKey to URLs when calling functions"
}

Write-Host ""
Write-Host "✓ All functions deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Configure Azure Cognitive Services (Computer Vision, Form Recognizer)"
Write-Host "  2. Set up Azure Cognitive Search indexes"
Write-Host "  3. Configure Cosmos DB with Gremlin API"
Write-Host "  4. Update frontend with function URLs"
Write-Host ""
