# AskForeman Admin Panel Deployment Guide

## Important: Handling Sensitive Keys

The admin panel requires an Azure Function key for the client deletion feature. This key must NOT be committed to GitHub.

### Local Development Setup

1. Copy `admin-config.template.js` to `admin-config.js`
2. Edit `admin-config.js` and replace `YOUR_FUNCTION_KEY_HERE` with your actual Azure Function key
3. The `.gitignore` file ensures `admin-config.js` is never committed

### Production Deployment

Since GitHub will reject commits containing the Azure Function key, you have two options:

#### Option 1: Manual Configuration (Recommended for Static Sites)
1. Deploy the admin.html file without the config file
2. After deployment, manually create `admin-config.js` in your Azure Static Web App:
   - Go to Azure Portal > Your Static Web App
   - Use the Storage Explorer or FTP to add the admin-config.js file
   - Or use Azure CLI to upload the file directly

#### Option 2: Use Azure Application Settings
1. In Azure Portal, go to your Static Web App
2. Navigate to Configuration > Application settings
3. Add a new setting: `AZURE_FUNCTION_KEY` with your function key value
4. Modify the admin.html to read from environment variables (requires backend API)

#### Option 3: Azure Key Vault Integration
For production environments, consider using Azure Key Vault:
1. Store the function key in Azure Key Vault
2. Use managed identity to access the key
3. Implement a backend API to securely fetch the key

### Getting the Azure Function Key

1. Go to Azure Portal
2. Navigate to: saxtech-functionapps2 > Functions > DeleteClientFunction
3. Click on "Function Keys"
4. Copy the default function key

### Files Overview

- `admin.html` - Main admin panel (safe to commit)
- `admin-config.template.js` - Template file (safe to commit)
- `admin-config.js` - Actual config with keys (DO NOT COMMIT)
- `.gitignore` - Ensures config file is not committed

### Security Best Practices

1. **Never commit sensitive keys to version control**
2. **Use different keys for development and production**
3. **Rotate keys regularly**
4. **Consider IP restrictions on the Azure Function**
5. **Enable CORS only for your specific domains**

### Deployment Checklist

- [ ] admin.html is updated with external config loading
- [ ] admin-config.template.js is in the repository
- [ ] .gitignore includes admin-config.js
- [ ] Production admin-config.js is created separately
- [ ] Azure Function CORS is configured
- [ ] Function authentication is enabled

### Troubleshooting

If the delete client feature doesn't work:
1. Check browser console for errors
2. Verify admin-config.js is loaded (Network tab)
3. Confirm the Azure Function key is correct
4. Check Azure Function logs for authentication errors
5. Verify CORS settings on the Azure Function
