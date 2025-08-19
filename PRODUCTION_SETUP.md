# Production Setup for Admin Panel

## Critical: Azure Function Key Configuration

The admin panel requires the Azure Function key to be configured for the delete client feature to work.

### Option 1: Manual Upload (Recommended for now)

1. Create a file named `admin-config.js` with the following content:

```javascript
// Admin Configuration - Production
window.AdminConfig = {
    AZURE_FUNCTION_KEY: 'YOUR_AZURE_FUNCTION_KEY_HERE'
};
```

**Important:** Replace `YOUR_AZURE_FUNCTION_KEY_HERE` with the actual function key from:
- Azure Portal > saxtech-functionapps2 > Functions > DeleteClientFunction > Function Keys

2. Upload this file to the root of your static web app using one of these methods:
   - Use FTP/FTPS if available
   - Use Azure Storage Explorer to access the web app's storage
   - Deploy it as part of a separate deployment pipeline

### Option 2: Use GitHub Secrets (Future Implementation)

1. Add the function key to GitHub Secrets:
   - Go to your repository settings
   - Navigate to Secrets and variables > Actions
   - Add a new secret: `AZURE_FUNCTION_KEY`

2. Update the GitHub Actions workflow to create the config file during deployment:
   ```yaml
   - name: Create config file
     run: |
       echo "window.AdminConfig = { AZURE_FUNCTION_KEY: '${{ secrets.AZURE_FUNCTION_KEY }}' };" > admin-config.js
   ```

### Option 3: Use Azure Static Web App Configuration

Azure Static Web Apps support environment variables through the `staticwebapp.config.json` file, but these are only available to backend APIs, not frontend JavaScript.

For a pure frontend solution, you would need to create an API endpoint that returns the configuration.

## Testing the Configuration

1. Visit your admin panel: https://icy-river-05419180f.2.azurestaticapps.net/admin.html
2. Login with the admin password
3. Select a client
4. Try the delete function
5. Check browser console for any errors

## Security Notes

- Never commit the `admin-config.js` file with actual keys to version control
- The function key provides access to delete operations - keep it secure
- Consider implementing additional authentication layers for production
- Rotate keys regularly

## Current Status

- ✅ Admin panel deployed without secrets in code
- ✅ Folder structure fixed to match Azure conventions
- ✅ Upload functionality uses correct capitalized folder names
- ⏳ Awaiting manual configuration file deployment for delete functionality

## Files Structure in Azure

```
FCS-OriginalClients/
├── ClientName/
│   ├── Drawings/
│   ├── Estimates/
│   ├── Proposals/
│   ├── Specs/
│   ├── Signed-Contracts/
│   └── Documents/
```

All uploads now correctly save to these capitalized folder names.
