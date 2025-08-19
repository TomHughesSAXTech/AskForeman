# CORS Configuration for AskForeman Admin Panel

## Issue
The admin panel at https://askforeman.saxtechnology.com cannot access Azure Functions and Azure Blob Storage due to CORS policy blocking the requests.

## Solution 1: Configure CORS on Azure Function App

### Via Azure Portal:
1. Go to Azure Portal (https://portal.azure.com)
2. Navigate to your Function App: `saxtech-functionapps2`
3. In the left menu, under "API", click on **CORS**
4. Add these allowed origins:
   - `https://askforeman.saxtechnology.com`
   - `http://localhost:*` (for local testing)
   - `https://*.azurestaticapps.net` (for your static web app)
5. Click **Save**

### Via Azure CLI:
```bash
az functionapp cors add --name saxtech-functionapps2 \
  --resource-group YourResourceGroup \
  --allowed-origins https://askforeman.saxtechnology.com
```

## Solution 2: Configure CORS on Azure Blob Storage

### Via Azure Portal:
1. Go to your Storage Account: `saxtechfcs`
2. In the left menu, under "Settings", click on **Resource sharing (CORS)**
3. Select the **Blob service** tab
4. Add a new CORS rule:
   - **Allowed origins**: `https://askforeman.saxtechnology.com`
   - **Allowed methods**: GET, HEAD, PUT, DELETE, OPTIONS
   - **Allowed headers**: *
   - **Exposed headers**: *
   - **Max age**: 3600
5. Click **Save**

### Via Azure CLI:
```bash
az storage cors add \
  --account-name saxtechfcs \
  --services b \
  --methods GET HEAD PUT DELETE OPTIONS \
  --origins https://askforeman.saxtechnology.com \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600
```

## Solution 3: Alternative - Use a Proxy Function

If CORS configuration doesn't work, create proxy functions in your Azure Function App that handle the storage operations server-side, avoiding CORS entirely.

## Testing
After configuring CORS:
1. Clear browser cache
2. Open Developer Console (F12)
3. Try the operations again
4. Look for successful responses without CORS errors

## Note on Client Folder Names
The client folder "b" should be capitalized as "B" to match the Azure folder structure. When creating clients, ensure consistent capitalization.
