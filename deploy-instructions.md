# Deploy Updated AskForeman to Azure Static Web Apps

## What's New
The index.html file has been updated with Windows Explorer-like file browser features:

### Features Added:
1. **Hierarchical File Browser Navigation**
   - Back and Up navigation buttons
   - Breadcrumb trail showing current path
   - Folder icons with item counts
   - File type-specific icons

2. **Windows Explorer-style Interface**
   - Clean, minimal button styling (white background, no bright colors)
   - Hover effects (light blue highlight)
   - Selection highlighting
   - Single-click to select, double-click to open

3. **Right-Click Context Menus**
   - For files: Open, Download, Edit, Rename, Delete, Reindex
   - For folders: Open, Open in new tab, Rename, Delete

4. **Edit Workflow**
   - Download files for editing in native apps (Word/Excel)
   - Upload edited versions to replace originals
   - Automatic reindexing option

## Deployment Steps

### Option 1: Deploy via GitHub (Recommended)

1. Create a new GitHub repository:
   ```bash
   # Go to https://github.com/new
   # Create a new repository named "AskForeman"
   ```

2. Push the code:
   ```bash
   cd ~/Desktop/AskForeman-deploy
   git remote add origin https://github.com/YOUR_USERNAME/AskForeman.git
   git branch -M main
   git push -u origin main
   ```

3. In Azure Portal:
   - Go to your Static Web App resource
   - Click on "Deployment" or "GitHub Action runs"
   - The deployment should trigger automatically

### Option 2: Deploy via Azure CLI

1. Install Azure Static Web Apps CLI:
   ```bash
   npm install -g @azure/static-web-apps-cli
   ```

2. Deploy directly:
   ```bash
   cd ~/Desktop/AskForeman-deploy
   swa deploy --app-location . --api-location api --output-location .
   ```

### Option 3: Manual Upload via Azure Portal

1. Build the app (if needed):
   ```bash
   cd ~/Desktop/AskForeman-deploy
   # No build needed for this HTML file
   ```

2. Go to Azure Portal:
   - Navigate to your Static Web App
   - Go to "Environments" > "Production"
   - Click "Upload" and select the files

## Files to Deploy
- `index.html` - Main application file with all features
- `ForemanAI.png` - Logo image

## Testing the Features

After deployment, test these features:

1. **File Browser Navigation**:
   - Select a client from dropdown
   - Files should show in hierarchical folder structure
   - Click folders to navigate in
   - Use Back/Up buttons or breadcrumbs to navigate

2. **File Actions**:
   - Double-click files to see open/edit options
   - Right-click for context menu
   - Download and Delete buttons should have minimal styling

3. **Edit Workflow**:
   - Double-click a file and choose "Edit in Native Application"
   - File downloads and notification appears
   - Edit file locally
   - Click "Upload Updated File" in notification
   - Select edited file to replace original

## Troubleshooting

If features aren't showing:

1. **Clear browser cache**:
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

2. **Check deployment status**:
   - In Azure Portal, check "Environments" for deployment status
   - Look for any failed deployments in "GitHub Action runs"

3. **Verify files**:
   - Ensure both index.html and ForemanAI.png are deployed
   - Check file sizes match local versions

## Features Summary

The updated interface now provides:
- Windows Explorer-like file browsing
- Hierarchical folder navigation
- Clean, minimal button styling
- Edit files in native applications
- Direct file replacement in Azure Blob Storage
- Automatic search index updates

The system maintains all existing functionality while adding professional document management capabilities.
